# CLAUDE.md - Finance-OS

Read [AGENTS.md](AGENTS.md) first. This file is Claude-specific and intentionally short.

## Default Role

- Default to challenger, reviewer, and local high-context collaborator.
- Prefer reviewing assumptions, risk, UX states, contracts, rollout notes, and test gaps before becoming a second writer on active autopilot work.

## Autopilot Branch Ownership

- Active autopilot implementation work lives on `implement:` PRs backed by `agent/impl-*` branches.
- Codex is the default writer for those branches because GitHub automation is wired around Codex PR-thread patch replies.
- Do not write concurrently with Codex on the same active autopilot branch.
- If a human explicitly wants Claude to implement on that branch, treat it as a manual takeover:
  - keep the same branch
  - do not open a second PR
  - pause Codex prompting on that branch until Claude's turn is complete

## Where Claude Adds The Most Value

- challenge or refine batch/spec scope before implementation
- review active PRs for bugs, regressions, missing tests, and rollout risks
- do risky local investigations or prototypes on non-autopilot branches
- critique UI structure, copy, accessibility, and color decisions

## AI Advisor Memory Boundary

- The Temporal Knowledge Graph / GraphRAG service is AI Advisor memory for personal financial context, not the Codex/Claude agentic development pipeline.
- Deterministic `packages/finance-engine` outputs remain first; graph context only enriches, explains, and challenges recommendations.
- Never treat graph memory as trading execution infrastructure. Technical/trading nodes are knowledge-only and paper-trading-ready at most.
- External investment context comes from the compact `advisor_investment_context_bundle`; never prompt from raw IBKR XML, Binance JSON, provider credentials, signed URLs or secrets.
- IBKR/Binance ingestion is read-only analytics only: no orders, withdrawals, transfers, convert, margin/futures, staking/earn mutations, or execution-ready abstractions.

## Skills System

**Full inventory**: [docs/SKILLS-INVENTORY.md](docs/SKILLS-INVENTORY.md) — trust tiers, overlap arbitration, usage guide.

### Priority rule
Local Finance-OS skills > recommended external > optional external > experimental. Local skills encode non-negotiable repo invariants; external skills supplement them.

### Finance-OS Local Skills (always load for matching domain)
| Skill | Load when |
|---|---|
| `finance-os-core-invariants` | Any change touching auth, routes, env vars, data access, logging |
| `finance-os-web-ssr-auth` | Auth flows, route loaders, SSR, demo/admin transitions |
| `finance-os-powens-integration` | Bank connections, Powens client, token encryption |
| `finance-os-worker-sync` | Background worker, sync jobs, Redis queue |
| `finance-os-deploy-ghcr-dokploy` | CI/CD, Docker, releases, Dokploy |
| `finance-os-observability-failsoft` | Widget health, fallbacks, metrics, logging |
| `finance-os-ui-cockpit` | UI components, pages, animations, design system |

### Quick Skill Selection by Task
| Task | Primary | Supplement |
|---|---|---|
| React component | `finance-os-ui-cockpit` | `vercel-react-best-practices`, `vercel-composition-patterns` |
| TanStack Start route | `finance-os-web-ssr-auth` | `tanstack-start-best-practices`, `tanstack-integration-best-practices` |
| API / Elysia | `finance-os-core-invariants` | `security-and-hardening` |
| Drizzle / PostgreSQL | `drizzle-best-practices` | `postgresql-code-review` |
| Redis / Worker | `finance-os-worker-sync` | `redis-development` |
| PR review | `code-review`, `finance-os-core-invariants` | `postgresql-code-review` if DB changes |
| Security audit | `finance-os-core-invariants` | `security-and-hardening`, `sast-security-scan` (experimental) |
| Performance | `performance`, `core-web-vitals` | Impeccable `optimize` |
| Deploy / release | `finance-os-deploy-ghcr-dokploy` | `ci-cd-and-automation` |

## UI and Color Work

- Use `skill.color-expert` when the task is about palette direction, contrast, theme systems, expressive color usage, or visual harmonization.
- Use `finance-os-ui-cockpit` as the primary skill for all UI work — it encodes the luxury cockpit identity, required widget states, and anti-patterns.
- Keep Finance-OS UI intentional and non-generic; do not flatten color decisions into safe default SaaS styling.
- Read `DESIGN.md` before any UI work — it is the source of truth for visual identity, palette, typography, and composition rules.
- Read `docs/frontend/design-system.md` before creating or modifying components — it documents tokens, patterns, and responsive conventions.
- Read `docs/frontend/information-architecture.md` before adding or reorganizing pages/routes.
- Read `docs/frontend/motion-and-interactions.md` before adding animations or transitions.
- When modifying UI, update the relevant documentation in the same change.
- **Impeccable** (33 skills) is installed for UI refinement. Use as complement to `finance-os-ui-cockpit` and DESIGN.md, not as a replacement. Key skills:
  - `polish` / `critique` / `audit` — pre-ship quality pass
  - `arrange` / `typeset` / `colorize` — layout, typography, and color fixes
  - `distill` / `bolder` / `quieter` — calibrate visual intensity
  - `adapt` / `harden` — responsive design + edge-case resilience
  - `normalize` / `extract` — design system alignment and token extraction

## Context Documentation

For full project context (stack, features, design, env vars, architecture), read `docs/context/`:
- [STACK.md](docs/context/STACK.md), [FEATURES.md](docs/context/FEATURES.md), [EXTERNAL-INVESTMENTS.md](docs/context/EXTERNAL-INVESTMENTS.md), [DESIGN-DIRECTION.md](docs/context/DESIGN-DIRECTION.md), [CONVENTIONS.md](docs/context/CONVENTIONS.md), [ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md), [EXTERNAL-SERVICES.md](docs/context/EXTERNAL-SERVICES.md), [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md)
- Update these docs when changes affect stack, features, env vars, or services.

## Agent Efficiency System

Use context packs and skill routing instead of loading the entire repo brain:

- **Context selection**: `pnpm agent:context:select -- --domains=DOMAIN --budget=TIER`
- **Prompt builder**: `pnpm agent:prompt:build -- --domains=DOMAIN --budget=TIER --task="..."`
- **Budget tiers**: small (8K), medium (16K), large (32K), xlarge (64K), autonomous (128K)
- **Skill routing**: [docs/agentic/skill-routing.md](docs/agentic/skill-routing.md)
- **Model routing**: [docs/agentic/model-routing.md](docs/agentic/model-routing.md)
- **Full index**: [docs/agentic/INDEX.md](docs/agentic/INDEX.md)

Claude's primary roles (challenger, reviewer) typically need `medium` budget.
Implementation tasks handed off to Codex typically need `large` or `xlarge`.

**Skills**: `.claude/skills/` is a **generated projection** — never edit directly.
Edit skills in `.agentic/source/skills/`, then run `pnpm agent:skills:sync`.

## Output Bias

- Be concise and high-signal.
- For reviews, lead with concrete findings ordered by severity.
- Respect repo invariants: demo/admin split, `exactOptionalPropertyTypes`, secret-safe logging, and no secret-bearing `VITE_*`.

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **finance-os** (5024 symbols, 12504 relationships, 295 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## When Debugging

1. `gitnexus_query({query: "<error or symptom>"})` — find execution flows related to the issue
2. `gitnexus_context({name: "<suspect function>"})` — see all callers, callees, and process participation
3. `READ gitnexus://repo/finance-os/process/{processName}` — trace the full execution flow step by step
4. For regressions: `gitnexus_detect_changes({scope: "compare", base_ref: "main"})` — see what your branch changed

## When Refactoring

- **Renaming**: MUST use `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` first. Review the preview — graph edits are safe, text_search edits need manual review. Then run with `dry_run: false`.
- **Extracting/Splitting**: MUST run `gitnexus_context({name: "target"})` to see all incoming/outgoing refs, then `gitnexus_impact({target: "target", direction: "upstream"})` to find all external callers before moving code.
- After any refactor: run `gitnexus_detect_changes({scope: "all"})` to verify only expected files changed.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Tools Quick Reference

| Tool | When to use | Command |
|------|-------------|---------|
| `query` | Find code by concept | `gitnexus_query({query: "auth validation"})` |
| `context` | 360-degree view of one symbol | `gitnexus_context({name: "validateUser"})` |
| `impact` | Blast radius before editing | `gitnexus_impact({target: "X", direction: "upstream"})` |
| `detect_changes` | Pre-commit scope check | `gitnexus_detect_changes({scope: "staged"})` |
| `rename` | Safe multi-file rename | `gitnexus_rename({symbol_name: "old", new_name: "new", dry_run: true})` |
| `cypher` | Custom graph queries | `gitnexus_cypher({query: "MATCH ..."})` |

## Impact Risk Levels

| Depth | Meaning | Action |
|-------|---------|--------|
| d=1 | WILL BREAK — direct callers/importers | MUST update these |
| d=2 | LIKELY AFFECTED — indirect deps | Should test |
| d=3 | MAY NEED TESTING — transitive | Test if critical path |

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/finance-os/context` | Codebase overview, check index freshness |
| `gitnexus://repo/finance-os/clusters` | All functional areas |
| `gitnexus://repo/finance-os/processes` | All execution flows |
| `gitnexus://repo/finance-os/process/{name}` | Step-by-step execution trace |

## Self-Check Before Finishing

Before completing any code modification task, verify:
1. `gitnexus_impact` was run for all modified symbols
2. No HIGH/CRITICAL risk warnings were ignored
3. `gitnexus_detect_changes()` confirms changes match expected scope
4. All d=1 (WILL BREAK) dependents were updated

## Keeping the Index Fresh

After committing code changes, the GitNexus index becomes stale. Re-run analyze to update it:

```bash
npx gitnexus analyze
```

If the index previously included embeddings, preserve them by adding `--embeddings`:

```bash
npx gitnexus analyze --embeddings
```

To check whether embeddings exist, inspect `.gitnexus/meta.json` — the `stats.embeddings` field shows the count (0 means no embeddings). **Running analyze without `--embeddings` will delete any previously generated embeddings.**

> Claude Code users: A PostToolUse hook handles this automatically after `git commit` and `git merge`.

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->
# CLAUDE.md

Behavioral guidelines to reduce common LLM coding mistakes. Merge with project-specific instructions as needed.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.
