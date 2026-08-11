---
name: finance-os-change-verification
description: Review and verify a Finance-OS change across contracts, tests, docs, and dependent flows. Use for implementation planning, code review, regression coverage, final validation, or PR-ready summaries.
---

# Change verification

This skill is for repository-specific closure, not generic style review.

## Before implementation

1. Read the nearest `AGENTS.md` and select only the specialist skills that match the change.
2. Query GitNexus for the execution flow, then run upstream impact on every symbol to edit.
3. Write down affected contracts: demo/admin, API shape, env, storage, jobs, observability, UI states, and operator docs.

## Review order

1. P0: secrets, data loss, unauthorized provider/DB access, trading/execution paths.
2. P1: broken demo/admin split, contract drift, unsafe errors/logs, auth/SSR flash, missing behavior tests, broken probes.
3. P2: maintainability, local duplication, naming, or presentation.

For each finding cite a file and line, describe the observable failure, and propose the smallest correction. Do not manufacture findings to fill severity buckets.

## Verification ladder

- Start with the narrowest unit/contract test.
- Run package lint/typecheck/test for touched workspaces.
- Run `pnpm test`, `pnpm docs:check`, and `pnpm agent:skills:check` for repo tooling or documentation changes.
- Escalate to `pnpm check:ci`, builds, E2E, or smoke tests in proportion to risk.
- Run `git diff --check`, GitNexus change detection, and search for removed paths before handoff.

Report commands as PASS/FAIL, distinguish pre-existing failures, and state what was not run. Do not commit, push, deploy, or mutate external systems unless requested.
