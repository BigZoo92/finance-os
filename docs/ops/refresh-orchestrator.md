# Refresh orchestrator — status taxonomy & operational runbook

The refresh orchestrator lives at
[`apps/api/src/routes/ops/refresh-registry.ts`](../../apps/api/src/routes/ops/refresh-registry.ts)
and is exposed under `/ops/refresh/*`.

## Status taxonomy

A refresh job result carries a `RefreshJobStatus`:

| Status                          | Meaning                                                                |
| --- | --- |
| `pending`                       | Dry-run only: job would be scheduled.                                  |
| `disabled`                      | Job disabled by configuration.                                         |
| `queued`                        | Handed to underlying queue; non-final.                                 |
| `running`                       | Actively executing; non-final. Should not stay here past `timeoutMs`.  |
| `success`                       | Completed and produced expected data.                                  |
| `partial`                       | Completed with at least one provider in degraded state.                |
| `failed`                        | Hard error.                                                            |
| `timed_out`                     | Exceeded the job's hard timeout (orchestrator AbortController fired).  |
| `cancelled`                     | Cancelled via `POST /ops/refresh/runs/:runId/cancel`.                  |
| `skipped`                       | Generic skip (legacy). Prefer the variants below.                      |
| `skipped_disabled`              | Feature flag for this job is off.                                      |
| `skipped_missing_config`        | Flag on but required secret/config is missing — actionable.            |
| `skipped_budget`                | Paid provider budget exhausted (e.g. X monthly cap).                   |
| `skipped_dependency_failed`     | An upstream job failed/timed_out; downstream skipped automatically.    |

The `isFinalRefreshStatus()` helper exported from `refresh-registry.ts`
returns true for every status except `queued`/`running`. Any job stuck in
`running` past `staleAfterMs` is a candidate for stale-recovery.

## Routes

| Method | Path                                       | Notes |
| --- | --- | --- |
| GET    | `/ops/refresh/jobs`                        | Job definitions (demo + admin). |
| GET    | `/ops/refresh/status`                      | Snapshot incl. latest run (admin). |
| GET    | `/ops/refresh/runs`                        | Recent runs (admin). |
| GET    | `/ops/refresh/runs/:runId`                 | Single run details (admin). |
| POST   | `/ops/refresh/all`                         | Run full daily intelligence (admin). |
| POST   | `/ops/refresh/jobs/:jobId/run`             | Run a single job (admin). |
| POST   | `/ops/refresh/stale-runs/recover`          | Sweep stale runs. Advisor manual operations are marked failed/timed out; background `free_firehose_run` and `signal_ingestion_run` rows are marked `failed_timeout`. Body: `{ staleAfterMs?: number }`. |
| POST   | `/ops/refresh/runs/:runId/cancel`          | Cancel an in-flight run (admin). |
| GET    | `/ops/env/diagnostics`                     | Per-service env health (no secrets returned). |
| GET    | `/ops/scheduler/status`                    | Daily Intelligence crons, next runs, scheduler flags. |
| GET    | `/ops/knowledge/enrichment/status`         | Advisor memory/KG write visibility. |

`POST /ops/refresh/all` now executes the `refresh-registry` daily plan in
topological order. Body:

```json
{
  "trigger": "manual | scheduled | internal",
  "runKind": "night | morning | manual | dry_run",
  "dryRun": false,
  "staleAfterMs": 1800000
}
```

`dryRun: true` returns the ordered plan and disabled/pending jobs without
calling providers, queues, DB-writing use cases, or LLMs.

## Hard timeout & stale recovery

Each job declaration has a `timeoutMs`. The orchestrator currently enforces
this via `Promise.race` against a timeout sentinel — the inner promise may
keep running in the background, but the caller-visible status moves to
`timed_out` once the budget is exhausted. The underlying use case is
responsible for writing its eventual final status into the DB (so when the
user refreshes the page they see the actual outcome).

If a run never finalizes (worker crash, network outage), call
`POST /ops/refresh/stale-runs/recover` with a `staleAfterMs` (default
1 800 000 = 30 min). The endpoint first calls any wired recovery hooks:
`recoverStaleAdvisorManualOperations` for Advisor manual operations and
`recoverStaleBackgroundRuns` for background `free_firehose_run` /
`signal_ingestion_run` rows. Background rows are only recovered from
`running` to `failed_timeout`; final states are left untouched. If no recovery
hook is registered, the endpoint falls back to returning stale Advisor
candidates so an operator can act manually.

The same stale recovery hooks run automatically before non-dry-run
`POST /ops/refresh/all` and `POST /ops/refresh/jobs/:jobId/run` executions.
Pass `staleAfterMs` in the request body to override the default threshold.
Dry-run requests never mutate stale rows.

## Preflight skip variants

The `evaluatePreflight()` helper centralizes the "should this job actually
run?" decision so each handler doesn't reinvent it:

```ts
evaluatePreflight({
  job,
  triggerSource,
  missingConfig: { missingEnvNames: ['EODHD_API_KEY'], reason: 'EODHD key missing' },
  budgetExceeded: { reason: 'monthly X cap reached' },
  failedDependencyId: 'powens',
})
```

Returning `skipped_missing_config` instead of throwing an opaque 500 makes
the Ops Refresh Center surface the actionable bit ("set this env var")
instead of "internal error".

## Test coverage

- [`refresh-preflight.test.ts`](../../apps/api/src/routes/ops/refresh-preflight.test.ts):
  unit tests for `evaluatePreflight` + `isFinalRefreshStatus`.
- [`refresh-registry.test.ts`](../../apps/api/src/routes/ops/refresh-registry.test.ts):
  legacy registry behavior + redaction.
- [`refresh.test.ts`](../../apps/api/src/routes/ops/refresh.test.ts):
  HTTP-level demo isolation + admin paths.
- [`recover-orphaned-manual-operation-steps.test.ts`](../../apps/api/src/routes/ops/recover-orphaned-manual-operation-steps.test.ts):
  orphaned-step recovery (parent terminal + child active).

## Stale-step recovery taxonomy

A manual operation must never leave a child `ai_manual_operation_step` active
once it reaches a terminal status. Two paths enforce this:

- **Write-side cascade** — `updateManualOperation` closes active steps when the
  operation transitions to `completed`/`failed`/`degraded` (covers the failure
  path where a step throws before being marked terminal).
- **Recovery sweep** — `recoverOrphanedManualOperationSteps` (called inside
  `recoverStaleManualOperations`) closes any step still active under an
  already-terminal parent, independent of the stale-age cutoff.

Closure codes (machine codes mapped to readable admin copy in the UI):

| Code | Cause | Step status |
| ---- | ----- | ----------- |
| `STALE_TIMED_OUT` | parent exceeded the stale threshold (sweeper) | `failed` |
| `STALE_PARENT_OPERATION_FAILED` | active step under a `failed`/`degraded` parent | `failed` |
| `PARENT_OPERATION_COMPLETED` | active step under a `completed` parent | `skipped` |
| `CANCELLED` | cancelled via UI/admin | `failed` |

Source of truth: `packages/ai/src/manual-operation-recovery.ts`. The Ops UI
renders these as muted "incident ancien récupéré" (not a red `échec`) and does
not naively offer "Relancer" on a recovered step. See
[`PRE_MAQUETTES_FOLLOWUP_VALIDATION_0`](../debug/PRE_MAQUETTES_FOLLOWUP_VALIDATION_0.md).
