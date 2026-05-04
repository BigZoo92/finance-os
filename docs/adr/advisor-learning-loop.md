# ADR: AI Advisor Learning Loop & Strategy Hypothesis Lab

> **Status**: Accepted (PR0 — documentation only, no runtime change)
> **Date**: 2026-05-04
> **Deciders**: Human + Claude (challenger/reviewer)
> **Related**: [trading-lab-quant-service.md](trading-lab-quant-service.md), [temporal-knowledge-graph-graphrag.md](temporal-knowledge-graph-graphrag.md), [model-routing-and-token-economics.md](model-routing-and-token-economics.md)

## Context

Finance-OS already has a deterministic-first AI Advisor, a paper-only Trading Lab, a Temporal Knowledge Graph, a cost ledger, and a deterministic eval runner. The proposed evolution adds:

1. A **Decision Journal** capturing the user's real accept/reject/defer/ignore choices over advisor recommendations across PEA, CTO, crypto and expenses.
2. A **Hypothesis Lab** surface that turns explicit theses into reproducible paper experiments.
3. A **Post-Mortem** loop that re-reads expired recommendations + decisions + outcomes and produces structured learnings (without ever crossing into execution).
4. New deterministic **evals** for `causal_reasoning`, `strategy_quality`, `risk_calibration`.

The core risk this ADR mitigates is twofold: **(a)** duplicating existing surfaces (Trading Lab strategies/scenarios/backtests, cost ledger, eval harness, knowledge graph nodes), and **(b)** letting an LLM-driven feedback loop drift Finance-OS away from its memory-boundary invariants (advisory only, paper only, no execution, deterministic-first).

### Existing assets the loop must reuse

- `aiRun`, `aiRecommendation`, `aiRecommendationChallenge`, `aiAssumptionLog`, `aiMacroSignal`, `aiNewsSignal` ([packages/db/src/schema/ai.ts](../../packages/db/src/schema/ai.ts))
- `aiCostLedger`, `aiModelUsage`, `computeAiBudgetState` ([packages/ai/src/orchestration/budget-policy.ts](../../packages/ai/src/orchestration/budget-policy.ts))
- `aiEvalCase`, `aiEvalRun`, `runAdvisorEvals` ([apps/api/src/routes/dashboard/domain/advisor/run-advisor-evals.ts](../../apps/api/src/routes/dashboard/domain/advisor/run-advisor-evals.ts))
- `tradingLabStrategy` (already supports `strategyType: 'manual-hypothesis'`, with `assumptions`, `caveats`, `entryRules`, `exitRules`, `riskRules`, `status`, `scope`)
- `tradingLabPaperScenario` (already carries `thesis`, `expectedOutcome`, `invalidationCriteria`, `riskNotes`, `status`, signal/strategy links)
- `tradingLabBacktestRun`, `tradingLabSignalLink`, `attentionItem`
- Knowledge graph ontology already declares `HypothesisEvent`, `LearningAction`, `DecisionPoint`, `Strategy`, `Scenario`, `Backtest`, `Recommendation`, `CostObservation`, `AssumptionLog` and the relations `SUPPORTS`, `CONTRADICTS`, `INVALIDATES`, `SUPERSEDES`, `VALIDATED_BY`, `INVALIDATED_BY`, `LEADS_TO`, `HAS_EVIDENCE` ([apps/knowledge-service/](../../apps/knowledge-service/))
- LLM provider pipeline: `runStructured` over Anthropic/OpenAI clients ([packages/ai/src/providers/](../../packages/ai/src/providers/))

## Decision

### 1. Domain boundaries (non-overlapping definitions)

The loop introduces conceptual entities. To avoid duplication, each one is defined by what it **owns** and what it **must not** own.

| Concept | Owner | Owns | Does not own |
|---|---|---|---|
| **Strategy** | `tradingLabStrategy` (existing) | Reusable parameterised rule set (entry/exit/risk rules, indicators, parameters). Long-lived, status `draft\|active-paper\|archived`. | A specific bet on a moment in time. |
| **Hypothesis** | `tradingLabStrategy` with `strategyType='manual-hypothesis'` (existing, **extended in PR3 only if needed**) | A falsifiable claim about market/asset behaviour, expressed as parameter set + invalidation conditions, suitable for backtesting and paper tracking. | The specific event that triggered the claim; the user's accept/reject of an advisor recommendation. |
| **Paper Scenario** | `tradingLabPaperScenario` (existing) | An event-anchored, time-boxed instance: ties a thesis to a triggering signal/news, declares expected outcome and invalidation, tracked through `open\|tracking\|invalidated\|confirmed\|archived`. | The reusable rule set behind it (that's a Strategy); the user's decision (that's the Journal). |
| **Advisor Decision Journal** | `advisorDecisionJournal` (**new in PR1**) | The user's real choice on an advisor recommendation: accepted / rejected / deferred / ignored, with `reasonCode`, free note, decided-by, decided-at, expected-outcome-at. Captures human ground truth. | The post-hoc learnings (those belong to Post-Mortem); the recommendation content itself (already in `aiRecommendation`). |
| **Advisor Post-Mortem** | `advisorPostMortem` (**new in PR4, behind flag**) | Structured retrospective on expired recommendations: findings, calibration deltas, learning tags, links to graph `LearningAction` nodes. LLM-produced, schema-validated, fail-soft. | New advisory directives; any execution-shaped output. |
| **`LearningAction` graph node** | knowledge-service (existing ontology) | Derived enrichment node: a learning crystallised in graph form, citable by future advisor runs as caveat/assumption. | Source of truth — never authoritative; never an instruction. Always tagged advisory-scope. |

The clean rule: **PostgreSQL is canonical for human-truth (decisions) and machine-truth (recommendations, runs, ledger, evals); the knowledge graph is enrichment**, consistent with `temporal-knowledge-graph-graphrag.md` and `trading-lab-quant-service.md`.

### 2. Should `strategy_hypothesis` be a new table?

**Decision: No, not now. Defer.**

A dedicated `strategy_hypothesis` table is **deferred** until at least one of the following triggers fires:

- (T1) A hypothesis must persist with a *lifecycle distinct* from a `tradingLabStrategy` (e.g. ephemeral hypotheses that never become strategies).
- (T2) Many hypotheses point to the same strategy with diverging invalidation criteria (1-to-N from strategy).
- (T3) A hypothesis must reference multiple paper scenarios across distinct underlyings (M-to-N).
- (T4) UI signal demands distinct list views (Hypothesis Lab as ranked claim feed) and the existing `tradingLabPaperScenario` listing is materially insufficient.
- (T5) Backtest reproducibility requires hashing a hypothesis independently of any strategy parameter set.

Until a trigger fires, hypotheses live as `tradingLabStrategy` rows where `strategyType='manual-hypothesis'`, with `tradingLabPaperScenario` rows attached for time-boxed instances and `tradingLabSignalLink` rows for evidence. Adding a third table now would duplicate `assumptions`, `caveats`, `thesis`, `expectedOutcome`, `invalidationCriteria` already present.

PR3 must re-evaluate this decision before writing code. If a new table proves necessary, it must be additive, scoped, and only carry fields the existing two tables cannot represent.

### 3. Schema direction — start with Decision Journal

**The Decision Journal is the single piece of human ground truth Finance-OS does not yet have.** It is also the cheapest to ship correctly (CRUD only, no LLM, no graph dependency, no quant-service dependency) and unblocks every other PR:

- Post-Mortem cannot exist meaningfully without decisions to review.
- `strategy_quality` and `risk_calibration` evals need decision outcomes to score against.
- Hypothesis Lab benefits from being able to link a hypothesis to the decisions it informed.

Hence PR1 ships the Journal first.

### 4. What must NOT be duplicated

| Existing surface | New code may | New code must not |
|---|---|---|
| `aiCostLedger` / `aiModelUsage` / `computeAiBudgetState` | Read budget state to gate Post-Mortem; write through existing providers. | Define a parallel cost table, parallel pricing registry, parallel budget calculator. |
| `aiEvalCase` / `aiEvalRun` | Add new `category` values (`causal_reasoning`, `strategy_quality`, `risk_calibration`); add deterministic scorer modules; add a CLI runner. | Create a parallel eval table or a parallel run table. The `category` column is `text`, so no enum migration is required. |
| `tradingLabBacktestRun` | Be referenced from new entities via FK. | Re-implement backtest persistence; re-implement equity curve / drawdowns / metrics shape. |
| `tradingLabPaperScenario` | Be referenced and extended via existing fields. | Re-implement thesis/invalidation tracking under a different name. |
| `tradingLabStrategy` (incl. `strategyType='manual-hypothesis'`) | Be the carrier of hypotheses until trigger T1–T5 fires. | Be shadowed by a parallel hypothesis table without ADR amendment. |
| knowledge-service backend (Neo4j/Qdrant + JSON fallback) | Ingest new `DecisionPoint`, `HypothesisEvent`, `LearningAction` events through existing `/knowledge/ingest/*` routes (best-effort). | Stand up a second graph store or bypass the service. |
| LLM provider pipeline (`runStructured` + Anthropic/OpenAI clients) | Add new prompt templates and JSON schemas; reuse the runner. | Open a third provider integration or a side-channel HTTP call to LLMs. |
| Trading Lab API contracts | Add new endpoints under `/dashboard/advisor/journal`, `/dashboard/advisor/post-mortem`, `/dashboard/hypothesis-lab` (or extend trading-lab namespace if no new table is added). | Modify the response shape of any existing `/dashboard/trading-lab/*` or `/dashboard/advisor/*` endpoint. |

### 5. Safety constraints (binding)

These constraints are non-negotiable. Any PR that violates them is rejected at review.

- **No execution.** No buy / sell / transfer / order / convert / withdrawal / staking / margin / futures path is introduced anywhere — API, worker, quant-service, knowledge-service, UI.
- **No provider write path.** IBKR, Binance, Powens remain strictly read-only. The loop reads historical normalised data only; it never re-fetches via provider write APIs.
- **No raw provider payloads in advisor context.** The advisor context bundle keeps consuming the compact `advisor_investment_context_bundle`. Raw IBKR XML, Binance JSON, signed URLs, or provider credentials never enter prompts, logs, eval cases, or browser responses.
- **Demo determinism.** Demo mode performs no DB writes, no provider calls, no LLM calls, no graph mutations. Every new endpoint must return deterministic fixtures in demo and bypass the LLM/quant/knowledge services entirely.
- **Admin-only mutation.** All `POST/PATCH/DELETE` introduced by the loop are admin-only and gated by the existing auth middleware.
- **Post-Mortem feature flag + budget gate.** Post-Mortem is dark-launched behind `AI_POST_MORTEM_ENABLED=false` (default) and additionally gated by `computeAiBudgetState().deepAnalysisAllowed`. A flag-off code path is the default branch; the LLM call site is unreachable when off.
- **No provider calls on GET.** All new GET routes resolve from PostgreSQL (and knowledge-service read endpoints when admin) — never from a provider sync triggered by the request.
- **No secret-bearing `VITE_*`.** No new client-exposed env var carries credentials, model keys, or signed URLs.
- **Knowledge graph ingestion is best-effort, fail-soft.** A graph ingest failure never fails the parent transaction; logs the error structured; UI degrades gracefully.
- **Memory boundary.** New `LearningAction` and `DecisionPoint` graph nodes must be tagged `scope: 'advisory-only'` at ingest. The ontology is enrichment, never instruction. No code path treats a graph node as an order, a target weight, or a directive.
- **Logging.** Decision notes, post-mortem findings, and journal entries are PII-adjacent — they describe the user's financial choices. Existing structured-log redaction patterns apply; no free-text user notes are emitted to provider telemetry.

### 6. Eval-first rule

Post-Mortem must not ship before the deterministic evals it relies on. Concretely:

- **PR2 must precede PR4.** PR4 cannot be merged until PR2 has landed and is green in CI.
- **Three new categories** are added to `aiEvalCase.category`: `causal_reasoning`, `strategy_quality`, `risk_calibration`. The column is already `text`, so no enum migration is required.
- **Three new deterministic scorer modules** under `packages/ai/src/evals/scorers/` produce pass/fail signals against structured advisor output (no LLM-as-judge).
- **A guardrail eval case** is added at PR4 and named:

  ```
  post_mortem_does_not_emit_execution_directives
  ```

  It rejects any post-mortem output containing execution vocabulary (regex over a banlist: `buy`, `sell`, `vendre`, `acheter`, `transfer`, `transférer`, `withdraw`, `place order`, `passer un ordre`, `convertir`, `swap`, `bridge`, `stake`, etc.) under any depth in the structured payload. The case fails the run rather than degrading it; it is `active=true` from PR4 day one.

- **Eval scorecard regression**: the daily eval run must compare current pass rate per category against a 7-day rolling baseline; a regression tags the run as `degraded` in `aiEvalRun.status`.

### 7. Implementation order — 5 non-breaking PRs after PR0

| PR | Scope | LLM? | Migration? | Feature flag? | Depends on |
|---|---|---|---|---|---|
| **PR0** *(this ADR)* | Documentation only. | No | No | — | — |
| **PR1** | `advisorDecisionJournal` + `advisorDecisionOutcome` schemas, repository, admin-only routes (`POST/GET /dashboard/advisor/journal`), demo fixtures, integration tests. No LLM. | No | Yes (additive) | — | PR0 |
| **PR2** | New eval categories (`causal_reasoning`, `strategy_quality`, `risk_calibration`), deterministic scorers, CLI runner (`pnpm evals:run`), trend snapshot endpoint. No LLM-as-judge. | No (deterministic) | No (text column) | — | PR0 |
| **PR3** | Hypothesis Lab minimal model. **First**: extend `tradingLabStrategy` use of `strategyType='manual-hypothesis'` with helper repo functions + read endpoints. **Only if T1–T5 fires**: add a dedicated `strategyHypothesis` table with an ADR amendment. | No | Conditional | — | PR1 (linkage to Journal) |
| **PR4** | Post-Mortem prompt + JSON schema in `packages/ai/src/{prompts,schemas}/post-mortem.ts`, `runPostMortem` use-case, worker scheduler, `LearningAction` graph ingest, `advisorPostMortem` table. | Yes | Yes (additive) | `AI_POST_MORTEM_ENABLED` (default off) + budget gate | PR1 + PR2 (eval guardrails) + PR3 (hypothesis links) |
| **PR5** | UI: decision recorder on advisor cards, Hypothesis Lab surface, eval scorecard widget, post-mortem feed. Update `docs/context/FEATURES.md`, `docs/agentic/skill-routing.md`, `DESIGN.md`. | No (read-only client) | No | `LEARNING_LOOP_UI_ENABLED` (default off until PR1–PR4 are in prod) | PR1–PR4 |

PR2 can be built in parallel with PR1 as it touches a disjoint code path. PR3 may pull forward only its read-side helpers if it does not block PR1. PR4 must not start before PR2 is merged.

### 8. Acceptance checklist for every future PR in this loop

Each PR must self-assert all of:

- [ ] Additive only — no breaking change to existing API contracts, response shapes, DB columns, env var semantics.
- [ ] Demo/admin split preserved — demo path verified to perform no DB writes, no provider calls, no LLM calls, no graph mutations.
- [ ] No provider calls on GET routes.
- [ ] No LLM calls in demo mode.
- [ ] No new code path that touches buy/sell/transfer/order primitives anywhere in the stack.
- [ ] No duplication of `aiCostLedger`, `aiModelUsage`, `aiEvalCase`, `aiEvalRun`, `tradingLabBacktestRun`, `tradingLabPaperScenario`, knowledge-service backend, or the LLM provider pipeline.
- [ ] Every LLM-produced persisted artifact has a JSON schema in `packages/ai/src/schemas/` and validation is enforced before write.
- [ ] Every new eval scorer has deterministic unit tests with fixture inputs.
- [ ] Migrations are added only when the domain model has been validated by tests on at least one realistic fixture.
- [ ] Knowledge graph ingest is best-effort; the parent transaction does not roll back on graph failure.
- [ ] No secret-bearing `VITE_*`. No raw provider payloads in logs, prompts, or browser responses.
- [ ] `gitnexus_impact` and `gitnexus_detect_changes` run cleanly per [CLAUDE.md](../../CLAUDE.md) before the PR opens.
- [ ] CI green: typecheck (with `exactOptionalPropertyTypes`), lint, unit, integration, eval suite.

## Alternatives Considered

| Alternative | Rejected because |
|---|---|
| Add a dedicated `strategy_hypothesis` table now | Duplicates `tradingLabStrategy(strategyType='manual-hypothesis')` + `tradingLabPaperScenario` (`thesis`, `expectedOutcome`, `invalidationCriteria`). Premature abstraction. Re-evaluated at PR3 against triggers T1–T5. |
| Put Decision Journal entries inside `aiAssumptionLog` | `aiAssumptionLog` records *input* assumptions of an advisor run; the Journal records *output* decisions by the user. Conflating them breaks the input/output asymmetry the post-mortem relies on. |
| Build Post-Mortem first, Decision Journal later | Post-Mortem without a Journal degenerates into LLM rumination over its own past output. Useful learning requires human-truth as anchor. |
| Use LLM-as-judge for new evals | Non-deterministic, costs tokens per CI run, opens an attack surface. Deterministic scorers over structured output match the existing harness. |
| Skip the feature flag on Post-Mortem | A daily LLM batch with no kill-switch can blow the budget or emit problematic outputs before a human notices. Flag + budget gate is cheap insurance. |
| Have the knowledge graph be source of truth for decisions/learnings | Violates the existing memory boundary in [CLAUDE.md](../../CLAUDE.md): the graph is enrichment, not authoritative. PostgreSQL stays canonical. |
| Add a worker job for evals | The existing inline `runAdvisorEvals` already runs per advisor run. A separate scheduler is value-additive only after PR2 lands and trend data exists; reconsider then. |

## Consequences

### Positive
- Captures genuine human ground truth (Decision Journal) Finance-OS lacks today.
- Reuses every existing surface — no parallel cost ledger, eval system, backtest runner, graph backend, or LLM pipeline.
- Eval-first sequencing prevents the LLM post-mortem from drifting into execution-shaped output.
- Feature flags and budget gates make the LLM-driven step rollback-safe.
- Defers the most expensive design choice (`strategy_hypothesis` table) until empirical signal justifies it.

### Negative
- Five-PR sequence increases coordination cost compared to a single feature branch.
- The deferred-table decision means PR3 re-opens design discussion mid-track (acceptable cost for avoiding a redundant table).
- Decision Journal entries are PII-adjacent; logging discipline must be tight from day one.

### Risks
- **Self-reinforcing feedback drift.** Post-Mortem could overfit on its own past errors. Mitigation: post-mortem findings are injected as *assumptions + caveats* into future advisor context, never as directives, and the deterministic finance-engine remains first.
- **Memory boundary leak.** A future contributor could read a `LearningAction` node as an order. Mitigation: ingest tagging (`scope: 'advisory-only'`), API assertion that no execution-path consumer can resolve graph nodes, periodic eval against the execution-vocabulary banlist.
- **Cost explosion.** Daily Post-Mortem × N expired recommendations × LLM tokens. Mitigation: batched single-prompt design (one post-mortem covers all expirations of the day), `deepAnalysisAllowed` gate, hard daily ceiling reused from `computeAiBudgetState`.
- **Eval-category sprawl.** Adding three categories to a `text` column without grouping makes the UI noisy. Mitigation: introduce a `categoryGroup` projection (`quality | safety | economics`) at the read layer in PR2; defer any DB enum.
- **Schema regret on hypothesis modelling.** If T1–T5 fires post-PR3, migrating from extended `tradingLabStrategy` to a dedicated table becomes a real migration. Mitigation: PR3 explicitly re-evaluates triggers and amends this ADR rather than silently introducing a new table.

## Implementation Notes

- New skills/code paths must be charged against the routing in [docs/agentic/skill-routing.md](../agentic/skill-routing.md); update that file in PR5.
- New env vars: `AI_POST_MORTEM_ENABLED` (default `false`), `LEARNING_LOOP_UI_ENABLED` (default `false`). Document in [docs/context/ENV-REFERENCE.md](../context/ENV-REFERENCE.md) at the PR that introduces them.
- New endpoint namespace decision: Decision Journal lives under `/dashboard/advisor/journal` (it is advisor-domain). Post-Mortem lives under `/dashboard/advisor/post-mortem`. Hypothesis Lab read endpoints initially live under `/dashboard/trading-lab/hypotheses` (because hypotheses are still `tradingLabStrategy` rows); a top-level `/dashboard/hypothesis-lab` namespace is created only if PR3 introduces a dedicated table.
- Worker integration follows the pattern of [apps/worker/src/advisor-daily-scheduler.ts](../../apps/worker/src/advisor-daily-scheduler.ts): Redis lock, internal HTTP trigger, env-driven cron.
- Knowledge graph ingestion paths: `DecisionPoint` from PR1 onward via `/knowledge/ingest/advisor` (extend if needed); `LearningAction` from PR4 via the same endpoint; both tagged `scope: 'advisory-only'`.
- All new prompt templates carry a `templateKey` + `version` consistent with `aiPromptTemplate`, so future prompt mutations are traceable.

## Open Questions (to resolve before the relevant PR)

- **Q1 (PR1)**: Decision `reasonCode` enum — bootstrap with `{accepted, rejected_low_confidence, rejected_disagree_thesis, deferred_need_more_data, ignored_no_action, other}` or wider? Default proposal: start narrow; widen only on demand.
- **Q2 (PR2)**: Should the eval CLI runner write to `aiEvalRun` (mixing CI + production runs) or a separate sink? Default proposal: write with `triggerSource='cli'` so the existing table stays canonical.
- **Q3 (PR3)**: At PR3 kickoff, formally evaluate triggers T1–T5 and either extend `tradingLabStrategy` helpers or amend this ADR for a dedicated table.
- **Q4 (PR4)**: Post-Mortem cadence — daily aggregate, weekly aggregate, or per-recommendation horizon? Default proposal: daily aggregate over expirations of the day, single LLM call.
- **Q5 (PR5)**: Decision recorder placement — inline on each recommendation card, or in a dedicated panel? Default proposal: inline, with a `<DecisionRecorder/>` component that can be feature-flag-hidden.
