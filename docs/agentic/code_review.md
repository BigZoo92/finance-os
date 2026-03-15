# Code Review Guide

Use this guide for reviews in this repo.

## Severity

- `P0`: secret leak, Powens token/code exposure, data loss, broken demo/admin split, broken auth boundary
- `P1`: contract regression, missing demo short-circuit, missing behavior-change tests, SSR auth inconsistency, unsafe logging, env drift
- `P2`: style, local cleanup, or small maintainability notes

## Always Check

- Demo/admin dual-path correctness
- No secrets in `VITE_*`
- No unsafe logging or raw provider payload leakage
- Required HTTP contracts still exist and still return the expected auth-safe shape
- Verification matches the changed scope

## UI-Specific Checks

- Loading, empty, error, and success states exist
- Auth state does not flash incorrectly on first render
- PR notes include UI rationale and screenshot notes for meaningful UI changes

## Usually Ignore

- Pure wording or formatting nits unless the PR is docs-only
- Personal style preferences that do not affect behavior, safety, or maintainability
- Suggestions that would redesign working automation without explicit scope

## Review Mindset

- Prefer concrete findings with file references and expected impact.
- If a code change altered architecture, contracts, env, testing expectations, or review guidance, expect the nearby `AGENTS.md` and `docs/agentic` map to be updated too.
