<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/implementation-strategy/SKILL.md
     Hash:   sha256:7c0b8f6ebbd798cb
     Sync:   pnpm agent:skills:sync -->

---
name: implementation-strategy
description: Plan implementation boundaries for Finance-OS before risky coding. Use when changes touch auth, HTTP contracts, provider or Powens flows, env shape, release-sensitive behavior, or backend/web layering and you need a scoped plan with invariants, verification, and rollback notes.
---

# Implementation Strategy

## Trigger

- Use before coding auth, contract, provider, env, or layering-sensitive changes.
- Use when the blast radius is unclear or when a rollback note is worth stating up front.

## Inputs

- Requested outcome
- Likely files or package areas
- Relevant invariants or contracts at risk

## Output

- Produce one short implementation note with:
- scope in
- scope out
- invariants to preserve
- likely files to touch
- verification commands
- rollback or kill-switch note when risk is non-trivial

## Workflow

1. Read [../../../AGENTS.md](../../../AGENTS.md) and the nearest local `AGENTS.md`.
2. Pull the shortest relevant context from [../../../docs/agentic/architecture-map.md](../../../docs/agentic/architecture-map.md), [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md), and [../../../docs/agentic/release-map.md](../../../docs/agentic/release-map.md).
3. State what must not change before proposing what will change.
4. Keep the plan reviewable. Prefer the narrowest patch that preserves demo/admin behavior and current automation.

## Trigger Examples

- "Plan the safest way to add an admin-only route without breaking the demo path."
- "Before coding this Powens callback change, define the boundaries, tests, and rollback."

## Verification

- Match the proposed checks to [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md).
- If the plan changes architecture, contracts, env, or review expectations, include the required docs updates from [../../../.agents/skills/docs-sync/SKILL.md](../../../.agents/skills/docs-sync/SKILL.md).
