# Context Audit Report — Finance-OS

> Generated: 2026-04-26
> Purpose: Identify context bloat, duplication, staleness, and optimization opportunities for the agentic pipeline.

## Executive Summary

Total agent-loadable markdown across the repo: **~1.7M tokens** (6.8M chars).
The largest contributor is duplicated skill content between `.claude/skills/` and `.agents/skills/` (~872K + ~676K tokens), followed by the `color-expert` reference library alone (~985K tokens across both dirs).

**Key findings:**
1. `.claude/skills/` and `.agents/skills/` are nearly full mirrors — **~80% duplication**
2. `color-expert/references/` contributes ~985K tokens of paint-mixing theory — never loaded for code tasks
3. `FINANCE-OS-CONTEXT.md` (2546 lines, ~27K tokens) is a monolithic context pack intended for external ChatGPT chats — should not be auto-loaded by repo agents
4. `CLAUDE.md` includes a full copy of the GitNexus instructions (~120 lines) already present in `AGENTS.md`
5. No context budget enforcement exists — any agent can load the entire repo brain
6. No skill routing logic exists — skills are loaded by trigger keyword matching only
7. Autopilot prompts have basic token counting but no budget caps

---

## Top Largest Documents (estimated tokens)

| File | Lines | ~Tokens | Category |
|---|---|---|---|
| `color-expert/references/` (all, both dirs) | 18,000+ | ~985K | never-auto-load |
| `.claude/skills/` (all SKILL.md + AGENTS.md) | 6,500+ | ~287K | domain-core (per-skill) |
| `.agents/skills/` (all SKILL.md) | 5,800+ | ~220K | duplicate of .claude |
| `FINANCE-OS-CONTEXT.md` | 2,546 | ~27K | archive (external-chat context pack) |
| `AGENTS.md` (root) | 277 | ~3.5K | always |
| `CLAUDE.md` | ~400 | ~3.9K | always (Claude-specific) |
| `docs/context/APP-ARCHITECTURES.md` | 649 | ~6.5K | domain-core |
| `docs/context/NEWS-FETCH.md` | 646 | ~6.5K | task-relevant |
| `docs/context/FEATURES.md` | 589 | ~5.9K | domain-core |
| `docs/context/EXTERNAL-SERVICES.md` | 450 | ~4.5K | task-relevant |
| `docs/context/ENV-REFERENCE.md` | 444 | ~4.4K | task-relevant |
| `docs/SKILLS-INVENTORY.md` | 240 | ~2.4K | task-relevant |
| `docs/agentic/policy-verification-bundle.md` | 176 | ~1.8K | task-relevant |
| `docs/AI-SETUP.md` | 440 | ~4.4K | task-relevant |
| `docs/deployment.md` | 530 | ~5.3K | task-relevant |
| `.claude/skills/vercel-react-best-practices/AGENTS.md` | 3,750 | ~37K | optional (single skill!) |
| `.claude/skills/redis-development/AGENTS.md` | 2,216 | ~22K | optional (single skill!) |
| `.claude/skills/drizzle-best-practices/SKILL.md` | 442 | ~4.4K | task-relevant |

---

## Duplication Analysis

### .claude/skills vs .agents/skills
- `.claude/skills/`: 89 SKILL.md files, ~50 skill directories
- `.agents/skills/`: 81 SKILL.md files, ~60 skill directories
- **~80% content overlap** — same skills mirrored with slightly different directory naming
- `.agents/skills/` has extra Codex-oriented skills (api-contract-guard, dual-path-guard, code-change-verification, docs-sync, implementation-strategy, etc.)
- `.claude/skills/` has extras (ci-cd-and-automation, core-web-vitals, documentation-and-adrs, empirical-prompt-tuning, experimental/sast-security-scan)
- **Recommendation**: Keep `.claude/skills/` as canonical for Claude, `.agents/skills/` as canonical for Codex. Stop mirroring entire content — share via symlinks or generation.

### GitNexus block in CLAUDE.md vs AGENTS.md
- CLAUDE.md lines 156-276: full GitNexus instructions
- AGENTS.md lines 156-276: identical GitNexus instructions
- **~120 lines duplicated** — both auto-loaded, doubling context for Claude

### FINANCE-OS-CONTEXT.md vs docs/context/*
- FINANCE-OS-CONTEXT.md is a 2546-line monolithic aggregation of all docs/context/* files
- Created for external ChatGPT chats, not for repo agents
- **Should be marked archive / never-auto-load**

### Deprecated redirect stubs in docs/agentic/
- `architecture-map.md`, `contracts-map.md`, `testing-map.md`, `release-map.md`, `ui-quality-map.md`
- These are redirect stubs to canonical versions — useful but add noise

---

## Stale Documents

| File | Status | Action |
|---|---|---|
| `FINANCE-OS-CONTEXT.md` | Dated 2026-04-15, pre-knowledge-graph | Mark archive, do not auto-load |
| `docs/AI-SETUP.md` | May reference old setup steps | Review, merge useful parts into context packs |
| `docs/ai/final-setup-checklist.md` (390 lines) | One-time setup doc | Archive |
| `docs/agentic/*-map.md` (5 redirect stubs) | Deprecated | Keep as redirects, exclude from context loading |

---

## Source-of-Truth Documents (canonical)

| Topic | Canonical Source |
|---|---|
| Global invariants | `AGENTS.md` (root) |
| Claude-specific | `CLAUDE.md` |
| Stack/architecture | `docs/context/STACK.md` + `docs/context/APP-ARCHITECTURES.md` |
| Features | `docs/context/FEATURES.md` |
| Design direction | `DESIGN.md` + `docs/context/DESIGN-DIRECTION.md` |
| Env vars | `docs/context/ENV-REFERENCE.md` |
| External services | `docs/context/EXTERNAL-SERVICES.md` |
| Conventions | `docs/context/CONVENTIONS.md` |
| News pipeline | `docs/context/NEWS-FETCH.md` |
| Skills inventory | `docs/SKILLS-INVENTORY.md` |
| Agentic maps | `docs/agentic/INDEX.md` |
| Knowledge graph ADR | `docs/adr/temporal-knowledge-graph-graphrag.md` |
| AI pricing | `packages/ai/src/pricing/registry.ts` |
| AI types/schemas | `packages/ai/src/types.ts` |
| DB schema (AI) | `packages/db/src/schema/ai.ts` |

---

## Skills Assessment

### High-Value Skills (always relevant for their domain)
- 7 Finance-OS local skills (core-invariants, web-ssr-auth, powens, worker-sync, deploy, observability, ui-cockpit)
- 6 GitNexus skills (exploring, impact, debugging, refactoring, guide, cli)
- drizzle-best-practices, postgresql-code-review
- vercel-react-best-practices, tanstack-* skills
- security-and-hardening, code-review

### Redundant / Overlapping Skills
- **33 Impeccable UI skills**: Most are narrow refinement skills. Only ~8 are regularly useful (polish, critique, audit, arrange, typeset, colorize, adapt, harden). The rest (overdrive, delight, onboard, clarify, etc.) are rarely needed.
- **color-expert**: Useful skill, but its `/references/` directory is ~985K tokens of paint theory. The SKILL.md itself is only 221 lines.
- **learn/review-skill/teach-impeccable**: Meta-skills for skill management — rarely needed for code tasks.
- **empirical-prompt-tuning**: Niche, mostly theoretical.

### Missing Skills
- No agentic pipeline optimization skill
- No context budget management skill
- No model routing skill

---

## Current Agent Bottlenecks

1. **No context budget**: Agents load AGENTS.md + CLAUDE.md + skills + docs without limit
2. **No skill filtering**: Skills are selected by keyword trigger, not by task analysis
3. **No model routing**: All tasks go to whatever model the agent platform assigns
4. **Autopilot prompts are well-structured** but have no budget caps or context pack selection
5. **GitNexus duplicated in both CLAUDE.md and AGENTS.md** — double-loaded for Claude
6. **Color-expert references bloat**: ~985K tokens that should never be loaded automatically
7. **No telemetry for agentic dev costs**: AI cost tracking exists for Advisor only

---

## Token Waste Sources (estimated)

| Source | Estimated Waste | Fix |
|---|---|---|
| .claude/.agents duplication | ~220K tokens per session if both loaded | Deduplicate, use canonical source |
| GitNexus block in both AGENTS.md + CLAUDE.md | ~1.5K tokens | Remove from CLAUDE.md, reference AGENTS.md |
| color-expert references auto-load risk | ~985K tokens | Mark never-auto-load |
| FINANCE-OS-CONTEXT.md if loaded | ~27K tokens | Archive |
| Loading all 33 Impeccable skills | ~40K tokens | Load only task-relevant subset |
| Loading all 20 generated GitNexus domain skills | ~15K tokens | Load only matching domain |

---

## Immediate Optimization Opportunities

1. **Create context packs** — compact, task-specific bundles replacing monolithic docs
2. **Implement context budget manager** — enforce max tokens per task type
3. **Implement skill router** — select skills by task domain, not keyword
4. **Remove GitNexus duplication** from CLAUDE.md (keep in AGENTS.md only)
5. **Mark FINANCE-OS-CONTEXT.md as archive**
6. **Exclude color-expert/references/ from auto-loading**
7. **Add `tier` metadata to all skills** for routing
8. **Create model routing policy** — cheap models for mechanical tasks, frontier for architecture
9. **Design cache-friendly stable prefixes** — AGENTS.md + core invariants as stable prefix
10. **Add agentic cost telemetry** — separate from AI Advisor costs

---

## Current Model Routing Gaps

- No model selection policy for agentic tasks
- Pricing registry covers gpt-5.4/5.4-mini/5.4-nano, claude-sonnet-4-6, claude-haiku-4-5
- Missing: Kimi, Qwen, Hermes, Gemma pricing entries
- No routing dimensions (task type, risk, context size, cost budget)
- No escalation policy (cheap first, escalate when blocked)

## Current CI/Autopilot Status

- 9 autopilot workflows, well-structured
- Batch prompts have basic token counting (word-based approximation)
- No context budget enforcement in issue templates
- No context pack selection in spec/improve/implement templates
- PR patch contract (AUTOPILOT_PATCH_V1) is solid
- Queue pump preserves lane safety
- CI failure reporting exists
