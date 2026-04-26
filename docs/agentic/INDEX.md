# Agentic Index

Use these files as markdown-first entry points before re-exploring the repo.

## Agent Efficiency System (NEW)

Start here for optimized agentic workflows:

- **[agent-surfaces.md](agent-surfaces.md)**: Canonical source, projections, sync workflow
- **[context-audit.md](context-audit.md)**: Full audit of repo context bloat, duplication, and optimization opportunities
- **[model-routing.md](model-routing.md)**: Which model for which task (Codex/Claude/Kimi/Qwen/Hermes/Gemma)
- **[skill-routing.md](skill-routing.md)**: How skills are selected by task domain
- **[prompt-caching-strategy.md](prompt-caching-strategy.md)**: Cache-friendly prompt structure design
- **[token-economics.md](token-economics.md)**: Token/cost telemetry schema and tracking
- **[agent-runbook.md](agent-runbook.md)**: Step-by-step guide for using the efficiency system

### Context Packs (compact, task-specific bundles)

- [context-packs/core.md](context-packs/core.md) — global invariants (always loaded)
- [context-packs/web-ui.md](context-packs/web-ui.md) — web frontend + design system
- [context-packs/api-backend.md](context-packs/api-backend.md) — API/Elysia
- [context-packs/worker-sync.md](context-packs/worker-sync.md) — background worker
- [context-packs/ai-advisor.md](context-packs/ai-advisor.md) — AI Advisor (financial)
- [context-packs/knowledge-graph.md](context-packs/knowledge-graph.md) — knowledge graph
- [context-packs/deploy-ci.md](context-packs/deploy-ci.md) — Docker/CI/CD
- [context-packs/design-system.md](context-packs/design-system.md) — design tokens + identity
- [context-packs/testing.md](context-packs/testing.md) — verification strategy
- [context-packs/security.md](context-packs/security.md) — security invariants
- [context-packs/autopilot.md](context-packs/autopilot.md) — autopilot workflow

### Commands

```bash
pnpm agent:context:audit      # Full context audit with manifest
pnpm agent:context:pack       # Regenerate all context packs
pnpm agent:context:estimate   # Estimate tokens for files
pnpm agent:context:select     # Select docs+skills for a task domain
pnpm agent:context:check      # CI check for context bloat
pnpm agent:prompt:build       # Build cache-optimized prompt
pnpm agent:telemetry:record   # Record agent task telemetry
```

### ADRs

- [../adr/agent-efficiency-context-budget-model-router.md](../adr/agent-efficiency-context-budget-model-router.md)
- [../adr/model-routing-and-token-economics.md](../adr/model-routing-and-token-economics.md)
- [../adr/agent-memory-letta-hermes.md](../adr/agent-memory-letta-hermes.md)

---

## Canonical Maps

- [architecture-canonical.md](architecture-canonical.md): runtime entrypoints, boundaries
- [contracts-canonical.md](contracts-canonical.md): HTTP contract guidance
- [testing-canonical.md](testing-canonical.md): verification strategy
- [release-canonical.md](release-canonical.md): CI/release/deploy guidance
- [design-guidance-canonical.md](design-guidance-canonical.md): UI/UX quality guidance
- [execution-map.md](execution-map.md): end-to-end runtime flows
- [code_review.md](code_review.md): review severity and checklist
- [policy-verification-bundle.md](policy-verification-bundle.md): verification checklists

## Deprecated Redirect Stubs

- [architecture-map.md](architecture-map.md)
- [contracts-map.md](contracts-map.md)
- [testing-map.md](testing-map.md)
- [release-map.md](release-map.md)
- [ui-quality-map.md](ui-quality-map.md)

## Local Guides

- Root contract: [../../AGENTS.md](../../AGENTS.md)
- API rules: [../../apps/api/AGENTS.md](../../apps/api/AGENTS.md)
- Web rules: [../../apps/web/AGENTS.md](../../apps/web/AGENTS.md)
- Worker rules: [../../apps/worker/AGENTS.md](../../apps/worker/AGENTS.md)
- Docker/deploy rules: [../../infra/docker/AGENTS.md](../../infra/docker/AGENTS.md)
- Package rules: [../../packages/db/AGENTS.md](../../packages/db/AGENTS.md), [../../packages/env/AGENTS.md](../../packages/env/AGENTS.md), [../../packages/powens/AGENTS.md](../../packages/powens/AGENTS.md), [../../packages/redis/AGENTS.md](../../packages/redis/AGENTS.md), [../../packages/ui/AGENTS.md](../../packages/ui/AGENTS.md), [../../packages/prelude/AGENTS.md](../../packages/prelude/AGENTS.md)

## Repo-Local Skills

- Skills live under [../../.agents/skills/](../../.agents/skills/).
- Skill routing: [skill-routing.md](skill-routing.md)
- Full inventory: [../../docs/SKILLS-INVENTORY.md](../../docs/SKILLS-INVENTORY.md)

## Validation

- Agentic foundation validation: `node .agents/skills/scripts/validate-agent-foundation.mjs`
- Context budget check: `pnpm agent:context:check`
- Repo-wide verification: `pnpm check:ci`
