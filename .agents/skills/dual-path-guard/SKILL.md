---
name: dual-path-guard
description: Verify Finance-OS demo/admin dual-path correctness. Use when auth, dashboard reads, Powens routes, SSR auth fallback, or loader/query behavior changes and you need to confirm demo short-circuits, admin gating, and UI restrictions still hold.
---

# Dual Path Guard

## Trigger

- Use for auth or session changes.
- Use for dashboard, Powens, or loader changes that can accidentally bypass the demo short-circuit or weaken admin gating.

## Inputs

- Changed files
- Affected route or loader path
- Expected demo and admin behavior

## Output

- Produce a pass or fail review note with:
- findings ordered by severity
- file references for each break or risk
- missing tests or manual checks

## Workflow

1. Read [../../../AGENTS.md](../../../AGENTS.md), [../../../apps/api/AGENTS.md](../../../apps/api/AGENTS.md), and [../../../apps/web/AGENTS.md](../../../apps/web/AGENTS.md).
2. Use the dual-path decision tree in [../../../docs/agentic/policy-verification-bundle.md](../../../docs/agentic/policy-verification-bundle.md) to classify each touched flow as pass/fail.
3. Confirm demo returns or mocks happen before DB, Redis, or provider calls.
4. Confirm admin-only actions remain gated in both API and UI surfaces.
5. Confirm SSR auth fallback still lands in demo cleanly instead of failing hard or flashing the wrong state.
6. Require explicit negative-test evidence for: demo no-live-calls, demo no-writes, and unauthorized admin mutation denial.

## Trigger Examples

- "Check that this new dashboard query still stays mock-only in demo mode."
- "Review whether this Powens callback change still allows signed state without exposing admin-only actions."

## Verification

- Use [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md) for route expectations.
- Use [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) to decide whether the current coverage is enough.
- Mirror the acceptance criteria and required negative tests in [../../../docs/agentic/policy-verification-bundle.md](../../../docs/agentic/policy-verification-bundle.md) for medium-high risk changes.
