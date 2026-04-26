# Skills Inventory — Finance-OS

> Last updated: 2026-04-26

This document catalogs all installed agent skills, their trust tier, overlap arbitration, and usage conventions.

## Recent Evaluations

- 2026-04-26: `find-skills` was used before the Temporal Knowledge Graph / GraphRAG work. Public GraphRAG-adjacent skills returned by search were not installed because they had low adoption/trust and did not encode Finance-OS demo/admin, privacy, observability, or agentic-pipeline separation invariants. Local Finance-OS skills and direct primary-source research remain the required path for this area.

---

## Trust Tiers

| Tier | Meaning | When to load |
|---|---|---|
| **Core** | Finance-OS local skills — highest priority, repo-specific invariants | Always relevant for their domain |
| **Recommended** | Well-maintained external skills (>100 stars, active, proven) | Load for matching task type |
| **Optional** | Useful but niche or overlapping with higher-tier skills | Load when specifically needed |
| **Experimental** | Low adoption, unproven, or adapted from non-Claude sources | Use with caution, verify output |
| **Rejected** | Evaluated and excluded — documented here for future reference | Do not install |

---

## Core: Finance-OS Local Skills (7)

These are the highest-priority skills. They encode repo-specific invariants that no public skill can know.

| Skill | Path | Use when |
|---|---|---|
| `finance-os-core-invariants` | `finance-os/core-invariants/` | ANY code change touching auth, routes, env vars, data access, logging |
| `finance-os-web-ssr-auth` | `finance-os/web-ssr-auth/` | Auth flows, route loaders, SSR/client coherence, demo/admin transitions |
| `finance-os-powens-integration` | `finance-os/powens-integration/` | Bank connections, Powens client, callback endpoints, token encryption |
| `finance-os-worker-sync` | `finance-os/worker-sync/` | Background worker, sync jobs, Redis queue, batch upserts |
| `finance-os-deploy-ghcr-dokploy` | `finance-os/deploy-ghcr-dokploy/` | CI/CD, Docker, releases, Dokploy, smoke tests |
| `finance-os-observability-failsoft` | `finance-os/observability-failsoft/` | Widget health states, fallbacks, metrics, logging, health checks |
| `finance-os-ui-cockpit` | `finance-os/ui-cockpit/` | UI components, pages, animations, design system compliance |

**Rule**: When a local skill and an external skill cover the same topic, the local skill takes precedence for Finance-OS invariants. External skills provide general best practices that supplement — not override — local rules.

---

## Core: GitNexus Code Intelligence (6)

| Skill | Path | Use when |
|---|---|---|
| `gitnexus-exploring` | `gitnexus/gitnexus-exploring/` | Understanding architecture, "How does X work?" |
| `gitnexus-impact-analysis` | `gitnexus/gitnexus-impact-analysis/` | Blast radius before editing any symbol |
| `gitnexus-debugging` | `gitnexus/gitnexus-debugging/` | Tracing bugs through code |
| `gitnexus-refactoring` | `gitnexus/gitnexus-refactoring/` | Rename, extract, split, refactor safely |
| `gitnexus-guide` | `gitnexus/gitnexus-guide/` | Tools reference, schema |
| `gitnexus-cli` | `gitnexus/gitnexus-cli/` | Index management, status, CLI commands |

---

## Recommended: External Skills (17)

### Frontend / React

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `vercel-react-best-practices` | vercel-labs/agent-skills | 24.7K | Writing/reviewing React components, performance optimization |
| `vercel-composition-patterns` | vercel-labs/agent-skills | 24.7K | Refactoring components, compound patterns, render props |

### TanStack

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `tanstack-start-best-practices` | DeckardGer/tanstack-agent-skills | 121 | Server functions, middleware, SSR, deployment |
| `tanstack-query-best-practices` | DeckardGer/tanstack-agent-skills | 121 | Data fetching, caching, mutations, server state |
| `tanstack-router-best-practices` | DeckardGer/tanstack-agent-skills | 121 | Type-safe routing, data loading, search params |
| `tanstack-integration-best-practices` | DeckardGer/tanstack-agent-skills | 121 | Query+Router+Start integration, SSR data flow |

### Quality / Performance

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `web-quality-audit` | addyosmani/web-quality-skills | 1.7K | Full web quality audit (perf, a11y, SEO) |
| `performance` | addyosmani/web-quality-skills | 1.7K | Loading speed, resource optimization |
| `core-web-vitals` | addyosmani/web-quality-skills | 1.7K | LCP, INP, CLS optimization |

### DevOps / Workflow

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `ci-cd-and-automation` | addyosmani/agent-skills | 9K | Pipeline setup, quality gates, deployment strategies |
| `git-workflow-and-versioning` | addyosmani/agent-skills | 9K | Branching, commits, conflict resolution |
| `security-and-hardening` | addyosmani/agent-skills | 9K | OWASP Top 10, auth patterns, secrets management |
| `documentation-and-adrs` | addyosmani/agent-skills | 9K | Architecture Decision Records, API docs |

### Data / Backend

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `redis-development` | redis/agent-skills (official) | 41 | Redis data structures, performance, caching patterns |
| `drizzle-best-practices` | Adapted from honra-io | 6 | Schema design, queries, migrations, performance |
| `postgresql-code-review` | Adapted from github/awesome-copilot | -- | PostgreSQL schema, queries, indexes, security |

### Testing

| Skill | Source | Stars | Use when |
|---|---|---|---|
| `webapp-testing` | anthropics/skills (official) | 113K | Playwright testing, frontend verification, screenshots |

---

## Optional: UI Design System — Impeccable (33)

Pre-installed from `pbakaus/impeccable`. These are specialized UI refinement skills. Use them as complements to `finance-os-ui-cockpit` and DESIGN.md.

**Key skills for Finance-OS**:
- `polish` / `critique` / `audit` — pre-ship quality pass
- `arrange` / `typeset` / `colorize` — layout, typography, color fixes
- `distill` / `bolder` / `quieter` — calibrate visual intensity
- `adapt` / `harden` — responsive design + edge-case resilience
- `normalize` / `extract` — design system alignment, token extraction
- `color-expert` — palette direction, contrast, theme systems

**Full list**: `adapt`, `animate`, `arrange`, `audit`, `bolder`, `clarify`, `color-expert`, `colorize`, `creative-direction`, `critique`, `delight`, `design-tokens`, `distill`, `extract`, `frontend-design`, `frontend-design-review`, `frontend-skill`, `harden`, `motion-design-patterns`, `normalize`, `onboard`, `optimize`, `overdrive`, `polish`, `quieter`, `teach-impeccable`, `typeset`, `typography-audit`, `ui-animation`, `ui-audit`, `ui-design`, `visual-qa`, `web-design-guidelines`

---

## Optional: Code Review (1)

| Skill | Path | Use when |
|---|---|---|
| `code-review` | `code-review/` | Reviewing PRs, 4-phase structured review with severity labels |

---

## Generated: GitNexus Domain Skills (20)

Auto-generated from codebase analysis. Updated via `node scripts/sync-gitnexus-generated-skills.mjs`.

| Skill | Symbols | Use when |
|---|---|---|
| `dashboard` | 93 | Working in dashboard app shell, sync status, financial cards |
| `domain` | 67 | Core domain models, types, contracts |
| `auth` | 66 | Authentication flows, session management |
| `routes` | 60 | API route definitions and handlers |
| `repositories` | 38 | Data access layer, query builders |
| `features` | 30 | Feature flags, configuration |
| `services` | 29 | Business logic services |
| `powens` | 29 | Powens API integration symbols |
| `ui` | 18 | UI components and utilities |
| `mocks` | 16 | Test mocks and fixtures |
| `debug` | 11 | Debugging utilities |
| `logging` | 9 | Logging infrastructure |
| `goals` | 8 | Financial goals domain |
| `cluster-1/3/7/14/16/77/78` | 6-12 | Various domain clusters |

---

## Experimental (1)

| Skill | Path | Source | Why experimental |
|---|---|---|---|
| `sast-security-scan` | `experimental/sast-security-scan/` | utkusen/sast-skills (529 stars) | Novel SAST approach, uses CLAUDE.md format adapted to SKILL.md. Useful for periodic security audits but unproven in daily workflow. |

---

## Rejected — With Justification

| Skill | Source | Stars | Why rejected |
|---|---|---|---|
| `ymc182/bun-elysia-skill` | ymc182 | 0 | Dead repo (0 stars, 2 commits, Jan 2026). Our local `core-invariants` + `worker-sync` skills cover Bun/Elysia patterns far better. |
| `thruthesky/dokploy-skill` | thruthesky | 2 | Minimal content (2 stars, shell-based). Our `deploy-ghcr-dokploy` local skill is comprehensive and repo-specific. |
| `Ameyanagi/tanstack-start-elysia` | Ameyanagi | 2 | Scaffolding skill for new projects. We already have a running app — no value for Finance-OS. |
| `ofershap/typescript-best-practices` | ofershap | 1 | 1 star, unproven. TypeScript patterns are well-covered by our `exactOptionalPropertyTypes` conventions + Vercel React practices. |
| TanStack official intent skills | TanStack | -- | Not yet released. `@tanstack/intent` is announced but skills don't ship in npm packages yet. Revisit when available. |
| Microsoft Playwright official | Microsoft | -- | No official Claude Code skill exists. `webapp-testing` from Anthropic covers Playwright testing adequately. |

---

## Overlap Arbitration

### React patterns
- **Primary**: `vercel-react-best-practices` (general React)
- **Supplement**: `vercel-composition-patterns` (compound components, advanced patterns)
- **Override**: `finance-os-ui-cockpit` for Finance-OS design system compliance

### TanStack
- **Primary**: DeckardGer's 4 TanStack skills (generic best practices)
- **Override**: `finance-os-web-ssr-auth` for Finance-OS SSR/auth specifics

### Security
- **General**: `security-and-hardening` (OWASP, generic hardening)
- **Override**: `finance-os-core-invariants` for Finance-OS security invariants (VITE_*, encryption, logging)
- **Audit**: `sast-security-scan` (experimental) for deep vulnerability scanning

### Performance
- **Web**: `performance` + `core-web-vitals` (general web perf)
- **UI**: Impeccable `optimize` (UI-specific perf)
- Both are complementary, no conflict.

### Code Review
- **General**: `code-review` (structured 4-phase review)
- **PostgreSQL**: `postgresql-code-review` (DB-specific review)
- **Override**: Always apply `finance-os-core-invariants` checklist on top

### CI/CD + Deploy
- **General**: `ci-cd-and-automation` (generic pipeline best practices)
- **Override**: `finance-os-deploy-ghcr-dokploy` for Finance-OS pipeline specifics

### Redis
- **General**: `redis-development` (official Redis patterns)
- **Override**: `finance-os-worker-sync` for Finance-OS queue/lock patterns

---

## Agent Usage Guide

### By task type — which skills to load

| Task | Primary skill(s) | Supplement |
|---|---|---|
| **React component** | `finance-os-ui-cockpit` | `vercel-react-best-practices`, `vercel-composition-patterns` |
| **TanStack Start route** | `finance-os-web-ssr-auth`, `tanstack-start-best-practices` | `tanstack-router-best-practices`, `tanstack-integration-best-practices` |
| **TanStack Query** | `tanstack-query-best-practices` | `tanstack-integration-best-practices` |
| **Bun/Elysia API** | `finance-os-core-invariants` | `security-and-hardening` |
| **Drizzle/PostgreSQL** | `drizzle-best-practices` | `postgresql-code-review` |
| **Redis** | `finance-os-worker-sync` | `redis-development` |
| **Powens** | `finance-os-powens-integration` | `finance-os-core-invariants` |
| **CI/CD** | `finance-os-deploy-ghcr-dokploy` | `ci-cd-and-automation` |
| **Security audit** | `finance-os-core-invariants`, `security-and-hardening` | `sast-security-scan` (experimental) |
| **Performance** | `performance`, `core-web-vitals` | Impeccable `optimize` |
| **PR review** | `code-review`, `finance-os-core-invariants` | `postgresql-code-review` (if DB changes) |
| **UI polish** | `finance-os-ui-cockpit` | Impeccable: `polish`, `critique`, `audit` |
| **New feature (full-stack)** | `finance-os-core-invariants`, `finance-os-observability-failsoft` | Domain-specific skills as needed |
| **Worker/sync** | `finance-os-worker-sync` | `redis-development` |
| **Deploy/release** | `finance-os-deploy-ghcr-dokploy` | `ci-cd-and-automation`, `git-workflow-and-versioning` |
| **ADR/documentation** | `documentation-and-adrs` | -- |
| **Code exploration** | GitNexus skills + generated domain skills | -- |

### Priority rule

When skills overlap: **local Finance-OS skill > recommended external > optional external > experimental**.

The local skill's rules are non-negotiable (they encode repo invariants). External skills provide supplementary best practices.
