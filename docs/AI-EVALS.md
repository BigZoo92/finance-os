# AI Evals

Last updated: 2026-04-26

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
