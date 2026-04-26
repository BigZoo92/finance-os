# Skill Routing — Finance-OS

> Generated: 2026-04-26
> Machine-readable manifest: [skill-routing-manifest.json](skill-routing-manifest.json)

## How Skill Routing Works

1. Each task declares one or more **task domains** (e.g., `web-ui`, `database`, `security`)
2. The skill router selects **required** and **optional** skills based on domain mapping
3. Skills are loaded in priority order: **core > recommended > optional > experimental**
4. Maximum skills per task: 3 required + 3 optional (configurable)
5. If two skills cover the same topic, the higher-priority one wins
6. Skills exceeding the context budget are dropped with a warning

## Priority Rule

**Local Finance-OS skills > recommended external > optional external > experimental.**

Local skills encode non-negotiable repo invariants. External skills supplement, never override.

## Skill Tiers

| Tier | Count | Total Tokens | When Loaded |
|---|---|---|---|
| Core (Finance-OS + GitNexus) | 13 | ~14K | When domain matches |
| Recommended (external best practices) | 18 | ~34K | When domain matches |
| Optional (Impeccable UI + niche) | 57 | ~89K | Only if budget allows |
| Experimental | 1 | ~2.3K | Explicit request only |

## Domain to Skill Mapping

| Domain | Required Skills | Optional Skills |
|---|---|---|
| core-invariants | finance-os/core-invariants | security-and-hardening |
| web-ui | finance-os/ui-cockpit, finance-os/web-ssr-auth | vercel-react-best-practices, vercel-composition-patterns |
| tanstack | finance-os/web-ssr-auth, tanstack-start-best-practices | tanstack-router, tanstack-query, tanstack-integration |
| api-backend | finance-os/core-invariants | security-and-hardening |
| worker-sync | finance-os/worker-sync | redis-development |
| powens | finance-os/powens-integration, finance-os/core-invariants | — |
| knowledge-graph | finance-os/core-invariants | — |
| ai-advisor | finance-os/core-invariants | — |
| database | drizzle-best-practices | postgresql-code-review |
| redis | finance-os/worker-sync | redis-development |
| docker-deploy | finance-os/deploy-ghcr-dokploy | ci-cd-and-automation |
| ci-cd | finance-os/deploy-ghcr-dokploy | ci-cd-and-automation, git-workflow-and-versioning |
| testing | finance-os/core-invariants | webapp-testing |
| performance | performance | core-web-vitals |
| design-polish | finance-os/ui-cockpit | polish, critique, audit |
| security | finance-os/core-invariants, security-and-hardening | — |
| review | code-review, finance-os/core-invariants | postgresql-code-review |
| documentation | documentation-and-adrs | — |
| agentic-autopilot | finance-os/core-invariants | — |

## Skills to Never Auto-Load

- `color-expert/references/` — 491K tokens of paint theory
- `learn` / `review-skill` / `teach-impeccable` — meta-skills for skill management
- `empirical-prompt-tuning` — niche prompt optimization
- All 20 generated GitNexus domain skills — load only the matching domain cluster

## Commands

```bash
# Full audit with manifest generation
node scripts/agent-context/skill-router.mjs --audit

# Skills for a specific domain
node scripts/agent-context/skill-router.mjs --domain=web-ui

# All available domains
node scripts/agent-context/skill-router.mjs

# Context selection (uses skill router internally)
pnpm agent:context:select -- --domains=web-ui --budget=medium
```
