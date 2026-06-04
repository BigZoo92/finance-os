# PRE_MAQUETTES_FOLLOWUP_VALIDATION_0

Date: 2026-06-03

Scope: product/ops validation follow-up after the `PRE-MAQUETTES-BLOCKERS-0`
patch (deployed v15.4.6). Closes the remaining ops-status, costs, memory and
categorization gaps before `UI-A11Y-PERF-BASELINE-0`. No mockups, no global UI
refactor, no Qdrant/Neo4j reset, no DB history deletion, no Docker/resource
change, no tag, no deploy.

## 1. What was fixed

### A. Ops status / stale-step recovery
- `updateManualOperation` now closes any still-active child step when an
  operation reaches a terminal status (`completed`/`failed`/`degraded`). This is
  the source of the bug: a step thrown mid-run (e.g. the old advisor `.toFixed`
  crash) left `advisor_run` `running` while the parent was already `failed`.
- New `recoverOrphanedManualOperationSteps` sweep
  (`apps/api/src/routes/ops/recover-orphaned-manual-operation-steps.ts`) closes
  any active step whose parent operation is already terminal. It runs inside
  `recoverStaleManualOperations`, independent of the 30-minute stale cutoff
  (the parent is already terminal, so the orphan closes immediately).
- Defensive display reconciliation in the repository hydration: a terminal
  operation never returns an active step (it is presented as auto-closed). So
  `/ops/refresh/status` cannot report a phantom "en cours".
- Recovery taxonomy is unified and machine-coded:
  - `STALE_TIMED_OUT` — parent timed out (sweeper).
  - `STALE_PARENT_OPERATION_FAILED` — step active under an already failed/degraded parent.
  - `PARENT_OPERATION_COMPLETED` — step active under a completed parent (closed as `skipped`, benign).
  - `CANCELLED` — cancelled via UI/admin.
- Shared, framework-free source of truth:
  `packages/ai/src/manual-operation-recovery.ts` (used by API write/recovery and
  the web copy mapping).
- UI: the orchestration job card and the dashboard "Mission manuelle" card map
  these codes to readable admin copy, render recovered items as muted
  "incident ancien récupéré" (not a red `échec`), relegate an old recovered
  incident in the summary, and hide the naive "Relancer" for non-actionable
  recovered steps (replaced by a low-emphasis "Relancer si besoin").
- All ops mutations (full refresh, single job, recovery, cancel) now invalidate
  + refetch `/ops/refresh/status`, the latest manual operation, advisor runs and
  the ops dashboard (`apps/web/src/features/ops-refresh/invalidate.ts`).

### B. Costs follow-up
- `/dashboard/costs/overview` already separates real / estimated / fixed
  recurring / currency / period. The gaps closed here:
  - Idempotent seed for the fixed "2 x 8 EUR" X API Basic subscription:
    `packages/db/src/seeds/recurring-provider-cost.ts` + `pnpm db:seed:recurring-costs`.
  - `/ia/couts` now labels X variable cost as `estimé` / `réel (facturé)` /
    `réel + estimé` and shows the estimated/actual breakdown — an estimate is
    never presented as a real billed amount.

### C. Memory / Qdrant / Neo4j follow-up
- New non-destructive knowledge-service endpoints:
  - `GET /knowledge/storage/status` — read-only Qdrant + Neo4j reachability,
    counts, collection-exists, `empty`.
  - `POST /knowledge/storage/ensure` — idempotent `ensure_collection` +
    `ensure_schema`. Never resets/deletes/rebuilds.
- `/ops/knowledge/enrichment/status` now surfaces: Qdrant reachable / collection
  exists / points, Neo4j reachable / nodes / relationships, production
  configured/active, fallback active, and `emptyBecauseNoIngest`.
- New admin proxy `POST /ops/knowledge/enrichment/ensure`.
- UI: the Memory page shows an honest readiness state — `ready` / `empty (aucun
  ingest)` / `fallback local` / `dégradé` / `démo` — with labeled counts (no raw
  JSON) and an "Initialiser le stockage" button.

### D. Categorization validation
- Backfill now applies enabled `user_categorization_rule` rows (by priority,
  skipping disabled, respecting validity windows), consistent with the live
  transaction list. Backfill stays dry-run by default; no destructive change.
- Create / list / dry-run endpoints and engine integration already existed;
  validation commands are in `docs/ops/categorization-rules.md`.

## 2. Why the UI showed "en cours"

The orchestration job card derives the "AI advisor context & conseil" badge from
the matching step's status (`advisor_run`). Operation `26d3c928…` (and
`9120f304…`) had `status=failed` for ~14-16 days, but their `advisor_run` step
was still `running` because the step threw before being marked terminal and the
parent failover did not cascade to the step. A `running` step rendered as
"en cours" even though no `ai_run` was active.

## 3. Why it now shows "échec" (and what changes next)

The targeted prod cleanup closed steps 91/111 to `failed` with
`error_code=STALE_PARENT_OPERATION_FAILED`. With the step terminal, the card
flipped to `échec` and printed the raw technical message — also wrong UX.

New expected behaviour:
- The step is recognized as a recovery-closed item (`STALE_PARENT_OPERATION_FAILED`).
- The badge renders muted as "incident ancien récupéré", not a red `échec`.
- The technical message is replaced by readable admin copy.
- The summary "Dernier run" shows "récupéré" with an age note instead of a red failure.
- "Relancer" is de-emphasized to "Relancer si besoin" for the recovered item.

## 4. Production validation commands (read-only / safe)

SQL — confirm no orphaned active steps remain (must return 0 rows):

```sql
SELECT s.id, s.operation_id, s.step_key, s.status, o.status AS parent_status
FROM ai_manual_operation_step s
JOIN ai_manual_operation o ON o.id = s.operation_id
WHERE s.status IN ('queued','running')
  AND o.status NOT IN ('queued','running');
```

SQL — recurring fixed cost seeded (expect the 2 x 8 EUR rows):

```sql
SELECT id, provider, label, amount, currency, cadence, source,
       metadata ->> 'seedKey' AS seed_key
FROM recurring_provider_cost
WHERE active = true
ORDER BY id;
```

API (admin session or internal token; never echo secrets):

```bash
curl -sS "$APP_URL/api/ops/refresh/status"
curl -sS "$APP_URL/api/dashboard/costs/overview"
curl -sS "$APP_URL/api/ops/knowledge/enrichment/status"
curl -sS -X POST "$APP_URL/api/ops/knowledge/enrichment/ensure"
curl -sS "$APP_URL/api/dashboard/transactions/categorization-rules"
```

Seed the fixed recurring cost (idempotent; `--dry-run` previews):

```bash
pnpm db:seed:recurring-costs -- --dry-run
pnpm db:seed:recurring-costs
```

Categorization validation commands: see `docs/ops/categorization-rules.md`.
Memory lifecycle + expected states: see `docs/ops/memory-lifecycle.md`.

## 5. Expected Memory state after deploy

Memory is expected to be **empty** right after deploy until an ingest/rebuild
runs. `/ops/knowledge/enrichment/status` should report `productionActive: true`
with `qdrant.collectionExists: true`, `qdrant.points: 0`, `neo4j.nodes: 0`,
`empty: true`, `emptyBecauseNoIngest: true`. The Memory UI shows
"Vide (aucun ingest)" — explicitly NOT "ready". Running `POST
/ops/knowledge/enrichment/ensure` guarantees the collection + schema exist
without writing data. Memory fills as advisor runs ingest memory events.

## 6. What remains before UI-A11Y-PERF-BASELINE-0

- ROUTES-NAV-COPY-0 (route/nav policy) is still open (tracked in
  `PRE_MAQUETTES_FULL_DIAGNOSTIC.md` §3/§10).
- No axe / Lighthouse / bundle-analyzer tooling yet (diagnostic §8).
- Browser `prompt`/`confirm` flows (transaction classification, social
  deletion, firehose) still need designed dialogs.
- Design identity decision (Aurora Pink vs Command Pixel) before any mockups.
- Memory remains empty until a production ingest/rebuild is run.

## 7. Tests added

- `packages/ai/src/manual-operation-recovery.test.ts` (semantics)
- `apps/api/.../ops/recover-orphaned-manual-operation-steps.test.ts`
- `apps/web/.../features/advisor-run-state.test.ts` (error copy mapping)
- `apps/web/.../features/ops-refresh/invalidate.test.ts`
- `apps/api/.../routes/costs-overview.test.ts`,
  `apps/api/.../services/providers/x-twitter-usage-ledger.test.ts`,
  `packages/db/.../seeds/recurring-provider-cost.test.ts`,
  `apps/web/.../features/costs.test.ts`
- `apps/knowledge-service/tests/test_storage_status.py`,
  `apps/web/.../features/memory-readiness.test.ts`
- `apps/api/.../routes/transaction-categorization-backfill.test.ts`
