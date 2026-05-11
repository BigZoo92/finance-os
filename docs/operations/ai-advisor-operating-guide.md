# AI Advisor — Operating Guide (Macro Prompt 6 closure)

**Audience.** Operators, reviewers, and the user (egd@sahar.fr) running Finance-OS day-to-day.
**Status.** Closure of the AI Advisor roadmap (PR1 → Macro Prompt 6). The Advisor is **advisory-only** and never executes trades, transfers, or any broker/exchange action.
**Last updated.** 2026-05-10.

---

## 1. What the Advisor does

The Advisor is a deterministic-first system that helps you reflect on your portfolio and decisions. It produces:

- a **Daily Brief** (deterministic summary plus optional LLM enrichment, gated by budget and feature flags),
- ranked **Recommendations** with evidence, caveats, and a challenger pass,
- a **Decision Journal** where you record what you decided and why,
- **Outcomes** linked to past decisions,
- **Post-Mortems** that compare expected outcomes to observed outcomes,
- **Behavior Analytics** that surface long-term decision patterns,
- a **Knowledge Graph context bundle** for grounding answers in your own history,
- **Eval Trends** showing how the deterministic eval suite has been performing,
- a **Data Quality** snapshot with `advisorReadiness`, and
- **Provider Diagnostics** for sensitive providers (read-only health, no live probes).

Macro Prompt 6 closes the loop with three additional read-only surfaces:

- **Advisor v2 committee skeleton** — `GET /dashboard/advisor/v2/capabilities` and `POST /dashboard/advisor/v2/preview`. Off by default. No LLM call. Deterministic synthesis only.
- **Replay** — `GET /dashboard/advisor/replay?windowDays=N` — review of recent recommendations / decisions / outcomes / post-mortems.
- **Fine-tuning readiness gate** — `GET /dashboard/advisor/fine-tuning-readiness` — deterministic gate that decides whether fine-tuning should even be considered later.

## 2. What the Advisor does NOT do

- It does **NOT** place orders, transfers, withdrawals, swaps, conversions, or any execution action.
- It does **NOT** call broker, exchange, or payment APIs in write mode. IBKR / Binance / Powens reads are health-only health snapshots; live read routing through `provider.call()` for those three is deferred.
- It does **NOT** auto-trigger sync jobs. Manual refresh-and-run is gated by an operator action.
- It does **NOT** fine-tune any model.
- It does **NOT** export private financial data.
- It does **NOT** speak in execution vocabulary (`buy`, `sell`, `order`, `execute`, `transfer`, `withdraw`, `swap`, `leverage`, `margin`, `futures`, `passer un ordre`, `acheter`, `vendre`).
- It does **NOT** claim causality or future performance.

## 3. How the daily run works

`POST /dashboard/advisor/run-daily` (admin or internal-token) runs the deterministic pipeline first:

1. `getSummary` reads cached portfolio state.
2. The deterministic brief is computed from snapshots, goals, news context, and external-investments context bundle.
3. If the LLM provider is configured **and** budget allows, `runStructured` enriches the brief, the recommendations, and the challenger pass — each behind its own JSON schema.
4. Recommendations are persisted with `priorityScore`, `confidence`, `riskLevel`, `reversibility`, and `challengerStatus`.
5. The deterministic eval suite is invoked separately (offline, via `pnpm evals:run`) and never blocks a daily run.

Macro Prompt 6 introduces **Advisor v2** as a parallel, opt-in skeleton. v2 does **not** replace `runAdvisorDaily`. When `AI_ADVISOR_V2_ENABLED=false` (default), `POST /advisor/v2/preview` returns `status: "skipped_disabled"`.

## 4. How data quality affects recommendations

`GET /dashboard/data-quality` returns:

- a per-dimension breakdown (`banking`, `investments`, `crypto`, `market_data`, `news`, `advisor_memory`, `evals`, `post_mortems`),
- an `overall` grade (`excellent` / `good` / `usable` / `degraded` / `insufficient` / `unknown`),
- an `advisorReadiness` level (`ready` / `usable_with_caveats` / `limited` / `not_ready`).

**Rules of thumb.**

- `ready` → read the recommendations as usable within their stated caveats. They remain advisory-only.
- `usable_with_caveats` → read recommendations as usable within their stated caveats; check `advisorReadiness.caveats` first, and consider the post-mortem and behavior analytics for context. Consider acting only when these are clear; treat the output as advisory-only.
- `limited` → treat recommendations as exploratory notes only. The Advisor v2 preview will still emit, but with explicit caveats.
- `not_ready` → the Advisor v2 preview short-circuits with `status: "skipped_data_not_ready"`. Take no action; fix the data first.

In every case, recommendations remain **advisory-only**. Consider them only if `advisorReadiness.level` is `ready` or `usable_with_caveats`, and even then treat them as input to your own decision, not as instructions.

## 5. How to read provider diagnostics

`GET /dashboard/providers/diagnostics` is admin-only and read-only.

- The endpoint reads `getHealth()` snapshots from the in-memory provider registry. It never calls Powens / IBKR / Binance live.
- Every provider entry has a `status` from the closed enum `"ok" | "degraded" | "down" | "unknown" | "disabled"` and last-success / last-failure timestamps.
- Plain-language reading: `ok` = healthy locally; `degraded` = reachable but partial / unconfigured / disabled by flag; `down` = configured and clearly failing locally; `unknown` = no health check yet; `disabled` = registered but fully disabled by configuration.
- "Provider unconfigured" and "flag off" are reported as `degraded` with caveats, **never** as `down` — `down` is reserved for clearly configured + clearly failing local state.
- For deeper context, cross-reference with `GET /dashboard/data-quality`.

## 6. How the decision journal works

When you accept, reject, defer, or ignore a recommendation, record it via `POST /advisor/journal`. The structured fields are what the learning loop reads:

- `decision` (closed enum) — **the primary signal**.
- `reasonCode` (closed enum).
- `expectedOutcomeAt` (when do you expect to know if this was right).
- optional `metadata`.
- optional `freeNote` — **short, factual, non-sensitive**.

`POST /advisor/journal/{decisionId}/outcomes` lets you record the observed outcome later via `outcomeKind` (`positive`, `negative`, `neutral`, `mixed`, `unknown`) plus optional `learningTags`.

**`freeNote` rules.** Keep it short and factual. **Never** include: account numbers, secrets, tokens, signatures, raw transaction strings, raw provider payloads (Powens / IBKR / Binance JSON or XML), or highly personal details. If the note would need any of the above to be useful, leave it empty and rely on the structured fields. Replay and fine-tuning-readiness responses already strip `freeNote`; this rule is defense-in-depth.

## 7. How post-mortems work

Post-mortems (`POST /advisor/post-mortem/run`, internal-token + admin) sweep recommendations whose `expectedOutcomeAt` has passed and produce a structured artifact:

- summary,
- confidence calibration (previous → calibrated),
- evidence review (supported / contradicted / missing / stale signals),
- outcome drivers (likely / alternative / unknowns),
- lessons (keep / change / avoid),
- learning actions tagged `scope: "advisory-only"`.

The post-mortem scorer (PR4) **strictly bans** execution vocabulary in the model output. Any leakage flips the case to `failed`.

## 8. How evals work

`pnpm evals:run` runs the deterministic eval suite without any LLM, provider, or graph call:

- categories: `causal_reasoning`, `strategy_quality`, `risk_calibration`, `post_mortem_safety`, `closure_safety` (Macro Prompt 6).
- categories that require a live advisor snapshot are surfaced as `skipped` with an explicit reason — they are not fabricated.

The Macro Prompt 6 cases (`advisor_v2_committee_safety`, `replay_no_causality_overclaim`, `fine_tuning_gate_privacy`, `advisor_readiness_respected`) are **healthy baselines**: they pass by default and act as living documentation. Negative fixtures live in `packages/ai/src/evals/scorers/closure.test.ts`.

## 9. How the knowledge graph is populated

The canonical learning loop writes to **PostgreSQL first**. Decision journal entries, outcomes, and post-mortem outputs are persisted to Postgres unconditionally. The Knowledge Graph is an **optional enrichment** layer on top.

The graph is populated **only when all three** of the following hold:

1. `KNOWLEDGE_SERVICE_ENABLED=true`,
2. `ADVISOR_GRAPH_INGEST_ENABLED=true`,
3. the relevant graph hook runs successfully.

If any of those is false, you are still feeding the Advisor's canonical learning loop through Postgres — the graph simply isn't enriched yet. The journal, replay, evals, post-mortems, and behavior analytics all read from Postgres regardless.

The graph is **AI Advisor memory** for personal context only — it is not a trading execution channel.

To feed the learning loop over the next two weeks (graph on or off):

- record at least 1 decision per accepted recommendation,
- record at least 1 outcome on each decision after the expected horizon,
- run a post-mortem batch weekly **only if `AI_POST_MORTEM_ENABLED=true`** (admin trigger),
- review the eval trends weekly to catch drift early.

## 10. How replay works

`GET /dashboard/advisor/replay?windowDays=30` (admin-only):

- enumerates each recommendation in the window,
- attaches the most recent decision (closed enum) and the first recorded outcome kind (closed enum),
- attaches the linked post-mortem status (closed enum),
- surfaces patterns: `missing_outcome`, `repeated_negative_acceptance`, `stale_data_context`, `low_eval_confidence`, `unresolved_recommendation`,
- always reports `dataQualityAtReview: "current_only"` (historical data quality snapshots are not persisted in this macro),
- never returns raw `freeNote`, raw provider payloads, or any sentinel.

Patterns describe **observed counts**. They do not predict, do not claim causality, and do not encode a recommendation.

## 11. Why fine-tuning is NOT enabled now

`GET /dashboard/advisor/fine-tuning-readiness` is a deterministic **gate**, not a launcher. No fine-tuning code path exists in this repo, no training data is exported, and no fine-tuning API is called. The expected result for now is `not_recommended` or `premature`. The gate is conservative by design and ships with three default blockers:

- `privacy_export_plan_not_accepted`,
- `measurable_improvement_target_missing`,
- `rollback_plan_missing`.

Each of these requires an explicit operator/ADR sign-off before flipping. The gate also bans `post_mortem_emitted_execution_vocabulary` outright.

**Safe alternatives to exhaust first** (returned in every response):

- `prompt_template_versioning`,
- `deterministic_eval_expansion`,
- `retrieval_context_improvement`,
- `post_mortem_review`,
- `data_quality_improvement`.

Fine-tuning is only a candidate **after** these alternatives have been exhausted, the thresholds are met, and a privacy/export plan is signed off in an ADR.

## 12. What to check before trusting an Advisor output

1. `GET /dashboard/data-quality` — `advisorReadiness.level` should be `ready` or `usable_with_caveats`.
2. `GET /dashboard/providers/diagnostics` — sensitive providers should not be `down` or `degraded` for the dimensions feeding the recommendation.
3. The recommendation's `challengerStatus` should not be `flagged`.
4. The recommendation's `confidence` should match the evidence count in `evidence[]`.
5. If `replay` shows `repeated_negative_acceptance` for a similar recommendation type, pause and review.
6. If `eval_trends` shows a downward pass-rate trend in the relevant category, pause and review.

## 13. How to use the app daily for the next two weeks

**Daily (5–10 min).**

- Read the Daily Brief.
- For each new recommendation: skim title / whyNow / evidence / risk / reversibility. Decide: `accepted` / `rejected` / `deferred` / `ignored`. Record the decision in the journal with a reason code.
- Glance at `GET /dashboard/data-quality`. If readiness drops below `usable_with_caveats`, fix the upstream data before acting.

**Weekly (20–30 min).**

- Add outcomes to last week's accepted decisions.
- Run a post-mortem batch **only if you have intentionally enabled `AI_POST_MORTEM_ENABLED=true` or are manually triggering a run as admin**. The manual/admin trigger and the worker scheduler are two **independent gates** (`AI_POST_MORTEM_ENABLED` controls the runner; `AI_POST_MORTEM_AUTO_RUN_ENABLED` controls the cron). Both default to `false`.
- Review `GET /dashboard/advisor/replay?windowDays=30`. Look for `missing_outcome`, `repeated_negative_acceptance`, and `unresolved_recommendation` patterns.
- Check `GET /dashboard/advisor/behavior-analytics`.
- Review `GET /dashboard/advisor/evals/trends`.

**Bi-weekly (10 min).**

- Pull `GET /dashboard/advisor/fine-tuning-readiness`. The expected level is `not_recommended` / `premature` — that is intentional.
- Confirm `AI_ADVISOR_V2_ENABLED` is still `false` unless an ADR has explicitly flipped it.

## 14. What manual actions to do to fill the knowledge graph

First note: everything below populates **PostgreSQL** (canonical). The Knowledge Graph is enriched only when both `KNOWLEDGE_SERVICE_ENABLED=true` and `ADVISOR_GRAPH_INGEST_ENABLED=true` AND the graph hook succeeds. With the graph off you are still feeding the canonical learning loop.

1. Record decisions promptly via the structured fields (`decision`, `reasonCode`, `expectedOutcomeAt`); these are what replay, evals, and post-mortems read.
2. Record outcomes within `expectedOutcomeAt + 7 days` via `outcomeKind` and optional `learningTags`.
3. Use `freeNote` only when the structured fields are insufficient. Keep it short, factual, and non-sensitive. Never put account numbers, tokens, secrets, raw transaction strings, or raw provider payloads in it.
4. `learningTags` on outcomes propagate into replay and patterns — prefer them over prose.
5. When a post-mortem (only if you enabled it) identifies a `learning_action`, treat the action as a checklist item for the following week.

## 15. Warning signs that should stop you from trusting a recommendation

- Data quality dimension grade is `degraded` or `insufficient` for an input the recommendation depends on.
- The challenger flagged the recommendation (`challengerStatus: "flagged"`).
- Replay shows two or more accepted recommendations of the same type with negative outcomes in the last 30 days.
- The eval suite shows a recent regression in `causal_reasoning`, `strategy_quality`, or `risk_calibration`.
- Provider diagnostics shows `down` for the relevant sensitive provider.
- The Advisor v2 preview returns `status: "skipped_data_not_ready"`.
- The recommendation contains any execution vocabulary — this should be impossible by construction; if observed, treat as a bug and stop.

## 16. Advisory-only contract

The Advisor and every surface listed in this guide are **advisory only**. They produce structured opinions, not instructions. Trading, transfers, and any other execution action remain entirely the user's responsibility, performed outside Finance-OS, on the user's broker / bank / exchange directly.
