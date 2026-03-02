## Summary

<!-- What does this PR change? Keep it small and focused. -->

## Why

<!-- Why is this change needed? Link issue/spec if available. -->

## Scope (no-refactor)

- [ ] This PR is intentionally small and scoped.
- [ ] No unrelated refactor was introduced.

## Definition of Done (DoD)

- [ ] Acceptance criteria are met.
- [ ] Demo path and admin path are both covered where applicable.
- [ ] Observability/logging impacts are documented.
- [ ] Risks and rollback notes are documented.
- [ ] CI is green.
- [ ] If contracts/arch/env changed: docs + AGENT(S).md updated.
- [ ] No secrets exposed to client (no sensitive `VITE_*`).

## Breakpoints

- [ ] **BP1 — Spec validated**: goal, non-goals, acceptance criteria confirmed.
- [ ] **BP2 — Implementation validated**: dual-path demo/admin behavior checked.
- [ ] **BP3 — Ready to ship**: flags/kill-switch + monitoring ready, merge approved.

## ENV / API Keys (mandatory)

> If no environment change, explicitly write `None`.

- New/updated env vars:
- New/updated API keys/secrets:
- How to obtain keys (steps/links):
- Where to set in prod (Dokploy: web/api/worker):
- Rotation/backfill/migration notes:
- Failure mode + fallback:

## Demo/Admin Dual-Path Validation

- Demo path tested:
- Admin path tested:

## Observability

- Logs/metrics/traces added or updated:
- Alerts/dashboards impacted:
- Request IDs / correlation impact:

## UI Screenshots

> Required for UI changes. If not applicable, write `N/A`.

- Before:
- After:

## Flags / Rollout (if applicable)

- Feature flag / kill-switch:
- Rollout notes:

## Risks

- Risk level (low/med/high):
- Main risks:
- Rollback plan:

## Test Plan

- [ ] Unit tests
- [ ] Integration tests
- [ ] Manual checks

Commands run:

```bash
# paste commands and results
```
