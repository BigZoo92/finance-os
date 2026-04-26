# Agent Runbook — Finance-OS

> How to use the Agent Efficiency System for optimized agentic workflows.

## Before Starting Any Agent Task

1. **Identify task domains**: What areas does this task touch? (web-ui, api-backend, database, etc.)
2. **Select budget tier**: How much context does the agent need?
   - `small` (8K) — single file change, simple fix
   - `medium` (16K) — feature in one domain
   - `large` (32K) — cross-cutting feature
   - `xlarge` (64K) — architecture change
   - `autonomous` (128K) — complex multi-domain batch
3. **Check context selection**: `pnpm agent:context:select -- --domains=DOMAIN --budget=TIER`
4. **Build prompt** (optional): `pnpm agent:prompt:build -- --domains=DOMAIN --budget=TIER --task="description"`

## For Autopilot (Batch/Spec/Improve/Implement)

1. When creating issues, fill in the **Context budget** and **Context packs** fields
2. Autopilot workflows will respect these constraints
3. Default budget if not specified: `medium` (16K tokens)

## For Manual Claude/Codex Sessions

1. Load the relevant context pack from `docs/agentic/context-packs/`
2. Load only the skills matching your task domain (see [skill-routing.md](skill-routing.md))
3. Do not paste the entire AGENTS.md + CLAUDE.md + all skills — use packs

## For Model Selection

See [model-routing.md](model-routing.md) for the full policy. Quick rules:
- Simple/mechanical → Qwen or GPT-5.4-mini
- Implementation → Codex
- Review/architecture → Claude
- Long-context exploration → Kimi
- Offline/private → Gemma (local)

## After Completing an Agent Task

Record telemetry: `pnpm agent:telemetry:record -- --task-id=ID --type=TYPE --model=MODEL --tokens-in=N --tokens-out=N`

## Maintaining the System

- **Add/edit skills**: edit in `.agentic/source/skills/`, then `pnpm agent:skills:sync`
- **Never edit** `.claude/skills/`, `.agents/skills/`, `.qwen/skills/`, `skills/` directly — they are generated projections
- Regenerate context packs after changing AGENTS.md or docs: `pnpm agent:context:pack`
- Run audit periodically: `pnpm agent:context:audit`
- Run CI checks: `pnpm agent:context:check && pnpm agent:skills:check`
- Update skill routing if skills are added/removed: edit `scripts/agent-context/lib.mjs`

## Key Principle

**AI Advisor is not the agentic pipeline.**
- AI Advisor = financial advisor for personal finance data (`packages/ai/`, `apps/knowledge-service/`)
- Agentic pipeline = repo/dev automation (`scripts/agent-context/`, autopilot workflows)
- They share the knowledge graph infra but are isolated by `domain` tag
