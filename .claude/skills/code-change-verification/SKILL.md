<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/code-change-verification/SKILL.md
     Hash:   sha256:4103f9fede79b04f
     Sync:   pnpm agent:skills:sync -->

---
name: code-change-verification
description: Run the smallest reliable verification set for a Finance-OS change and report concrete evidence. Use after code, docs, AGENTS, or skill changes when you need exact commands, pass/fail status, and any remaining verification gaps.
---

# Code Change Verification

## Trigger

- Use after making a change and before summarizing it.
- Use when the changed scope spans API, web, worker, packages, docs, or repo-local skills and the right checks are not obvious.

## Inputs

- Changed files or diff
- Risky runtime surfaces
- Available local commands

## Output

- Produce a verification report with:
- commands run
- pass or fail status
- notable output or failures
- remaining gaps or manual checks still needed

## Workflow

1. Start from [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) and the nearest local `AGENTS.md`.
2. Run the smallest relevant checks first instead of defaulting to the full repo suite.
3. For medium-high risk changes, include the checklist and decision trees from [../../../docs/agentic/policy-verification-bundle.md](../../../docs/agentic/policy-verification-bundle.md) in the verification note.
4. Include the agentic validator when `AGENTS.md`, `.agents/skills/`, or `docs/agentic/` changed.
5. Escalate to broader checks only if the scope or failures justify it.

## Trigger Examples

- "What should I run to verify this web loader and dashboard query change?"
- "I changed AGENTS and skills only. Run the right validation and tell me what still needs manual review."

## Verification

- Use [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) as the command map.
- Include `node .agents/skills/scripts/validate-agent-foundation.mjs` when the agentic layer changed.
