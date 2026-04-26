<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/repo-recall/SKILL.md
     Hash:   sha256:135bf7e17cc4bcef
     Sync:   pnpm agent:skills:sync -->

---
name: repo-recall
description: Rebuild fast orientation in Finance-OS from repo-native docs instead of re-scanning the whole monorepo. Use at the start of a task when you need the shortest path to architecture, contracts, testing, release, and local AGENTS guidance.
---

# Repo Recall

## Trigger

- Use at the start of a task when the repo surface is broader than the immediate request.
- Use when you need the right entrypoint without re-reading every app, package, and workflow.

## Inputs

- User request
- Suspected runtime or package area
- Known risky invariants

## Output

- Produce a short orientation note with:
- likely runtime or package entrypoints
- relevant contracts and tests
- release or review risks to keep in mind

## Workflow

1. Start at [../../../docs/agentic/INDEX.md](../../../docs/agentic/INDEX.md).
2. Pull only the maps that match the task: architecture, contracts, testing, UI quality, or release.
3. Read the nearest local `AGENTS.md` before going deeper into source.
4. Expand into source files only after the likely path is clear.

## Trigger Examples

- "Orient me for a dashboard contract change in this monorepo."
- "I need the fastest path to the Powens callback flow, related tests, and release-sensitive touchpoints."

## Verification

- Use [../../../docs/agentic/architecture-map.md](../../../docs/agentic/architecture-map.md), [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md), [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md), and [../../../docs/agentic/release-map.md](../../../docs/agentic/release-map.md).
- If the task becomes risky, hand off to a narrower skill such as [../../../.agents/skills/implementation-strategy/SKILL.md](../../../.agents/skills/implementation-strategy/SKILL.md) or [../../../.agents/skills/api-contract-guard/SKILL.md](../../../.agents/skills/api-contract-guard/SKILL.md).
