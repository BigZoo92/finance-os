<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/api-contract-guard/SKILL.md
     Hash:   sha256:5a8a8b4ada43e27c
     Sync:   pnpm agent:skills:sync -->

---
name: api-contract-guard
description: Protect required Finance-OS HTTP contracts and route availability. Use when API routes, auth payloads, dashboard endpoints, Powens endpoints, proxy behavior, or route registration changes and you need a focused contract review.
---

# API Contract Guard

## Trigger

- Use when route files, auth payloads, request schemas, or API startup registration change.
- Use when a route could 404, change shape, or lose proxy compatibility.

## Inputs

- Changed API files
- Expected request and response contract
- Related web callers or smoke checks

## Output

- Produce a contract checklist with:
- required endpoints reviewed
- shape changes or no-change confirmation
- affected callers
- missing tests or smoke checks

## Workflow

1. Read [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md) first.
2. Trace the route implementation in API and its web caller before accepting a contract change.
3. Check [../../../apps/api/src/index.ts](../../../apps/api/src/index.ts) when route registration, compatibility mounts, or required production assertions are involved.
4. Flag any change that weakens `/auth/me`, dashboard routes, Powens status, or sensitive Powens actions.
5. When advisor contracts change, explicitly verify `/dashboard/advisor/knowledge-topics` and `/dashboard/advisor/knowledge-answer` preserve demo determinism, browse-only fallback, and secret-safe logging.

## Trigger Examples

- "Review this route refactor and confirm none of the required endpoints can disappear."
- "Check whether changing `/auth/me` still preserves the expected payload and no-store behavior."

## Verification

- Reuse [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) for route-level checks.
- Use [../../../apps/api/AGENTS.md](../../../apps/api/AGENTS.md) for local API constraints.
