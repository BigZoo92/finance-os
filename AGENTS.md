# AGENTS.md - Finance-OS

Last updated: 2026-04-06

Use the nearest `AGENTS.md` before editing. Keep this root file small and durable; push local detail into nested `AGENTS.md`, `.agents/skills/`, and `docs/agentic/`.

## Global Invariants

- Finance-OS is a strictly personal, single-user finance cockpit.
- Every feature must preserve two explicit execution paths:
  - `demo` is the default and must use deterministic mocks only, with no DB reads/writes and no provider calls.
  - `admin` enables DB and providers behind the admin session cookie and/or valid signed internal state.
- Fail soft: if Powens or any other integration fails, the app must remain usable with clear fallback messaging.
- Privacy by design is mandatory:
  - never put secrets in `VITE_*`
  - never log Powens codes or tokens
  - encrypt sensitive tokens at rest
- Observability is mandatory:
  - propagate `x-request-id` end to end
  - keep API logs structured and secret-safe
  - keep error payloads normalized and safe to expose
  - keep deploy-time probes, smoke checks, and ops alerting aligned with the live route topology
- TypeScript optional-property invariant:
  - `exactOptionalPropertyTypes` is enabled; when an optional field is absent, omit the key entirely instead of passing `undefined`
- Ops alert-quality conventions (for monitor rules, digests, and review notes):
  - priority levels must be explicit and map to review severity: `critical -> P0`, `high -> P1`, `medium/low -> P2`
  - scoring must be transparent and additive: `impact (0-5) + confidence (0-3) + recency (0-2)`; include the final score in docs/PR notes when adding or tuning alerts
  - anti-noise defaults are required: deduplicate by fingerprint, suppress repeats inside a cooldown window, and prefer state-change notifications over interval spam
  - digests must be decision-first: include only top actionable items first (priority, score, owner, next step), then collapse informational tails to keep the signal concise
- Analytics conventions and source-of-truth requirements:
  - analytics is descriptive telemetry, never an execution dependency; core product behavior must not rely on event delivery
  - every metric, chart, or dashboard must declare one canonical source of truth (DB table/view, API contract, or deterministic demo fixture) and link to it in local docs when introduced
  - source-of-truth graphs must show upstream provenance and downstream consumers so reviewers can trace transformations end to end
  - assumptions (time windows, freshness SLOs, sampling, currency/FX handling, timezone boundaries, and null/default semantics) must be explicit and versioned with the feature
  - when data is delayed, missing, or inconsistent, fail soft with clear fallback UI copy and degraded-but-usable defaults instead of blocking flows
  - demo-mode analytics must remain deterministic and mock-backed; admin-only analytics may use live providers but must keep demo/admin split explicit
- Public traffic terminates on `apps/web` only. `/api/*` is proxied internally to `API_INTERNAL_URL`; `apps/api` should not require its own public route.
- `batch:` issues are first-class product briefs. Preserve their context, objectives, design principles, non-negotiable constraints, expected result, cost bias, decision rules, and explicit out-of-scope when spawning downstream work.
- Autopilot workflow invariants:
  - batch spec expansion must stay 1:1 with the raw bullet list, with no extra spawned requested specs
  - only one implementation lane may auto-start from a batch at a time; the rest stay queued
  - `issue_comment` workflows must gate on Codex-authored comments before doing work
  - implementation PRs are created automatically as draft `agent/impl-*` branches; Codex should implement by replying on the PR thread with `AUTOPILOT_PATCH_V1`, and autopilot applies that patch onto the same branch
  - once an implementation PR is created, the linked `spec:` and `improve:` issues are closed as `completed`; if that PR is closed without merge, autopilot reopens and requeues the linked work
  - only one autopilot implementation PR may stay open at a time; extra improve issues wait in `autopilot:queued-pr`
  - only one writer may own an active autopilot implementation branch at a time; if a human or Claude takes over locally, stop prompting Codex on that branch until the handoff is complete
  - merge-on-green may only promote and merge an autopilot PR after real non-stub files land on the branch, all `.github/agent-stubs/**` files are gone from the PR diff, and the branch is up to date with green CI
  - failed CI on an autopilot implementation PR must be summarized back onto the PR thread so Codex sees the runner error instead of relying on partial local checks
- When code changes alter local architecture, contracts, env, testing, or review guidance, update the nearest `AGENTS.md`, the relevant `docs/agentic/*.md`, and any affected skill in `.agents/skills/` in the same change.
- Design system and frontend identity invariants:
  - Always consult `DESIGN.md` before modifying any UI component, layout, or visual styling.
  - Always consult `docs/frontend/design-system.md` before creating or modifying a shared component.
  - Always reuse or extend the existing design system tokens (colors, spacing, radius, motion, typography) before introducing isolated values.
  - Always preserve the amber/gold primary identity (`oklch ~75° hue`), Inter + JetBrains Mono typography, and surface depth system (surface-0/1/2).
  - Always maintain mobile responsiveness, performance constraints, and accessibility when changing UI.
  - When adding new design tokens, patterns, components, or routes, update the relevant frontend documentation (`DESIGN.md`, `docs/frontend/*.md`) in the same change.
  - When modifying navigation or route structure, update `docs/frontend/information-architecture.md` and the `NAV_ITEMS` in `apps/web/src/components/shell/app-sidebar.tsx`.
  - Financial amounts must use the `.font-financial` class (monospace, tabular figures) for readability.
  - Use semantic color tokens (`positive`, `negative`, `warning`) for financial data, never hardcoded colors.

## Global Verification

- Start with the smallest checks that match the changed scope.
- Use canonical repo-wide commands from [package.json](package.json):
  - `pnpm check:ci`
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm -r --if-present test`
  - `pnpm -r --if-present build`
- Use [scripts/smoke-api.mjs](scripts/smoke-api.mjs) and [scripts/smoke-prod.mjs](scripts/smoke-prod.mjs) when route, proxy, or deploy behavior changes.
- For production Compose alerting or health-monitor changes, run `node --test infra/docker/ops-alerts/monitor.test.mjs` in addition to the relevant runtime checks.
- Validate the agentic foundation after changing `AGENTS.md`, `.agents/skills/`, or `docs/agentic/`:
  - `node .agents/skills/scripts/validate-agent-foundation.mjs`

## Global Review

- `P0`: security issue, secret leak, Powens token/code exposure, data loss, or broken demo/admin split
- `P1`: contract regression, missing demo path, missing behavior-change tests, SSR auth flash regression, unsafe logging, or broken observability wiring
- `P2`: local cleanup or style feedback
- Always check dual-path correctness, `VITE_*` safety, logging safety, observability wiring, and test evidence for behavior changes.
- UI changes require rationale plus screenshot notes; see [docs/agentic/code_review.md](docs/agentic/code_review.md).

## Local Guides

- [apps/api/AGENTS.md](apps/api/AGENTS.md)
- [apps/web/AGENTS.md](apps/web/AGENTS.md)
- [apps/worker/AGENTS.md](apps/worker/AGENTS.md)
- [infra/docker/AGENTS.md](infra/docker/AGENTS.md)
- [packages/db/AGENTS.md](packages/db/AGENTS.md)
- [packages/env/AGENTS.md](packages/env/AGENTS.md)
- [packages/powens/AGENTS.md](packages/powens/AGENTS.md)
- [packages/redis/AGENTS.md](packages/redis/AGENTS.md)
- [packages/ui/AGENTS.md](packages/ui/AGENTS.md)
- [packages/prelude/AGENTS.md](packages/prelude/AGENTS.md)

## Agentic Maps

- [docs/agentic/INDEX.md](docs/agentic/INDEX.md)
- [docs/agentic/architecture-map.md](docs/agentic/architecture-map.md)
- [docs/agentic/contracts-map.md](docs/agentic/contracts-map.md)
- [docs/agentic/testing-map.md](docs/agentic/testing-map.md)
- [docs/agentic/ui-quality-map.md](docs/agentic/ui-quality-map.md)
- [docs/agentic/release-map.md](docs/agentic/release-map.md)
- Repo-local skills live under `.agents/skills/`.

## Skills System

Full inventory with trust tiers, overlaps, and usage guide: [docs/SKILLS-INVENTORY.md](docs/SKILLS-INVENTORY.md)

### Skill categories (`.claude/skills/`)
| Category | Path | Count | Purpose |
|---|---|---|---|
| Finance-OS local | `finance-os/` | 7 | Repo-specific invariants — highest priority |
| GitNexus guides | `gitnexus/` | 6 | Code intelligence workflows |
| GitNexus generated | `generated/` | 20 | Auto-indexed domain clusters |
| External recommended | root-level dirs | 17 | Best practices (React, TanStack, Redis, Drizzle, CI/CD, security, perf, testing) |
| Impeccable (UI) | root-level dirs | 33 | UI refinement and design system |
| Experimental | `experimental/` | 1 | Unproven — use with caution |

### Priority rule
When a local Finance-OS skill and an external skill cover the same topic, the local skill takes precedence. External skills provide general best practices that supplement — not override — local invariants.

## Context Documentation

Comprehensive reference docs for agents and external chats (maintained by agents + human):

- [docs/context/STACK.md](docs/context/STACK.md) — Full technical stack, architecture graphs, CI/CD pipeline, deployment
- [docs/context/FEATURES.md](docs/context/FEATURES.md) — All business features in detail (Powens, goals, transactions, news, etc.)
- [docs/context/DESIGN-DIRECTION.md](docs/context/DESIGN-DIRECTION.md) — Artistic direction, color palette, typography, motion, layout patterns
- [docs/context/CONVENTIONS.md](docs/context/CONVENTIONS.md) — Best practices, coding conventions, review process, security rules
- [docs/context/ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md) — All environment variables, feature flags, where to set them, how to generate
- [docs/context/EXTERNAL-SERVICES.md](docs/context/EXTERNAL-SERVICES.md) — All external services and APIs (Powens, HN, Redis, GHCR, Dokploy)
- [docs/context/APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md) — Per-app and per-package architecture with Mermaid graphs

> When code changes alter stack, features, env vars, or external integrations, update the relevant `docs/context/*.md` in the same change.

## GitNexus Context Layer

Knowledge graph over the full codebase (`gitnexus@1.4.10`, devDep). Available as MCP server for both Claude Code and Codex.

- **Before big refactors**: use `impact <symbol>` or the `detect_impact` prompt
- **Explore unfamiliar code**: `context <symbol>`, `query "concept"`, or `gitnexus://repo/finance-os/clusters`
- **Architecture maps**: `generate_map` prompt
- **Refresh index**: `pnpm gitnexus:analyze && pnpm gitnexus:sync-generated-skills`
- **Generated skills**: `.claude/skills/generated/` (domain clusters) + `.claude/skills/gitnexus/` (usage guides), mirrored to `.agents/skills/` via sync script
- **Full reference**: [docs/ai/gitnexus.md](docs/ai/gitnexus.md)

<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **finance-os** (1910 symbols, 4129 relationships, 78 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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
| Work in the Dashboard area (75 symbols) | `.claude/skills/generated/dashboard/SKILL.md` |
| Work in the Domain area (71 symbols) | `.claude/skills/generated/domain/SKILL.md` |
| Work in the Auth area (64 symbols) | `.claude/skills/generated/auth/SKILL.md` |
| Work in the Routes area (54 symbols) | `.claude/skills/generated/routes/SKILL.md` |
| Work in the Repositories area (38 symbols) | `.claude/skills/generated/repositories/SKILL.md` |
| Work in the Features area (32 symbols) | `.claude/skills/generated/features/SKILL.md` |
| Work in the Powens area (30 symbols) | `.claude/skills/generated/powens/SKILL.md` |
| Work in the Services area (29 symbols) | `.claude/skills/generated/services/SKILL.md` |
| Work in the Ui area (20 symbols) | `.claude/skills/generated/ui/SKILL.md` |
| Work in the Mocks area (16 symbols) | `.claude/skills/generated/mocks/SKILL.md` |
| Work in the Cluster_1 area (12 symbols) | `.claude/skills/generated/cluster-1/SKILL.md` |
| Work in the Cluster_3 area (12 symbols) | `.claude/skills/generated/cluster-3/SKILL.md` |
| Work in the Debug area (11 symbols) | `.claude/skills/generated/debug/SKILL.md` |
| Work in the Cluster_46 area (10 symbols) | `.claude/skills/generated/cluster-46/SKILL.md` |
| Work in the Logging area (9 symbols) | `.claude/skills/generated/logging/SKILL.md` |
| Work in the Goals area (8 symbols) | `.claude/skills/generated/goals/SKILL.md` |
| Work in the _app area (8 symbols) | `.claude/skills/generated/app/SKILL.md` |
| Work in the Cluster_16 area (7 symbols) | `.claude/skills/generated/cluster-16/SKILL.md` |
| Work in the Cluster_47 area (7 symbols) | `.claude/skills/generated/cluster-47/SKILL.md` |
| Work in the Shell area (7 symbols) | `.claude/skills/generated/shell/SKILL.md` |

<!-- gitnexus:end -->
