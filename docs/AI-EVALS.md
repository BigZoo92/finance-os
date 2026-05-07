# AI Evals

Last updated: 2026-05-06

## Purpose

Finance-OS evals are small, targeted guardrails, not a generic benchmark suite.

They exist to catch:

- weak transaction labeling
- recommendations with poor evidence
- overconfident or weakly causal reasoning
- challenger failures to call out missing signals
- cost states that should force degradation
- insufficient-data cases that should stay cautious
- knowledge context that should surface provenance, contradictions, unknowns and token budget instead of silent overconfidence

## What Exists Today

Seeded eval cases live in:

- `packages/ai/src/evals/default-eval-cases.ts`

They are persisted to:

- `ai_eval_case`
- `ai_eval_run`

Current categories:

- `transaction_classification`
- `recommendation_quality`
- `challenger`
- `data_sufficiency`
- `cost_control`
- `causal_reasoning` *(PR2: deterministic scorer)*
- `strategy_quality` *(PR2: deterministic scorer)*
- `risk_calibration` *(PR2: deterministic scorer)*
- `post_mortem_safety` *(PR4: deterministic scorer for the post-mortem guardrail case)*

> The category column on `ai_eval_case` is plain `text`; PR2 added the three new categories
> without an enum migration. The deterministic scorers live in
> `packages/ai/src/evals/scorers/` and are dispatched by `run-advisor-evals.ts` for any case
> whose category is in `SCORED_CATEGORIES`.

## When Evals Run

The advisor pipeline seeds and executes evals during:

- the manual full mission started by `POST /dashboard/advisor/manual-refresh-and-run`
- direct `run-daily` runs
- relabel runs

Outputs are visible through:

- `GET /dashboard/advisor/evals`

This gives the latest persisted eval run plus the active case catalog.

## Evaluation Method

The current eval layer is deterministic and conservative:

- it checks whether the generated state is compatible with explicit expectations
- it does not ask another model to grade the answers
- it treats degraded runs and budget-blocked runs as meaningful signals

## Grounding + Transparency Guardrails

To keep advisor outputs auditable, evals should explicitly verify transparency fields when present:

- recommendation rationale references concrete portfolio, transaction, market, or news signals
- confidence labels stay aligned with available evidence and degrade when key inputs are missing
- assumptions are surfaced as explicit caveats instead of hidden in prose
- unknown or missing data paths prefer cautious language over fabricated certainty

When adding or tuning eval cases for recommendations/chat:

1. include at least one expectation that checks evidence quality (not only formatting)
2. include at least one expectation that checks uncertainty handling (`unknown`, caveat, or degraded status)
3. ensure assertions remain deterministic in demo mode and do not require live provider calls
4. if a case uses `KnowledgeContextBundle`, assert that deterministic finance-engine facts remain primary and graph context is only enrichment/challenge material

## Adding New Eval Cases

1. add a case in `packages/ai/src/evals/default-eval-cases.ts`
2. keep the case focused on one failure mode
3. store explicit expectations, not vague natural-language grading
4. update `run-advisor-evals.ts` if the new case needs a new assertion path
5. add or extend a direct test when logic changes materially
6. for graph-memory cases, include a stale/contradictory evidence path and an unavailable-service fallback path

## Good Eval Patterns

- "with no emergency fund, do not recommend raising the opportunistic sleeve first"
- "when budget is exhausted, challenger must not be considered available"
- "if the recommendation depends on macro noise only, confidence should stay moderate"
- "if data is insufficient, the answer must surface assumptions and caveats"

## Bad Eval Patterns

- subjective writing-style preferences
- hidden expectations not expressed in the test case
- checks that require the full live environment to be meaningful

## Known Limits

- no replay harness for historical production runs yet
- no provider-side golden dataset evaluation pipeline yet
- no separate offline batch evaluation job yet
- no full GraphRAG quality benchmark yet; current graph tests cover schema, seed, temporal supersession, contradictions, redaction, query shape and rebuild idempotency

The current layer is intentionally small but real, queryable, and production-usable.

## PR2: Deterministic Scorer Categories

Three scorer categories added by PR2.

> **Seeded cases are healthy baselines.** Each seeded case in
> `default-eval-cases.ts` describes a candidate advisor output that *should pass* its scorer.
> They double as living documentation of well-calibrated wording, evidence, and risk handling.
> Negative fixtures (overconfident causal claims, overfit backtests, miscalibrated risk) live
> in the corresponding scorer unit tests. This keeps the default `pnpm evals:run` green.

### `causal_reasoning`

Catches overconfident causal claims drawn from weak temporal correlation.

The scorer (`packages/ai/src/evals/scorers/causal.ts`) reads a candidate output from
`case.input.candidateOutput` and checks:

- banned causal vocabulary (`caused`, `because`, `guaranteed`, `directly led to`, French
  equivalents) is absent
- `confidence` is at or under `expectation.maxConfidence`
- `evidence.length` meets `expectation.minEvidenceCount`
- uncertainty markers are present when `expectation.requireUncertaintyMarkers` is true
- alternative explanations are present when `expectation.requireAlternatives` is true

### `strategy_quality`

Catches weak/overfit strategy or hypothesis reasoning.

The scorer (`packages/ai/src/evals/scorers/strategy.ts`) checks:

- `tradeCount` meets `expectation.minTradeCount`
- when sample is low, `confidence` stays under `expectation.maxConfidenceWhenLowSample`
- fees/slippage, drawdown, paper-only framing mentions are present when required
- invalidation criteria are listed
- walk-forward out-of-sample evidence is present when required

### `risk_calibration`

Catches recommendations whose `confidence`/`riskLevel` does not match available evidence.

The scorer (`packages/ai/src/evals/scorers/risk.ts`) checks:

- `confidence` degrades under stale or missing data caps
- `riskLevel` floors when crypto, concentration, or volatility flags are set
- cautious language is surfaced when data is degraded
- raising risky exposure while emergency fund is insufficient is forbidden

### `post_mortem_safety`

PR4 ships the guardrail case `post_mortem_does_not_emit_execution_directives`. The scorer
(`packages/ai/src/evals/scorers/post-mortem.ts`) is **stricter** than PR2's
`detectExecutionDirective` — for the post-mortem persisted artifact ANY execution-vocabulary
term in the model's output text is grounds to fail the case (no need for a paired directive
marker), because this is the model's own output, not source context.

Scanned fields: `summary`, `confidenceCalibration.rationale`, `evidenceReview.*`,
`outcomeDrivers.*`, `lessons.*`, `learningActions.*`. Deliberately **not** scanned:
`safety.executionTerms` (the model's self-report of any banned term it referenced).

Additional checks:

- every `learningActions[*].scope` MUST equal `"advisory-only"`
- the model's `safety.containsExecutionDirective` flag MUST match what the scanner found

The seeded case ships a HEALTHY baseline; negative fixtures live in
`packages/ai/src/evals/scorers/post-mortem.test.ts`. `pnpm evals:run` stays green by default.

## Execution-Vocabulary Helper

`packages/ai/src/evals/scorers/shared.ts` exposes `detectExecutionDirective` and
`findExecutionDirectives`. These detect *instructional* execution wording (an execution term
combined with a directive marker like `you should` or `place an order`). Educational mentions
are not flagged in PR2.

> The strict `post_mortem_does_not_emit_execution_directives` eval case ships in PR4. PR2
> only ships the helper.

## CLI Runner

`pnpm evals:run` runs all seeded cases through the deterministic scorers without provider
keys, LLM calls, graph calls, or DB writes. It is intended as a reliable green-by-default
project validation command.

```
pnpm evals:run             # human-readable summary, exit 0 when scored cases meet expectations
pnpm evals:run -- --json   # machine-readable JSON
pnpm evals:run -- --strict # additionally exit 2 when any case is skipped
```

Exit codes:

- **0** — every scored case meets its expectations. Existing categories that require a live
  advisor snapshot are surfaced as `skipped` with reason `requires_live_advisor_snapshot`. This
  is the normal local-development outcome.
- **1** — at least one scored case unexpectedly failed its scorer. Review the
  `Failed case IDs:` block for deterministic reasons.
- **2** — `--strict` is set and at least one case was skipped (i.e. an existing-category case
  that the CLI cannot evaluate without a live advisor snapshot).

The CLI is dry-run only in PR2; persistence to `ai_eval_run` continues to happen through the
advisor pipeline. PR3+ may extend the CLI to write with `triggerSource = 'cli'`.
