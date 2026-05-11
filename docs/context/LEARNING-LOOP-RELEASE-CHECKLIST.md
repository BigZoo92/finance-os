# Advisor Learning Loop — Release Checklist

> **Status**: stabilization (PR6).
> **Date**: 2026-05-07
> **Scope**: PR1 → PR5 are merged behind feature flags. PR6 hardens the surface with route
> predicate helpers, DOM smoke tests for safety invariants, and this checklist. **Do not flip
> any of the production flags below until every box is ticked.**
> **Related**: [`docs/adr/advisor-learning-loop.md`](../adr/advisor-learning-loop.md),
> [`docs/AI-EVALS.md`](../AI-EVALS.md).

## Pre-merge gates

Run these locally (or from CI) before opening a release PR. **Every command must succeed.**

| Command | Expected | Why |
|---|---|---|
| `pnpm evals:run` | exit `0` | All seeded scored cases pass; existing-category cases skipped honestly. |
| `pnpm evals:run -- --strict` | exit `2` | Documented behaviour: skipped existing categories trip strict mode. Treat exit `2` as expected here. |
| `bun test apps/api/src/routes/dashboard/routes/advisor-journal.test.ts` | green | PR1 Decision Journal regression. |
| `bun test packages/ai/src/evals/scorers` | green | PR2 deterministic scorer + PR4 post-mortem-safety scorer. |
| `bun test apps/api/src/routes/dashboard/domain/advisor/run-advisor-evals.test.ts` | green | PR2 runner integration. |
| `bun test scripts/run-evals.test.ts` | green | PR2 CLI runner. |
| `bun test apps/api/src/routes/dashboard/domain/trading-lab/hypotheses` | green | PR3 hypothesis use-cases. |
| `bun test apps/api/src/routes/dashboard/routes/trading-lab-hypotheses.test.ts` | green | PR3 routes. |
| `bun test apps/api/src/routes/dashboard/domain/advisor/post-mortem/create-post-mortem-use-cases.test.ts` | green | PR4 post-mortem use-case (gating, schema validation, exec-directive block). |
| `bun test apps/api/src/routes/dashboard/routes/advisor-post-mortem.test.ts` | green | PR4 + PR4-fix-2 admin-session-only routes. |
| `bun test apps/api/src/routes/dashboard/services/advisor-graph-ingest.test.ts` | green | PR8 fail-soft graph ingest adapter (disabled flags, compact payload, fail-soft on error). |
| `bun test apps/api/src/routes/dashboard/domain/advisor/create-decision-journal-use-cases.test.ts` | green | PR8 journal graph hook fires only on admin happy path; swallows hook errors. |
| `bun test apps/api/src/routes/dashboard/domain/advisor/post-mortem/create-post-mortem-use-cases.test.ts` | green | PR4 use-case + PR8 graph hook tests (no fire on failed/skipped/execution-directive). |
| `pnpm python:test` *(or scoped: `cd apps/knowledge-service && uv run --extra dev pytest tests/test_ingest_adapters.py`)* | green | PR8 Python ontology + adapter (DecisionPoint, LearningAction, idempotent re-ingest, scope/execution guards). Requires Python `>=3.12` and `uv` (CI installs both via `actions/setup-python@v5` + `astral-sh/setup-uv@v7`). The repo's CI job `.github/workflows/ci.yml` step **"Python checks"** runs this on every push as part of `pnpm python:check`. |
| `pnpm --filter @finance-os/web test` | green | Web view-model + visibility predicate tests + PR6 DOM smoke tests + PR9 trends view-model + flag-on trend-rendering smoke. |
| `bun test apps/api/src/routes/dashboard/domain/advisor/get-advisor-eval-trends.test.ts` | green | PR9 use-case (clamping, grouping, insufficient_data, demo determinism, no provider/LLM/graph). |
| `bun test apps/api/src/routes/dashboard/routes/advisor-eval-trends.test.ts` | green | PR9 route (`GET /advisor/evals/trends`, windowDays validation, demo/admin paths). |
| `bun test apps/api/src/routes/dashboard/domain/advisor/get-advisor-behavior-analytics.test.ts` | green | PR15A pure use-case: clamp, demo determinism, no-freeNote canary, all 6 learning-signal kinds, reason-code aggregation deterministic ordering. |
| `bun test apps/api/src/routes/dashboard/services/pattern-detection-demo.test.ts` | green | PR10 demo fixture (deterministic, no execution vocabulary, sufficient/warnings, omits symbol when absent). |
| `cd apps/quant-service && uv run --extra dev pytest tests/test_patterns.py tests/test_app.py` | green | PR10 + PR15B pattern engine + `POST /quant/patterns/detect` route (9 detectors total: 4 PR10 + 5 SMC/ICT). Covers volume-missing, insufficient-data, deterministic IDs, banlist self-scan, no-high-confidence on SMC patterns, BOS/CHOCH require clear swings, FVG mitigation, order-block CANDIDATE limitation. |
| `pnpm --filter @finance-os/web test -- learning-loop-pattern-draft` | green | PR11 view-model: `buildHypothesisDraftFromDetection` mapping (slug, cautious thesis, invalidation 1:1, evidence omitted when empty, prepended caveats, paper-only tags). |
| `pnpm --filter @finance-os/web test -- learning-loop-smoke` | green | PR6 + PR9 + PR11 + PR12 DOM smoke. PR12 cases: flag-off renders nothing, flag-on shows paper-only badges + Prometteur grade + no-walk-forward + no-recommendation copy. |
| `pnpm --filter @finance-os/web test -- learning-loop-scorecard` | green | PR12 view-model: every grade → label/tone, banlist self-check, exact FR copy from spec. |
| `bun test apps/api/src/routes/dashboard/domain/trading-lab/scorecard/compute-strategy-scorecard.test.ts` | green | PR12 use-case: insufficient → weak → promising → strong_but_unproven → invalidated transitions, missing fees/slippage warnings, high-drawdown danger, walk-forward counting, deterministic demo, no execution vocabulary in messages. PR14 integration cases also live here: advancedMetrics attaches when equity curve present, advancedMetrics never upgrades evidenceGrade, PR12 quality flags are not removed. |
| `bun test apps/api/src/routes/dashboard/domain/trading-lab/scorecard/compute-advanced-risk-metrics.test.ts` | green | PR14 pure helper: Calmar/MAR/Recovery/Ulcer/Tail/Omega/VaR95/ES95/rolling-Sharpe/rolling-DD/win-loss-payoff over deterministic synthetic curves, irregular-cadence suppresses annualised metrics with warning, deterministic 6-decimal rounding, no execution vocabulary, deterministic demo fixture. |
| `pnpm --filter @finance-os/web typecheck` | clean | UI types align with backend contract. |
| `pnpm --filter @finance-os/web build` | succeeds | UI compiles under both flag states; flag-off branch tree-shakes cleanly. |
| `pnpm exec biome lint apps/web/src apps/api/src packages/ai/src apps/worker/src scripts` | 0 issues | A11y + style. |
| `pnpm typecheck` | unchanged baseline | Total error count stays at the long-standing drizzle-orm-at-workspace-boundary noise (no new errors from this train). |

## Production flag posture (release defaults)

These flags MUST be at the values below the first time the Learning Loop ships in prod. Flip
each one only after the corresponding deferred work has landed and been independently signed
off — not as part of the same release.

| Flag | Required default at first release | Owner of the flip |
|---|---|---|
| `VITE_LEARNING_LOOP_UI_ENABLED` | **`false`** | UI release PR after backend has run silently for ≥ 1 week with no incidents. |
| `AI_POST_MORTEM_ENABLED` | **`false`** | A future ops PR after a manual admin run has been validated end-to-end on staging. |
| `AI_POST_MORTEM_HORIZON_DAYS` | `30` | Tunable later via env without code change. |
| `AI_POST_MORTEM_BATCH_LIMIT` | `10` | Tunable later via env without code change. |
| `AI_POST_MORTEM_MODEL` | `claude-sonnet-4-6` (default) | Bump only with a corresponding pricing-registry entry + eval re-run. |
| `AI_POST_MORTEM_AUTO_RUN_ENABLED` *(PR7, worker)* | **`false`** | Flip ONLY after `AI_POST_MORTEM_ENABLED=true` has been validated. See "PR7 rollout sequence" below. |
| `AI_POST_MORTEM_CRON` *(PR7, worker)* | `0 7 * * *` | Tunable. Only minute + hour are honoured (timezone-aware). |
| `AI_POST_MORTEM_TIMEZONE` *(PR7, worker)* | `Europe/Paris` | Tunable. |
| `AI_POST_MORTEM_TRIGGER_TIMEOUT_MS` *(PR7, worker)* | `30000` | AbortController timeout for the worker's HTTP POST. |
| `AI_POST_MORTEM_LOCK_TTL_SECONDS` *(PR7, worker)* | `1800` | Redis lock TTL preventing parallel runs. |
| `ADVISOR_GRAPH_INGEST_ENABLED` *(PR8, api)* | **`false`** | Default `false` for first release. Flip ONLY after the PR8 rollout sequence below has been validated. Requires `KNOWLEDGE_SERVICE_ENABLED=true` to actually emit traffic; either flag at `false` is sufficient to stop graph calls. |

## PR7 rollout sequence (worker scheduler)

The worker scheduler is the only internal-token caller of `POST /advisor/post-mortem/run` in
production. Roll it out gradually:

1. Deploy with `AI_POST_MORTEM_ENABLED=false` and `AI_POST_MORTEM_AUTO_RUN_ENABLED=false`. The
   route accepts internal-token now (PR7) but no automatic trigger fires.
2. Run a manual admin trigger (`POST /advisor/post-mortem/run` from the admin browser session).
   Confirm `status='skipped_disabled'` is returned. No DB write, no LLM call.
3. Flip `AI_POST_MORTEM_ENABLED=true`. Run a manual admin trigger again. Confirm one of:
   `status='completed'` (with `persistedIds` populated), `status='skipped_no_due_items'`, or
   `status='skipped_budget_blocked'`. No `failed`, no `execution_directive_emitted`.
4. Watch `aiCostLedger` rows with `feature='post_mortem'` for at least 24h. Confirm cost stays
   under the daily budget guard.
5. Only then flip `AI_POST_MORTEM_AUTO_RUN_ENABLED=true`. The worker will fire one POST per day
   at the configured cron + timezone, with Redis lock + AbortController timeout protecting
   against runaway runs.

## PR8 rollout sequence (advisor graph ingest)

`ADVISOR_GRAPH_INGEST_ENABLED` ships **`false`** so the new derived write path into the
knowledge graph cannot activate automatically when `KNOWLEDGE_SERVICE_ENABLED` flips to
`true`. The two flags must BOTH be `true` for any graph traffic to be emitted.

1. Deploy with `ADVISOR_GRAPH_INGEST_ENABLED=false`. Confirm in logs that no
   `advisor decision point graph ingest skipped` / `advisor post-mortem graph ingest skipped`
   warning fires for `reason ≠ "*_disabled"` — the only `false`/`disabled` paths should be the
   short-circuit ones (`knowledge_service_disabled`, `graph_ingest_disabled`).
2. Confirm the CI job `.github/workflows/ci.yml` → step **"Python checks"** is green for the
   release commit. That step runs `pnpm python:check`, which includes the PR8 ontology +
   adapter tests under Python 3.12 (canonical command:
   `cd apps/knowledge-service && uv run --extra dev pytest tests/test_ingest_adapters.py`).
3. On staging, with `ADVISOR_GRAPH_INGEST_ENABLED=true` and `KNOWLEDGE_SERVICE_ENABLED=true`,
   trigger ONE manual admin journal create + ONE manual post-mortem run. Verify:
   - Decision Journal create returns `201` and the response payload is unchanged shape.
   - Post-mortem run returns `status='completed'` (or a structured `skipped_*`).
   - Persisted `advisor_post_mortem.risk_notes` shows `graphIngest: 'attempted'` (NOT
     `'deferred'`), `scope: 'advisory-only'`.
4. Query the knowledge graph (e.g. `POST /knowledge/query` with `query="advisor decision point"`
   or by node id derived from `recommendation_node_id(recommendation_key)`) and confirm:
   - `DecisionPoint` and `LearningAction` nodes exist and carry `tags` containing
     `"advisory-only"`.
   - Edges `LEADS_TO`, `SUPPORTS`/`VALIDATED_BY`/`INVALIDATED_BY` reference the recommendation
     id derived from `recommendation_key` only (NOT title-derived).
   - Re-running the same admin trigger does NOT increase node count — idempotent merge.
5. Only then flip `ADVISOR_GRAPH_INGEST_ENABLED=true` in production. Postgres remains canonical;
   if the graph service is unavailable, journal create + post-mortem persistence still succeed
   (the adapter is fail-soft and the use-case swallows hook errors as belt-and-suspenders).

## PR9 — Advisor Eval Trends (read-only)

`GET /dashboard/advisor/evals/trends?windowDays=<7..90>` is read-only, DB-only, and emits NO
LLM / provider / knowledge-service / graph call. The endpoint is unconditionally available to
the existing advisor surface (same access guard as `/advisor/evals`); the UI is gated by the
existing `VITE_LEARNING_LOOP_UI_ENABLED` flag — when the flag is `false`, the trends query
short-circuits via `enabled: false` and the scorecard keeps showing the legacy
`Tendances : différé` badge.

The endpoint reads historical `aiEvalRun` rows in the requested window. New runs additively
include a `summary.byCategory` breakdown so trend reads do not have to reconstruct from
the (mutable) active-case list. Legacy runs without `byCategory` fall back to deriving failed
counts from `summary.failedCaseDetails` and surface a structured caveat in the response so the
client knows the data is partial.

Behaviour invariants (verified by PR9 tests):
- `windowDays` clamped to `[7, 90]` server-side; default `30`.
- `status` per category is one of `improving | stable | regressing | insufficient_data`.
  `insufficient_data` is surfaced when fewer than two historical runs exist for that category;
  the response NEVER fabricates a delta.
- The first caveat always asserts the deterministic-evals framing; PR9 must not expand the
  Advisor's claim surface to profitability or predictivity.
- Demo mode returns deterministic fixtures; admin mode reads `aiEvalRun` only.
- The existing `/dashboard/advisor/evals` response shape is unchanged.

## PR10 — Technical Pattern Detection (quant-service, research-only)

`POST /quant/patterns/detect` ships in `apps/quant-service` and is proxied by the API at
`POST /dashboard/trading-lab/patterns/detect`. The endpoint is **research / paper-only**: it
NEVER calls a broker, exchange, IBKR, Binance, Powens, the LLM, or the knowledge graph. It is
not wired into the worker scheduler.

Patterns supported in this train: `ema20_horizontal_level`, `ema200_one_touch`,
`parabolic_sar_rci`, `volume_profile_zones`. Each detection carries `confidence` capped to
conservative defaults (no detector returns `high` on its own; SAR+RCI is capped at `medium`),
explicit `limitations`, `invalidationHints`, and `metrics`. The engine self-scans every text
field for execution vocabulary before returning; on a hit the response is replaced with a
neutral safety fallback rather than emitting the offending text.

Behaviour invariants:
- Volume Profile is **skipped** silently when volume is missing or all-zero. It is never
  reconstructed from price-only data.
- Insufficient candle counts produce `dataQuality.sufficient = false` plus a structured
  warning; no detection is emitted.
- Detection IDs are deterministic SHA-1 hashes of the request fingerprint, so re-runs over
  identical input produce identical IDs.
- Demo mode at the API layer returns a deterministic fixture without contacting quant-service.
- Existing `/quant/{indicators,backtest,metrics,walk-forward}` endpoints are unchanged.

## PR11 — Trading Lab Pattern Detection panel (UI integration)

The PR10 endpoint (`POST /dashboard/trading-lab/patterns/detect`) is now surfaced through a new
flag-gated `PatternDetectionPanel` mounted on `/ia/trading-lab` alongside the existing
Hypothesis Lab. Behaviour:

- **Flag** — visible only when `VITE_LEARNING_LOOP_UI_ENABLED=true`; shares the same gate as
  Hypothesis Lab (`shouldShowHypothesisLabOnTradingLab`). Flag-off renders nothing.
- **Demo** — deterministic fixture rendered locally (no network call). The "Créer une hypothèse
  papier" CTA is hidden in demo mode. Re-running yields byte-identical output.
- **Admin** — runs the API; admins can convert a detection into a manual hypothesis via the
  existing PR3 endpoint. On success the hypotheses query keys are invalidated through
  `LEARNING_LOOP_INVALIDATION_KEYS.afterHypothesisChange()`.
- **Mapping** — `buildHypothesisDraftFromDetection` lifts a detection into a draft with: title
  derived from the canonical FR pattern label + symbol/timeframe; cautious thesis (no execution
  wording); `invalidationCriteria` 1:1 from `invalidationHints`; `evidenceNotes` 1:1 from
  `evidence`; `caveats` prepended with "Cette détection n'est pas une recommandation." +
  "Les résultats doivent être backtestés"; tags fixed to `pattern-detection`, the
  `patternType`, and `paper-only`; `status: 'draft'`; `horizon: null`.
- **Copy** — required FR copy is present: "Paper only", "Aucune exécution", "Recherche",
  "Détection déterministe", confidence labels (faible/moyenne/élevée), volume warning when
  `dataQuality.hasVolume === false`.

No persistence of raw detections (no DB writes); no graph ingest; no LLM/provider calls; no
worker scheduler change. Existing `/ia/trading-lab` content renders unchanged when the flag is
off.

## PR12 — Strategy Scorecards (Hypothesis Lab evidence quality)

Read-only `GET /dashboard/trading-lab/strategies/:id/scorecard` aggregates the existing
`tradingLabBacktestRun` history into an **evidence-quality grade** — explicitly NOT a
profitability or predictive claim. Demo mode returns a deterministic fixture without contacting
the database or any external service. Admin mode reads only Postgres rows.

UI: `StrategyScorecardCard` mounts as a collapsible inside each hypothesis row in the existing
PR5 Hypothesis Lab section. Same flag gate as the rest of the Learning Loop UI
(`VITE_LEARNING_LOOP_UI_ENABLED`); when off, the card is not rendered.

Grading rules (deterministic, server-side):
- No completed backtests ⇒ `insufficient`.
- `archived` is a workflow state and does NOT change the grade — it surfaces as a dedicated
  `archived` info quality flag while the grade keeps reflecting the evidence. (PR12-fix.)
- The `invalidated` enum value is reserved for an explicit-invalidation signal that does not
  exist in the data model yet; PR12 never emits it. The enum stays in the contract so a
  future PR can wire that signal without a breaking change. (PR12-fix.)
- Missing core metrics (winRate / profitFactor / sharpe / maxDrawdown null) ⇒ capped at `weak`.
- Total trades < 30 ⇒ capped at `weak`.
- Max drawdown ≥ 40% ⇒ capped at `weak` AND surfaces a `danger` quality flag.
- Drawdown 20–40% ⇒ `warning` flag (no grade cap by itself).
- No walk-forward run ⇒ capped at `promising`.
- Walk-forward count is derived from `resultSummary.walkForward === true` on completed runs;
  no schema change.
- Quality flags include: `paper_only` (always), `archived` (when workflow status is archived),
  `low_sample_size`, `missing_fees`, `missing_slippage`, `high_drawdown`, `no_walk_forward`,
  `unstable_results`, `insufficient_data`.
- `missing_fees` / `missing_slippage` warnings fire when `feesBps` / `slippageBps` is `null`
  (unknown) **or** `0` (assumed zero). The UI keeps rendering null as "inconnu" so the user
  can tell unknown apart from zero, but the warning surfaces in either case. (PR12-fix.)
- Caveats are a fixed deterministic set: "Paper only. Cette analyse n'est pas une
  recommandation.", "Qualité de preuve, pas une prédiction de performance future.",
  "Les métriques passées ne prédisent pas les résultats futurs.".

No LLM call, no provider call, no graph ingest, no worker change, no DB schema or migration.

## PR15B — SMC/ICT deterministic detector pack

Five new pattern keys join PR10's `POST /quant/patterns/detect` engine:
`fair_value_gap`, `liquidity_sweep`, `break_of_structure`, `change_of_character`,
`order_block_candidate`. Re-implemented in TypeScript-friendly Python under our license;
**no smart-money-concepts dependency, no source vendored**.

Hard guarantees (verified by tests):

- **Confidence cap**: SMC detectors never emit `high`. The most they can claim is `medium`,
  and `order_block_candidate` is hard-capped at `low`.
- **Insufficient data → no detection** + warning. Same as PR10.
- **No clear swings → no false BOS / CHOCH / order-block detections**.
- **Banlist self-scan**: every emitted text field is scanned for execution vocabulary
  (`buy/sell/long/short/order/execute/...`); on hit, the engine substitutes a neutral
  fallback rather than emitting the offending text.
- **Deterministic IDs**: same input → same `det_*` ids.

UI: `PatternDetectionPanel` exposes the five new options as checkboxes (after the PR10
detectors). When any SMC pattern is selected, an "SMC/ICT research" badge appears in the
header. Detection cards for SMC patterns carry a "Candidate structure · Not a signal · Paper
only" caption above the metrics. The "Créer une hypothèse papier" CTA from PR11 is reused
unchanged — its mapping already produces a cautious, paper-only hypothesis draft.

Demo helper surfaces a deterministic bullish FVG entry when `fair_value_gap` is requested.
Other SMC keys can be selected in demo but produce no fixture; the panel renders the
empty-state copy.

## PR15A — Advisor Behavior Analytics

Read-only `GET /dashboard/advisor/behavior-analytics?windowDays=<7..365>` aggregates the
existing `advisor_decision_journal` + `advisor_decision_outcome` tables into a behavior view.
Tradetally-inspired pattern; **no Tradetally dependency**.

Hard guarantees (verified by tests):

- **Read-only** — no DB write, no LLM, no provider, no graph, no worker, no execution.
- **freeNote-free** — the new repo helper `listDecisionsForBehaviorAnalytics` selects ONLY
  the columns the analytics layer needs. The `free_note` column is excluded by hand at the
  SQL select level. A test serialises the response and asserts the substring `freenote` /
  `free_note` does not appear, as a defense-in-depth canary.
- **No causality / profitability / prediction claim** — caveats are permanent; reason-code
  "caution" copy is descriptive only ("Plus de résultats négatifs que positifs") and never
  prescriptive ("stop accepting", "exécuter…").
- **Insufficient sample → `insufficient_sample` learning signal**, never fabricated rates.
- **Demo mode** returns a deterministic fixture without touching the DB.

Frontend: `BehaviorAnalyticsCard` mounts on `/ia` behind `VITE_LEARNING_LOOP_UI_ENABLED`. When
the flag is off, the card returns `null` and the query is not enabled.

Invalidation: `LEARNING_LOOP_INVALIDATION_KEYS.afterDecisionJournal()` and
`afterDecisionOutcome()` now refresh the behavior-analytics query alongside the journal.

## PR14 — QuantStats-inspired analytics enrichment

PR14 additively extends the PR12 Strategy Scorecard with a curated set of retrospective
risk/performance metrics inspired by QuantStats but **re-implemented under our license**.
QuantStats is **not** a runtime dependency; no QuantStats source is vendored.

The new field on `GET /dashboard/trading-lab/strategies/:id/scorecard` is:

```ts
advancedMetrics: {
  calmarRatio, marRatio, recoveryFactor, ulcerIndex, tailRatio, omegaRatio,
  valueAtRisk95, expectedShortfall95,
  rollingSharpe: { latest, min, max, average, window },
  rollingMaxDrawdown: { latest, worst, window },
  payoffRatio, averageWin, averageLoss,
  assumptions: { annualizationPeriods, riskFreeRate, varConfidence, rollingWindow },
  warnings: string[]
} | null
```

Behaviour invariants (verified by tests):
- `advancedMetrics === null` when no completed run exists; otherwise the helper computes from
  the latest completed run's `equityCurve` + `trades`.
- Per-metric fields are `null` when their preconditions fail (sample < 30 returns for
  percentile-based metrics; sample < 60 for rolling metrics; bar cadence irregular for
  annualised metrics). The output never fabricates zeros — always `null + warnings`.
- `evidenceGrade` is **never** influenced by `advancedMetrics`. PR12 grade rules remain
  authoritative and PR12 quality flags are not removed.
- VaR / CVaR are explicitly labelled "historique" / "estimation" — never "worst case".
- All numeric outputs are deterministically rounded to 6 decimals.
- No new DB table, no migration, no LLM call, no provider call, no graph ingest, no worker
  change, no broker integration.

UI: a collapsible "Métriques avancées" subsection inside the existing PR12 `StrategyScorecardCard`.
Lazy-load behaviour is unchanged — the subsection toggle does not fire a new query.

## PR16 — Provider Abstraction v2 *(documentation only — ADR + companion notes)*

PR16 is a research / ADR PR. It produces:

- [`docs/adr/provider-abstraction-v2.md`](../adr/provider-abstraction-v2.md) — main ADR
  (`Status: proposed`). Audits current provider landscape, enumerates 10 gaps, proposes a
  5-layer architecture (consumers → registry → interface → adapters → transport), defines
  the `Provider<C>` shape, the closed-set `ProviderErrorCode` taxonomy, the cache /
  staleness model, the credential / security rules (incl. PR8-style redaction harness),
  the demo / admin contract, the migration plan, the risks, and the PR17A–E roadmap.
- [`docs/research/provider-abstraction-openbb-hyperswitch-notes.md`](../research/provider-abstraction-openbb-hyperswitch-notes.md)
  — companion reference notes on what we take from OpenBB / Hyperswitch and what we
  explicitly don't.

The ADR **does not** change runtime code. No package added, no env var introduced, no DB
schema or migration, no provider call attempted, no worker change, no UI mounted.

It informs the proposed PR17A–E implementation roadmap (capability registry types →
ProviderError taxonomy + redaction → provider-health diagnostics → normalized sync metadata
→ provider docs + test harness). Each of those is a separate implementation PR with its
own pre-merge gates; PR16 itself adds no runtime gate.

## Macro Prompt 5 — Hardening, observability, and data quality scoring

Adds a deterministic data quality + Advisor readiness scoring layer plus
diagnostics hardening, with no new provider calls, no live probes, no DB
schema changes, no LLM, no graph ingest, no sync/worker/credential/encryption
changes, no UI in this batch.

**Scope shipped**

- `apps/api/src/routes/dashboard/domain/data-quality/` — pure helpers
  (`data-quality-types.ts`, `compute-data-quality.ts`,
  `build-data-quality-snapshot.ts`,
  `data-quality-demo-fixture.ts`,
  `create-get-data-quality-use-case.ts`). Deterministic scoring across 8
  canonical dimensions: `banking`, `investments`, `crypto`, `market_data`,
  `news`, `advisor_memory`, `evals`, `post_mortems`. Includes an additive
  `advisorReadiness` block (`ready` / `usable_with_caveats` / `limited` /
  `not_ready`). Score `null` for missing inputs (never `0`). Unconfigured /
  disabled-by-flag is reported as `unknown` / `degraded` — never as `down`.
- `apps/api/src/routes/dashboard/routes/data-quality.ts` — new
  `GET /dashboard/data-quality` route. Demo callers receive a deterministic
  fixture (no DB read, no provider IO). Admin / internal-token callers receive
  scores derived from already-cached local rows and the already-computed
  provider diagnostics health snapshots. **No `provider.call()`. No sync
  trigger. No LLM. No graph call.**
- `apps/api/src/routes/dashboard/runtime.ts` wires the use-case using the
  existing `powensConnections.listConnectionStatuses()`,
  `externalInvestments.getStatus()`,
  `marketsRepository.getMarketCacheState()`,
  `newsRepository.getNewsCacheState()`,
  `advisorRepository.getLatestEvalRun()`,
  `advisorPostMortemRepository.listPostMortems()` — no new repositories, no
  new queries.
- `apps/api/src/routes/dashboard/router.ts` mounts the route under the existing
  `/dashboard` prefix.
- `packages/provider-runtime/src/diagnostics.ts` hardened: providers are now
  emitted in stable alphabetical order by `providerId`, and `unconfigured` /
  `disabled_by_flag` error codes surface explicit caveats. `down` is preserved
  exclusively for clearly configured + clearly failing local state. Existing
  diagnostics response keys are unchanged.
- Tests:
  `apps/api/src/routes/dashboard/domain/data-quality/compute-data-quality.test.ts`,
  `build-data-quality-snapshot.test.ts`,
  `apps/api/src/routes/dashboard/routes/data-quality.test.ts`,
  updated `packages/provider-runtime/src/diagnostics.test.ts` (stable order,
  unconfigured-not-down, disabled-by-flag-not-down, summary counts under mixed
  states, no `provider.call()` invocation). Sensitive-sentinel sweeps assert
  none of `token` / `secret` / `apiKey` / `api_key` / `signature` /
  `access_token` / `refresh_token` / `client_secret` / `cookie` /
  `authorization` / `bearer` / raw XML / raw JSON / account-number sentinels
  appear in any response payload.
- Operator guide: `docs/operations/data-quality-and-provider-diagnostics.md`
  (provider statuses, grades, stale/degraded/missing semantics, advisor
  readiness rules, what does NOT happen).
- Updates: `docs/context/FEATURES.md`,
  `docs/adr/provider-abstraction-v2.md` (status header + diagnostics-semantics
  note for Macro Prompt 5).

**Pre-merge gates**

| Command | Expected | Why |
|---|---|---|
| `bun test apps/api/src/routes/dashboard/domain/data-quality/` | green | Pure compute helpers, snapshot builder, demo determinism, sentinel sweep, advisor readiness rules. |
| `bun test apps/api/src/routes/dashboard/routes/data-quality.test.ts` | green | Endpoint demo/admin shape, internal-token elevation, 503 when use-case not wired, sentinel sweep, closed top-level shape. |
| `bun test packages/provider-runtime/src/diagnostics.test.ts` | green | Existing diagnostics shape + new hardening assertions (stable order, caveat normalization, summary counts, no `provider.call()`). |
| `bun test apps/api/src/routes/dashboard/routes/providers-diagnostics.test.ts` | green | Existing route still passes; entries are still looked up by `providerId`. |
| `bun test apps/api/src/routes/dashboard/services/providers/internal-provider-registry.test.ts` | green | Sensitive provider wrappers integration unchanged. |
| `pnpm exec biome check packages/provider-runtime apps/api/src/routes/dashboard/domain/data-quality apps/api/src/routes/dashboard/routes/data-quality.ts apps/api/src/routes/dashboard/routes/data-quality.test.ts apps/api/src/routes/dashboard/runtime.ts apps/api/src/routes/dashboard/router.ts` | 0 issues | New files + edits comply with repo style. |
| `pnpm typecheck` | unchanged baseline | Total error count must stay at the long-standing drizzle-orm-at-workspace-boundary noise. |

**Behaviour invariants this batch guarantees**

- No new provider calls. No live provider probes.
- No `provider.call()` invocation from `/dashboard/data-quality` or from
  `/dashboard/providers/diagnostics`.
- No DB schema, migration, or new query.
- No worker / sync / Redis lock / credential / encryption change.
- No LLM, no graph ingest, no `ADVISOR_GRAPH_INGEST_ENABLED` default change.
- No raw provider payload exposure. No token / secret / signature / account id
  in any response or log produced by these endpoints.
- No execution / trading / payment / write capability added.
- No existing public response shape broken. The `dataQuality` response is a
  new endpoint shape; `providersDiagnostics` adds caveats and stable ordering
  additively (existing keys, types, and per-provider lookup unchanged).

---

## Macro Prompt 4 — Sensitive providers foundation (health-only wrappers)

Adds health-only `Provider<C>` wrappers for the three sensitive providers — `powens`
(`banking.accounts.read`), `ibkr` (`external_investments.positions.read`), and
`binance` (`crypto.wallet.read`) — registered in the internal provider registry and
surfaced through `GET /dashboard/providers/diagnostics`. **`provider.call()` returns
`unsupported_capability` (`deferred_read_routing`) for all three; production routes
still consume `packages/powens` and `packages/external-investments` directly.**
**No public response shape changes. No DB schema changes. No env vars added or
defaults changed. No worker / sync / Redis lock / credential / encryption / UI / LLM
/ graph behavior change. No live Powens / IBKR Flex / Binance call from the wrappers
at any point — no live diagnostics probe. No execution / trading / payment / write /
order / transfer / swap capabilities added.**

**Scope shipped**

- `apps/api/src/routes/dashboard/services/providers/powens-provider.ts` — health-only
  `Provider<banking.accounts.read>` wrapper. Reads from injected
  `listConnectionStatuses()` closure (closed-vocab subset of `powensConnection`); no
  Powens client touched, no token decrypted, no `lastError` body forwarded.
  `provider.call()` is deferred (`unsupported_capability` + `deferred_read_routing`).
  Health mapping: empty / unconfigured / never-synced → `degraded` + `unconfigured`;
  reconnect_required → `degraded` + `auth_failed`; mixed errors → `degraded` +
  `transient`; all-error-no-success → `down` + `provider_unavailable`; healthy →
  `ok`.
- `apps/api/src/routes/dashboard/services/providers/ibkr-provider.ts` and
  `apps/api/src/routes/dashboard/services/providers/binance-provider.ts` — health-only
  wrappers for `external_investments.positions.read` and `crypto.wallet.read`,
  sharing the closed-vocab health mapping helper at
  `apps/api/src/routes/dashboard/services/providers/external-investments-provider-shared.ts`.
  Read from injected `getProviderSnapshot()` closures (closed-vocab subset of
  `externalInvestmentProviderHealth` + `externalInvestmentConnection`). Mapping:
  null / unconfigured / disabled / idle → `degraded`; `failing` → `down`;
  `degraded` → `degraded` + `transient`; `healthy` → `ok`.
- `apps/api/src/routes/dashboard/services/providers/internal-provider-registry.ts`
  now mounts six providers (knowledge / quant / news / powens / ibkr / binance) and
  exposes `refreshSensitiveProviderHealth()` aggregating the three sensitive
  wrappers' async refresh closures.
- `apps/api/src/routes/dashboard/runtime.ts` constructs the closures from
  `createPowensConnectionRepository(db, redisClient).listConnectionStatuses()` and
  `externalInvestments.getStatus()` (already-existing repositories — no new tables).
  `DashboardRouteRuntime` gains an optional `refreshProviderHealth?:
  () => Promise<void>` field; the `/dashboard/providers/diagnostics` admin path
  awaits it before computing diagnostics. Demo callers never trigger a refresh.
- Tests:
  `apps/api/src/routes/dashboard/services/providers/powens-provider.test.ts`,
  `ibkr-provider.test.ts`, `binance-provider.test.ts`,
  updated `internal-provider-registry.test.ts` (covers all 6 providers + refresh
  parallelism + exception swallowing) and updated
  `apps/api/src/routes/dashboard/routes/providers-diagnostics.test.ts` (admin path
  asserts powens / ibkr / binance entries with capabilities; refresh-hook is
  awaited on admin and skipped on demo; sentinels for token / apiKey / secret /
  signature / accessToken / flexToken / account ids never appear in payload).
- Per-provider docs: `docs/providers/powens.md`, `docs/providers/ibkr.md`,
  `docs/providers/binance.md`. Updated `docs/providers/README.md` migrated-providers
  table. Updated `docs/adr/provider-abstraction-v2.md` header status; §11.6 reflects
  Powens / IBKR / Binance health-only partial migration; new §11.10.

**Pre-merge gates**

- [ ] `bun test apps/api/src/routes/dashboard/services/providers` — knowledge / quant
      / news / powens / ibkr / binance + registry tests all pass.
- [ ] `bun test apps/api/src/routes/dashboard/routes/providers-diagnostics.test.ts` —
      all paths (demo deterministic, admin shape, internal token, sensitive entries,
      refresh hook called/skipped, no-sentinel) pass.
- [ ] `pnpm --filter @finance-os/provider-runtime test` — unchanged.
- [ ] `pnpm --filter @finance-os/provider-contract test` — unchanged.
- [ ] `bun test apps/api/src/routes/integrations/powens` — Powens routes unchanged.
- [ ] `bun test packages/external-investments` — unchanged.
- [ ] `pnpm exec biome check apps/api/src/routes/dashboard packages/provider-contract
      packages/provider-runtime` — passes.
- [ ] No new env vars; no env defaults changed; no DB migrations.
- [ ] `/integrations/powens/*`, `/dashboard/external-investments/*`,
      `/dashboard/transactions`, `/dashboard/news`, `/dashboard/markets/*` response
      shapes unchanged (no live provider call from diagnostics; no sync trigger).

**Out of scope (deferred)**

- Read routing through `provider.call()` for `powens` / `ibkr` / `binance` — the
  wrappers stay deferred (`unsupported_capability`) until a follow-up macro prompt
  rewires reads.
- `banking.transactions.read` and `external_investments.trades.read` wrappers.
- Consolidating the existing `/integrations/powens/diagnostics` live-probe endpoint
  with the registry-based `/dashboard/providers/diagnostics`. The two endpoints
  remain separate; the new endpoint is local-snapshot only.
- Market-data migration (still deferred from Macro Prompt 3).
- Per-source news wrappers (still deferred from Macro Prompt 3).
- Knowledge-service route rewiring (still deferred from Macro Prompt 2-fix).
- Worker / sync / encryption / credential changes — never in scope.

## Macro Prompt 3 — Provider diagnostics endpoint + news-service aggregation wrapper

Wires `GET /dashboard/providers/diagnostics` (admin-only, demo-deterministic, read-only)
through the existing internal provider registry, and registers the aggregation-level
`news-service` wrapper (`news.items.read`) alongside `knowledge-service` and
`quant-service`. **No public response shape changes. No new env vars. No new
third-party deps. Sensitive providers (Powens, IBKR, Binance, market-data adapters,
banking sync, external-investments sync) untouched.**

**Scope shipped**

- `apps/api/src/routes/dashboard/services/providers/news-service-provider.ts` —
  aggregation-level `Provider<news.items.read>` wrapper around the existing
  `NewsProviderAdapter[]` pool. Returns counts/status/durations only; never article
  bodies, URLs, or upstream raw payloads. Demo mode returns a deterministic per-source
  `'skipped'` snapshot without touching the network. `disabled_by_flag` when no
  adapters are enabled. All-failed → `provider_unavailable`; mixed → `providerOk`
  with per-source `'failed'`.
- `apps/api/src/routes/dashboard/services/providers/internal-provider-registry.ts`
  now mounts three providers (knowledge-service, quant-service, news-service) and
  is built once during `createDashboardRouteRuntime`, exposed as
  `runtime.providerRegistry`.
- `apps/api/src/routes/dashboard/routes/providers-diagnostics.ts` — new Elysia route
  serving `GET /dashboard/providers/diagnostics`. Demo callers (no admin session, no
  internal token) receive `computeDemoProviderDiagnostics` output; admin callers (or
  callers with a valid internal token) receive `computeProviderDiagnostics` over the
  registry. Never invokes `Provider.call()`. Closed shape:
  `{generatedAt, mode, providers[], summary, caveats[]}`.
- `apps/api/src/routes/dashboard/routes/providers-diagnostics.test.ts` — demo
  determinism, admin shape with mixed health states, summary counts, empty registry,
  internal-token grants admin shape, no `apiKey` / `token` / `secret` substrings in
  payload.
- `apps/api/src/routes/dashboard/services/providers/news-service-provider.test.ts` —
  contract harness, demo determinism, `disabled_by_flag` skip, redaction proof
  (synthetic SECRET-TOKEN-7 / RAW ARTICLE BODY never reach output or logs),
  per-source success/failure aggregation, `provider_unavailable` on total failure,
  `degraded` health on mixed outcomes.
- `docs/providers/news-service.md` — populated from `_template.md`.
- `docs/adr/provider-abstraction-v2.md` — header status updated; §11.3 marked
  endpoint-shipped; §11.6 reflects news partial migration; new §11.9.

**Pre-merge gates**

- [ ] `bun test apps/api/src/routes/dashboard/services/providers` — news-service +
      registry tests pass alongside the existing wrappers.
- [ ] `bun test apps/api/src/routes/dashboard/routes/providers-diagnostics.test.ts` —
      all paths pass.
- [ ] `bun test apps/api/src/routes/dashboard/routes/news.test.ts` — unchanged,
      public response shapes intact.
- [ ] `pnpm --filter @finance-os/provider-runtime test` — unchanged.
- [ ] `pnpm --filter @finance-os/provider-contract test` — unchanged.
- [ ] `pnpm exec biome check apps/api/src/routes/dashboard packages/provider-contract
      packages/provider-runtime` — passes.
- [ ] No new env vars; no env defaults changed.
- [ ] `/dashboard/news`, `/dashboard/news/ingest`, `/dashboard/news/context`,
      `/dashboard/markets/*` response shapes unchanged.

**Out of scope (deferred)**

- Per-source news wrappers (HN / GDELT / ECB-RSS / ECB-Data / Fed-RSS / SEC-EDGAR /
  FRED / X-Twitter). The aggregation-level wrapper covers diagnostics-and-contract
  needs at far lower migration surface.
- Market-data migration (EODHD / Twelve Data / FRED). ~600 LOC of inline branching
  with API keys, US-fresh-overlay heuristics, per-provider freshness windows.
  Migrating safely needs three adapters + a fallback config + a redaction story for
  keys-in-URLs. Its own PR.
- Rewiring `/dashboard/news`, `/dashboard/news/ingest`, `/dashboard/markets/*` onto
  `runtime.providerRegistry`. Routes still consume `dashboard.useCases` and the
  adapter pool directly.
- Knowledge-service route rewiring (still deferred from Macro Prompt 2-fix).
- Sensitive providers (Powens, IBKR, Binance, banking sync, external-investments
  sync, crypto wallet sync) — never touched.

## Macro Prompt 2-fix — first runtime canary *(quant-patterns-detect rewired)*

Rewires the `/dashboard/trading-lab/patterns/detect` admin handler through
`quantPatternsDetectProvider`. First real runtime consumer of the provider
abstraction. The other quant endpoints stay on the inline helper; knowledge-service
rewiring is deferred. **No public response shape changes. No env / DB / worker /
UI / sensitive-provider changes. No new third-party deps.**

**Scope shipped**

- `apps/api/src/routes/dashboard/routes/trading-lab.ts` instantiates
  `quantPatternsDetectProvider` once at route-factory init and uses it for the admin
  branch of `/patterns/detect`. Inline `callQuantService` is kept for the other
  endpoints (`/capabilities`, `/backtest`, `/walk-forward`).
- `apps/api/src/routes/dashboard/routes/trading-lab-patterns-detect.test.ts` —
  route-level test that mounts a minimal Elysia app reproducing the admin handler
  exactly, exercises the real wrapper against a fake fetch, and asserts:
  - admin success → 200 `{ ok: true, ...upstreamBody }` shape preserved
  - admin disabled → 503 `QUANT_SERVICE_DISABLED`, no fetch call
  - admin HTTP 5xx / thrown → 503 `QUANT_SERVICE_UNAVAILABLE`
  - demo branch never invokes fetch
  - log lines never contain candle values, upstream error bodies, or thrown error
    text
  - public response on failure contains no execution vocabulary

**Pre-merge gates**

- [ ] `bun test apps/api/src/routes/dashboard/routes/trading-lab-patterns-detect.test.ts`
      — 7 tests, all pass.
- [ ] `bun test apps/api/src/routes/dashboard/services/providers` — 15 tests, all
      pass (unchanged).
- [ ] `pnpm --filter @finance-os/provider-runtime test` — unchanged, 64 tests pass.
- [ ] `pnpm --filter @finance-os/provider-contract test` — unchanged, 16 tests pass.
- [ ] `KNOWLEDGE_SERVICE_ENABLED`, `ADVISOR_GRAPH_INGEST_ENABLED`, and
      `QUANT_SERVICE_ENABLED` defaults unchanged.
- [ ] `/dashboard/trading-lab/patterns/detect` response shape unchanged.

**Out of scope (deferred)**

- Knowledge-service route rewiring. The advisor consumers depend on the typed
  `KnowledgeServiceClient` surface (`stats` / `schema` / `query` / `contextBundle`
  / `rebuild` / `explain`). Replacing a single call site with the
  single-capability wrapper is non-trivial without exporting `query` / `stats` /
  `explain` as capabilities; deferred.
- `quant.metrics.compute` / `quant.indicators.compute` rewiring.
- `quant.backtest` / `quant.walk_forward` — neither is in
  `ALLOWED_PROVIDER_CAPABILITIES`; would need an ADR amendment first.
- Knowledge graph **ingest**. No write capability is allowed; `advisor-graph-ingest.ts`
  continues to operate fail-soft as today.
- `GET /dashboard/providers/diagnostics` endpoint.
- Sensitive providers (Powens, IBKR, Binance, market-data, news) untouched.

## Macro Prompt 2 — Internal provider migration batch *(knowledge-service + quant-service wrappers)*

First migration onto the Provider Foundation. Adds standalone `Provider<C>` wrappers
for the two safest internal read paths — `knowledge.context_bundle.read` and
`quant.patterns.detect` — with unit tests, per-provider docs, and a registry mount.
Routes still use the existing inline helpers; the wrappers are not yet consumed by
production code paths. **No public API response shape changes. No env / DB / worker /
UI / sensitive-provider changes.**

**Scope shipped**

- `apps/api/src/routes/dashboard/services/providers/knowledge-context-bundle-provider.ts`
  wrapping `KnowledgeServiceClient.contextBundle` as
  `Provider<knowledge.context_bundle.read>`.
- `apps/api/src/routes/dashboard/services/providers/quant-patterns-detect-provider.ts`
  wrapping the existing `/quant/patterns/detect` HTTP shape as
  `Provider<quant.patterns.detect>`. Demo branch reuses `buildDemoPatternDetectionResponse`
  and never hits the network.
- `apps/api/src/routes/dashboard/services/providers/internal-provider-registry.ts`
  mounts both into a `ProviderRegistry`. No consumers yet.
- Unit tests for both wrappers and the registry mount; every result and every captured
  log line is asserted via the runtime invariant harness; raw upstream payloads (synthetic
  secrets, candle values, error bodies) are explicitly asserted to never appear in logs.
- `docs/providers/knowledge-service.md` and `docs/providers/quant-service.md`.
- `apps/api/package.json` gains workspace deps on `@finance-os/provider-contract` and
  `@finance-os/provider-runtime`. No third-party deps.

**Pre-merge gates**

- [ ] `bun test apps/api/src/routes/dashboard/services/providers` — 16 tests, all pass.
- [ ] `pnpm --filter @finance-os/provider-runtime test` — unchanged, 64 tests pass.
- [ ] `pnpm --filter @finance-os/provider-contract test` — unchanged, 16 tests pass.
- [ ] `pnpm exec biome lint apps/api/src/routes/dashboard/services/providers` — clean.
- [ ] `pnpm evals:run` — unchanged; no production code path activated.
- [ ] `KNOWLEDGE_SERVICE_ENABLED` and `ADVISOR_GRAPH_INGEST_ENABLED` defaults unchanged.
- [ ] `/dashboard/trading-lab/patterns/detect` response shape unchanged.

**Out of scope (deferred)**

- Rewiring routes to consume the wrappers (route closures still call
  `createKnowledgeServiceClient` / inline `callQuantService` directly).
- `quant.metrics.compute` / `quant.indicators.compute` wrappers.
- `quant.backtest` / `quant.walk_forward` wrappers — neither is in
  `ALLOWED_PROVIDER_CAPABILITIES`. Adding them would require an ADR amendment first.
- Knowledge graph **ingest** wrapping. No write capability is allowed by the contract;
  `advisor-graph-ingest.ts` continues to operate fail-soft as today.
- `GET /dashboard/providers/diagnostics` endpoint. Diagnostics use-case remains pure.
- Sensitive providers (Powens, IBKR, Binance, market-data, news) untouched.

## PR17B–E — Provider Foundation Bundle *(runtime helpers + diagnostics use-case + docs + harness)*

The Provider Foundation Bundle adds [`packages/provider-runtime/`](../../packages/provider-runtime/)
on top of the PR17A type-only contract. It is **runtime-additive only**: no adapter
migrated, no provider call added, no DB schema, no migration, no worker behavior
change, no public API response shape change.

**Scope shipped**

- New workspace `@finance-os/provider-runtime` depending only on
  `@finance-os/provider-contract`. Eight modules: `error.ts`, `result.ts`,
  `redaction.ts`, `logger.ts`, `registry.ts`, `sync-meta.ts`, `diagnostics.ts`,
  `test-harness.ts`, plus `index.ts` barrel.
- `createProviderError`, `normalizeProviderError`, `isProviderError`,
  `providerErrorToSafeJson`, `providerErrorTypeOf` close the error-construction surface
  and emit a browser-safe JSON projection that never includes stack traces or
  arbitrary cause fields. `safeDetails` is funnelled through redaction at construction
  time.
- `providerOk` / `providerErr` / `mapProviderResult` / `mapProviderError` /
  `unwrapProviderResultOrThrow` enforce the meta-on-both-branches invariant.
- `redactProviderPayload`, `redactProviderLogFields`,
  `assertNoSensitiveProviderFields`, `createSensitiveKeyMatcher` form the redaction
  harness. Sensitive key fragments redact recursively; cycles return `[Circular]`;
  Errors keep only `name + message`; Dates serialize to ISO; class instances are
  tagged, not spread; long strings are clamped (default 1000 chars).
- `logProviderEvent` adapts the prelude `createJsonLogger` shape to a closed event
  vocabulary (`provider.call.started|succeeded|failed|skipped`,
  `provider.health.checked`, `provider.sync.started|succeeded|failed|skipped`) with a
  closed allowlist of fields. Unknown fields are dropped; sensitive values are
  redacted before reaching the underlying logger; `errorType` derives from the closed
  `ProviderErrorCode` union.
- In-memory `createProviderRegistry` skeleton (`listProviders`, `listCapabilities`,
  `getProvider`, `findProvidersByCapability`, `healthAll`). Pure: it does not
  instantiate adapters, read env, or perform any network call.
- `ProviderSyncStatus` / `ProviderSyncState` / `ProviderSyncRunMeta` /
  `ProviderFreshnessState` types and `createProviderSyncState` /
  `computeProviderFreshness` helpers preserve `null` over fake-zero for unknown
  numerics and only flip `stale` when a known `maxAgeMinutes` budget is exceeded.
- `computeProviderDiagnostics(registry, context)` pure use-case returns
  `{generatedAt, mode, providers[], summary, caveats[]}`. Demo mode returns a
  deterministic empty fixture; admin mode reads `getHealth()` snapshots only and
  never invokes `call()`. **Endpoint deferred** — wiring into
  `apps/api/src/routes/dashboard/router.ts` left for a focused future PR.
- Invariant test harness: `assertProviderContract`,
  `assertProviderDoesNotExposeForbiddenCapabilities`, `assertProviderResultSafe`,
  `assertProviderErrorSafe`, `assertProviderLogsSafe`.
- Provider author guide and template under [`docs/providers/`](../providers/),
  pinned by docs-sanity tests inside the runtime package.

**Pre-merge gates**

- [ ] `pnpm --filter @finance-os/provider-runtime test` — 64 tests, all pass.
- [ ] `pnpm --filter @finance-os/provider-runtime typecheck` — clean.
- [ ] `pnpm --filter @finance-os/provider-contract test` — unchanged, all pass.
- [ ] `pnpm exec biome lint packages/provider-runtime` — clean.
- [ ] `pnpm evals:run` — unchanged; the bundle activates no provider path.

**Out of scope (still deferred)**

- No third-party adapter migrated (Powens, IBKR, Binance, market-data, news,
  knowledge-service, quant-service all keep their current code paths).
- No `GET /dashboard/providers/diagnostics` Elysia route. The use-case is callable
  and tested; only the route wiring is deferred.
- No DB schema for `provider_sync_state`. Worker / sync job behavior is unchanged.
- No canary integration of the runtime into knowledge-service or quant-service.

## PR17A — Provider Capability Registry + Interface *(types-only foundation)*

PR17A lands the Layer 3 type surface from ADR §11.1 in a brand-new workspace
[`packages/provider-contract/`](../../packages/provider-contract/). It is **types only**:
no adapter migrated, no provider call routed through the new types, no DB or runtime change,
no env var, no UI surface, no worker change, no flag introduced.

**Scope shipped**

- New workspace `@finance-os/provider-contract` with eight type modules + barrel:
  `capabilities.ts`, `context.ts`, `error.ts`, `health.ts`, `meta.ts`, `provider-id.ts`,
  `provider.ts`, `result.ts`, plus `index.ts`.
- Closed-set capability registry: `ALLOWED_PROVIDER_CAPABILITIES` (13 read-only keys covering
  knowledge, quant, market, news, banking, external investments, crypto wallet) and
  `FORBIDDEN_PROVIDER_CAPABILITIES` (8 execution / write keys: `trading.order.create`,
  `trading.order.cancel`, `trading.position.open`, `trading.position.close`,
  `crypto.swap.execute`, `crypto.transfer.create`, `payment.charge.create`,
  `bank.transfer.create`).
- Compile-time guard `__PROVIDER_CAPABILITY_GUARD_OK: _AssertNoForbiddenInAllowed = true`
  fails to type-check if a forbidden string ever leaks into the allowed union.
- Closed 14-value `ProviderErrorCode` union (`unconfigured`, `disabled_by_flag`,
  `rate_limited`, `auth_failed`, `not_found`, `invalid_input`, `transient`, `permanent`,
  `tos_blocked`, `demo_mode_forbidden`, `budget_exceeded`, `stale_cache`,
  `provider_unavailable`, `unsupported_capability`).
- `ProviderResult<T>` discriminated union (`{ ok: true; data; meta } | { ok: false; error; meta }`).
- `ProviderCallContext` requires `mode: 'demo' | 'admin'` (no default), `requestId`, `now`,
  `reason`; optional `budgetPolicy`, `freshnessPolicy`, `dryRun`.
- `ProviderHealth` (status `ok | degraded | down`), `ProviderMeta` + `ProviderSourceMeta`
  (every result carries provenance).
- `Provider<C>` interface and type-only `ProviderRegistryContract` shape.

**Pre-merge gates**

- [ ] `pnpm --filter @finance-os/provider-contract test` — 16 tests, 95 expects, all pass.
- [ ] `pnpm --filter @finance-os/provider-contract typecheck` — clean.
- [ ] `pnpm typecheck` — global error baseline unchanged at 88 (drizzle-orm noise; no
  provider-contract package contributions).
- [ ] `pnpm exec biome lint packages/provider-contract` — clean.
- [ ] Package boundary self-test confirms zero workspace runtime / transport imports leak in.
- [ ] `pnpm evals:run` — unchanged; PR17A activates no provider path.

**Out of scope (deferred to PR17B–E)**

- No adapter migrated. Existing inline provider code keeps working unchanged.
- No `ProviderError` runtime class, no `logProviderEvent` redaction harness (PR17B).
- No `health()` implementation, no diagnostics route or UI badge (PR17C).
- No `provider_sync_state` shape, no migration of Powens / IBKR / Binance sync jobs (PR17D).
- No per-provider docs page, no shared adapter test harness (PR17E).
- No capability-keyed input/output DTOs yet — `Provider<C>` stays generic over `TInput` / `TOutput`
  pending per-capability migrations.

## PR13 — External Repositories Audit *(documentation only)*

PR13 is a research / documentation PR. It produces:

- [`docs/research/advisor-external-repos-audit.md`](../research/advisor-external-repos-audit.md) — full 15-field audit of **30 distinct repositories** + 15 concepts. The user-supplied list contained 32 entries that resolve to 30 unique repos (`jesses-ai/jesse` typo → `jesse-ai/jesse`; `tauricresearch/tradingagents` ≡ `TauricResearch/TradingAgents`).
- [`docs/research/advisor-external-repos-decision-matrix.md`](../research/advisor-external-repos-decision-matrix.md) — wide decision-matrix table (30 rows). Primary-decision split: `adapt pattern` 8 / `research only` 15 / `avoid` 7.

The audit **does not** change runtime code. License + activity were verified via the GitHub
API on 2026-05-09. The audit informs the proposed PR14–PR18 roadmap (QuantStats-inspired
metrics, behavior analytics + SMC/ICT detectors, provider-abstraction research, Qlib/Lean
research-architecture comparison, Advisor v2 committee) — each of those is a separate
implementation PR with its own pre-merge gates; PR13 itself adds no runtime gate.

## Deferred surfaces — DO NOT enable in this train

_(All previously deferred surfaces in the Advisor Learning Loop train have shipped. PR7 added
the worker scheduler behind `AI_POST_MORTEM_AUTO_RUN_ENABLED`. PR8 added DecisionPoint /
LearningAction graph ingest behind `ADVISOR_GRAPH_INGEST_ENABLED`. PR9 added the trends endpoint
and the UI now reads it through a flag-gated query — see "PR9 — Advisor Eval Trends" below.)_

> PR7 update (2026-05-08): the worker scheduler shipped. The previous "no worker scheduler"
> deferred bullet has been promoted to a configured-but-disabled flag (see
> `AI_POST_MORTEM_AUTO_RUN_ENABLED` above). The scheduler only sends an internal HTTP POST —
> no direct LLM, DB, provider, knowledge-service, or graph call from the worker.

> PR8 update (2026-05-08): graph ingest of `DecisionPoint` / `LearningAction` shipped. The
> Python knowledge-service ontology now declares both node types and the `SUPPORTS`,
> `HAS_EVIDENCE`, `VALIDATED_BY`, `INVALIDATED_BY` relations (schema version
> `2026-05-08.advisor-learning-loop-v1`). The API-side hook is fail-soft: errors NEVER block
> journal creation or post-mortem persistence. New post-mortem rows carry
> `riskNotes.graphIngest = "attempted"` (or `"disabled"` when the env flag is off); legacy /
> demo rows continue to show `"deferred"`. Postgres remains canonical — graph ingest is
> enrichment only.

## Behaviour invariants this train guarantees

The PR6 smoke tests assert these. If any of these is violated by a future change, the test
suite will catch it.

- [ ] Flag off → no PR5 query is fetched. Every PR5 component is wrapped in a flag check.
      Verified by `learning-loop-visibility.test.ts` (logic) and `learning-loop-smoke.test.tsx`
      (DOM).
- [ ] Demo mode → no mutation is reachable from the UI. Submit/run/archive/scenario buttons
      are either hidden or rendered with `disabled` set. The use-case layer additionally
      throws on `mode === 'demo'` as belt-and-suspenders.
- [ ] Post-mortem run button is hidden in demo mode regardless of feature flag state.
- [ ] Existing `/ia` and `/ia/trading-lab` pages render exactly as before when flag is off.
      Verified by reading the routes after the PR6 predicate refactor — the new branches add
      only `null` returns when the flag is off, no layout shift.
- [ ] No execution-shaped wording in any new UI copy. The PR2 deterministic scorers + the PR4
      strict post-mortem scorer (`post_mortem_safety` category) catch model output regressions.

## Post-release watch (first 7 days)

If any of these alerts fire, **flip `VITE_LEARNING_LOOP_UI_ENABLED` back to `false` first**,
then triage:

- [ ] `pnpm evals:run` going from exit `0` to exit `1` on the seeded baselines.
- [ ] Any `failed` post-mortem row with `errorCode = 'execution_directive_emitted'`. The
      learning-action payload is dropped on this path; investigate the prompt + model.
- [ ] Cost ledger outliers on `feature = 'post_mortem'` in `aiCostLedger` indicating either
      runaway batches or a mis-tuned `AI_POST_MORTEM_BATCH_LIMIT`.
- [ ] Any 5xx on `POST /dashboard/advisor/post-mortem/run` (admin retried). The route itself
      should return `200` with a structured `skipped_*` / `failed` body — never a 5xx.

## Sign-off

- [ ] Backend lead — ADR safety constraints respected, no execution path added.
- [ ] Frontend lead — flag-off path renders unchanged; smoke tests passing.
- [ ] Ops — both production flags confirmed `false` in the deployment manifest.

## Macro Prompt 6 — Advisor closure (advisor v2 skeleton, replay, fine-tuning gate)

> **Status**: closure of the AI Advisor roadmap.
> **Date**: 2026-05-10
> **Scope**: read-only additive endpoints, deterministic eval guardrails, and the operating
> guide. **Do not flip `AI_ADVISOR_V2_ENABLED` to `true` until the items below are ticked AND an
> ADR has reviewed the committee's deterministic synthesis output.**

### Pre-merge gates

- [x] No new DB migration / schema (Phase 0 confirmed existing tables suffice).
- [x] No live provider call. No `provider.call()` invocation in any new path. Sensitive
      provider read routing remains deferred.
- [x] No graph ingest. `ADVISOR_GRAPH_INGEST_ENABLED` default unchanged (`false`).
- [x] No LLM call in any new code path. Advisor v2 preview, replay, and fine-tuning gate are
      deterministic.
- [x] No new autonomous execution agent. Forbidden roles (`executor`, `trader`,
      `order_manager`, `portfolio_manager_with_execution`, `broker_operator`) are encoded as
      data and asserted by tests.
- [x] No fine-tuning. `GET /dashboard/advisor/fine-tuning-readiness` is a deterministic gate
      that returns `not_recommended` / `premature` by default and ships with three default
      blockers (`privacy_export_plan_not_accepted`, `measurable_improvement_target_missing`,
      `rollback_plan_missing`).
- [x] No UI shipped this batch (deferred per spec — adds scope).
- [x] Existing advisor route response shapes unchanged.
- [x] One env flag added: `AI_ADVISOR_V2_ENABLED` (default `false`).

### New endpoints

- [x] `GET /dashboard/advisor/v2/capabilities` — closed-vocabulary capability listing.
- [x] `POST /dashboard/advisor/v2/preview` — admin-only, deterministic, returns
      `skipped_disabled` when flag is off, `skipped_data_not_ready` when readiness is below
      `usable_with_caveats`.
- [x] `GET /dashboard/advisor/replay?windowDays=N` — admin-only, clamps to `[1, 90]`,
      surfaces patterns, never returns `freeNote`, always `dataQualityAtReview: "current_only"`.
- [x] `GET /dashboard/advisor/fine-tuning-readiness` — admin-only, conservative gate.

### Eval guardrails

- [x] `advisor_v2_committee_safety` — healthy baseline; checks data quality respected, no
      execution vocabulary, no sentinel leakage.
- [x] `replay_no_causality_overclaim` — healthy baseline; bans causality overclaim phrasing.
- [x] `fine_tuning_gate_privacy` — healthy baseline; asserts the privacy blocker fires by
      default, no raw financial data in response.
- [x] `advisor_readiness_respected` — healthy baseline; asserts readiness level is exposed.
- [x] Negative fixtures live in `packages/ai/src/evals/scorers/closure.test.ts`.
- [x] `pnpm evals:run` exit 0 (verified locally — 8 passed, 0 failed, 5 skipped — closure
      cases all green).

### Documentation

- [x] `docs/operations/ai-advisor-operating-guide.md` created (16 sections covering daily /
      weekly / bi-weekly cadence, warning signs, advisory-only contract).
- [x] `docs/context/FEATURES.md` updated with closure section (endpoints, eval guardrails,
      flag).
- [x] `docs/context/LEARNING-LOOP-RELEASE-CHECKLIST.md` updated with this section.
- [x] `docs/research/advisor-external-repos-audit.md` annotated with the pattern-only
      inspiration link to TradingAgents / ai-hedge-fund (committee role naming only — no code
      reuse).

### Production flag posture (do NOT flip without ADR)

| Flag | Production default |
|---|---|
| `AI_ADVISOR_V2_ENABLED` | `false` |
| `ADVISOR_GRAPH_INGEST_ENABLED` | `false` (unchanged) |
| All other Macro Prompt 6 surfaces | always-on (read-only, admin-only) |

### Sign-off

- [ ] Backend lead — closure surfaces are read-only, deterministic, and never call
      provider/LLM/graph paths.
- [ ] Ops — `AI_ADVISOR_V2_ENABLED=false` confirmed in the deployment manifest.
- [ ] Operator — has read `docs/operations/ai-advisor-operating-guide.md` and understands
      the daily / weekly / bi-weekly cadence.
