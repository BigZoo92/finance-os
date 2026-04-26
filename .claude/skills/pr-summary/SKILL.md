<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/pr-summary/SKILL.md
     Hash:   sha256:40a826b05a256055
     Sync:   pnpm agent:skills:sync -->

---
name: pr-summary
description: Draft a clean Finance-OS PR or patch summary with concrete risk and test evidence. Use after implementation or review when you need a concise final write-up with what changed, verification, and rollback notes.
---

# PR Summary

## Trigger

- Use after implementation is complete.
- Use when the final report or PR comment should be short, risk-aware, and grounded in real verification.

## Inputs

- Final diff or changed files
- Verification results
- Remaining risks or manual checks

## Output

- Produce a short summary with:
- what changed
- risk level and reason
- test evidence
- rollback or follow-up note when relevant

## Workflow

1. Pull the output of [../../../.agents/skills/code-change-verification/SKILL.md](../../../.agents/skills/code-change-verification/SKILL.md).
2. Use [../../../docs/agentic/code_review.md](../../../docs/agentic/code_review.md) to frame severity honestly.
3. Mention docs, AGENTS, or skill updates when the implementation changed repo guidance.
4. Keep the summary compact; include only the highest-signal verification and risk details.

## Trigger Examples

- "Write the final summary for this agentic foundation patch with risk and verification."
- "Draft a PR note for this dashboard/API change with real test evidence and rollback notes."

## Verification

- Reference [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) for the checks that were run.
- Reference [../../../docs/agentic/release-map.md](../../../docs/agentic/release-map.md) when the change touched deploy or workflow behavior.
