<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/test-coverage-improver/SKILL.md
     Hash:   sha256:1e56b9ade54603b2
     Sync:   pnpm agent:skills:sync -->

---
name: test-coverage-improver
description: Identify the highest-leverage missing tests for a Finance-OS change. Use when behavior changed but coverage is thin and you need a small, prioritized list of test additions rather than a broad testing wishlist.
---

# Test Coverage Improver

## Trigger

- Use when a behavior change landed in an area with weak coverage.
- Use when you need to prioritize the next one to three tests, assign clear priority, and close the most important test gap first.

## Inputs

- Changed files
- Existing tests near the change
- Remaining risks after current verification

## Output

- Produce a prioritized test gap list with:
- priority order
- target file or suite
- assertion to add
- why it is the highest-leverage gap

## Workflow

1. Start from [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md).
2. Compare the changed behavior to the nearest existing test file before proposing anything new.
3. Prefer a few focused additions over broad, low-signal coverage ideas.
4. Call out when only manual verification exists today, especially for worker or UI-heavy paths.

## Trigger Examples

- "What are the top missing tests for this Powens callback change?"
- "I changed dashboard route behavior. Give me the two most valuable test additions, not a full testing essay."

## Verification

- Use [../../../apps/api/AGENTS.md](../../../apps/api/AGENTS.md), [../../../apps/web/AGENTS.md](../../../apps/web/AGENTS.md), and [../../../apps/worker/AGENTS.md](../../../apps/worker/AGENTS.md) for local expectations.
- Reuse the automated coverage list in [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md).
