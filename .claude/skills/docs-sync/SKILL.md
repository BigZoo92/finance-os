<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/docs-sync/SKILL.md
     Hash:   sha256:ce32d015b698a17d
     Sync:   pnpm agent:skills:sync -->

---
name: docs-sync
description: Keep Finance-OS instructions and maps in sync with code changes. Use when a change affects architecture, contracts, env, testing, review expectations, or local commands and the nearest AGENTS or docs/agentic files must be updated in the same patch.
---

# Docs Sync

## Trigger

- Use when code changes alter local architecture, contracts, env, testing, or review guidance.
- Use when a new or changed workflow would make the current `AGENTS.md` or `docs/agentic` maps misleading.

## Inputs

- Changed code files
- Behavior or contract differences
- Existing nearby guides

## Output

- Produce one update checklist with:
- files that must change
- why each file needs an update
- whether any skill text also needs to change

## Workflow

1. Read [../../../AGENTS.md](../../../AGENTS.md) and the nearest local `AGENTS.md`.
2. Update the closest guide instead of expanding the root contract.
3. Update the relevant entry-point docs under [../../../docs/agentic/INDEX.md](../../../docs/agentic/INDEX.md) rather than writing speculative new docs.
4. If the change affects a repeatable workflow, update the matching skill under [../../skills/](../../skills/) in the same patch.

## Trigger Examples

- "This env change altered API and worker requirements. Which AGENTS and docs need to move with it?"
- "We changed how a required route is mounted. Update the closest maps and instructions in the same patch."

## Verification

- Re-run `node .agents/skills/scripts/validate-agent-foundation.mjs` after the docs update.
- Spot-check [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md), [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md), and the nearest local `AGENTS.md` for drift.
