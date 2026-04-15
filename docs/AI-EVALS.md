# AI Evals

Last updated: 2026-04-15

## Purpose

Finance-OS evals are small, targeted guardrails, not a generic benchmark suite.

They exist to catch:

- weak transaction labeling
- recommendations with poor evidence
- overconfident or weakly causal reasoning
- challenger failures to call out missing signals
- cost states that should force degradation
- insufficient-data cases that should stay cautious

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

## Adding New Eval Cases

1. add a case in `packages/ai/src/evals/default-eval-cases.ts`
2. keep the case focused on one failure mode
3. store explicit expectations, not vague natural-language grading
4. update `run-advisor-evals.ts` if the new case needs a new assertion path
5. add or extend a direct test when logic changes materially

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

The current layer is intentionally small but real, queryable, and production-usable.
