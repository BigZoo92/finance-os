# ADR: Agent Efficiency System — Context Budget, Skill Router, Model Router

> Status: Accepted
> Date: 2026-04-26
> Authors: Human + Claude (architecture review)
> Supersedes: None
> Related: [temporal-knowledge-graph-graphrag.md](temporal-knowledge-graph-graphrag.md)

## Context

Finance-OS uses multiple AI agents (Codex, Claude, Kimi, Qwen, Hermes, Gemma) for development tasks. Current state:
- No context budget enforcement — agents can load the entire repo brain (~1.7M tokens)
- No skill routing — skills are loaded by keyword matching only
- No model routing — no policy for which model handles which task type
- No prompt caching strategy — context packs are not designed for cache-friendly prefixes
- No agentic cost telemetry — AI Advisor costs are tracked, but dev pipeline costs are not

## Decision

Implement an Agent Efficiency System with four components:

### 1. Context Budget Manager

**How contexts are selected:**
- Each task declares a budget tier: `small` (8K), `medium` (16K), `large` (32K), `xlarge` (64K), `autonomous` (128K)
- A context pack is selected based on task domain, then trimmed to fit budget
- Context packs are ordered: always-load > domain-core > task-relevant > optional
- Anything exceeding budget is dropped with a warning

**How docs are tiered:**
| Tier | Contents | When loaded |
|---|---|---|
| `always` | AGENTS.md (root), core invariants summary | Every task |
| `domain-core` | Local AGENTS.md for touched app/package, relevant docs/context/* | When task matches domain |
| `task-relevant` | Selected skills, specific docs | When skill router selects them |
| `optional` | External skill references, generated domain skills | Only if budget allows |
| `archive` | FINANCE-OS-CONTEXT.md, setup docs, deprecated stubs | Never auto-loaded |
| `never-auto-load` | color-expert references, large reference libraries | Only on explicit request |

**How budgets are enforced:**
- `scripts/agent-context/estimate-tokens.mjs` counts tokens using 4-chars-per-token approximation
- `scripts/agent-context/check-budget.mjs` validates context pack + skills + task fit within budget
- CI can run `pnpm agent:context:check` to warn on bloated issue templates

### 2. Skill Router

**How skills are selected:**
- Each task type maps to a set of required + optional skills
- Skills are ranked by: local-Finance-OS priority > trust tier > domain match > token cost
- Maximum skills per task: 3 required + 2 optional (configurable)
- Overlap detection: if two skills cover the same topic, only the higher-priority one loads
- Missing/stale skill detection via manifest validation

**Skill domains:**
core-invariants, web-ui, tanstack, api-backend, worker-sync, powens, knowledge-graph, ai-advisor, finance-engine, database, redis, docker-deploy, ci-cd, testing, accessibility, performance, design-polish, security, agentic-autopilot, documentation.

### 3. Model Router Policy

**How model routing works:**
- Each task has dimensions: type, risk, context_size, creativity, code_execution, expected_tokens, cost_budget, latency_tolerance, privacy, research_needed, repo_write, strict_format
- A routing policy maps dimensions to model selection
- Default: cheapest capable model first, escalate when blocked or high-risk

**Model roles:**

| Model | Primary Role | Budget | Context |
|---|---|---|---|
| Codex / GPT-5.5 | Implementation, multi-file refactors, CI patches | medium-high | 128K |
| Claude Sonnet/Opus | Architecture review, UX, security, docs quality, long reasoning | medium-high | 200K/1M |
| Kimi K2 | Long-context exploration, large doc synthesis, cheap discovery | low-medium | 1M+ |
| Qwen3-Coder | Low-cost coding, tests, mechanical refactors, simple fixes | low | 128K |
| Hermes | Experimental agent memory, self-improving loops | low | varies |
| Gemma (local) | Classification, summarization, offline triage, fail-soft | near-zero | 8K-32K |

**Budget policies:**
- Default model: Qwen or GPT-5.4-mini for simple tasks
- Escalate to Codex/Claude for blocked, high-risk, or architecture tasks
- Claude as challenger only for high-risk changes
- No frontier model for grep/search/formatting
- Skip model entirely if deterministic script suffices

### 4. Prompt Caching Strategy

**How cache-friendly prefixes are preserved:**
- Stable prefix = AGENTS.md + core invariants + selected context pack (versioned, no timestamps)
- Volatile suffix = task-specific payload + output contract
- Context packs are versioned with content hashes, not timestamps
- Reordering stable content busts cache — maintain fixed order

**Provider-specific notes:**
- OpenAI: automatic prefix caching, 128-token granularity, 5-60min TTL
- Anthropic: explicit cache_control breakpoints, 1024-token minimum, 5min/1h TTL tiers
- Both benefit from stable, repeated prefixes

## Architectural Boundaries

- **AI Advisor is not the agentic pipeline.** Financial knowledge graph stores personal finance context. Agentic observations are tagged with `domain: 'agentic'` and isolated by scope/source.
- **The financial knowledge graph can store agentic observations, but those observations are tagged and isolated.** Node types: Model, AgentSkill, AgentRun, CostObservation, TokenUsageObservation — all with `domain: 'agentic'`.
- **No model should receive the entire repo context by default.** Maximum auto-loaded context is bounded by task budget tier.
- **Every large agent task must have an explicit context budget.** Tasks without budget default to `medium` (16K tokens).
- **Every loaded skill must be justified by task domain.** The skill router selects, not the agent.

## Alternatives Considered

| Approach | Pros | Cons | Decision |
|---|---|---|---|
| One giant prompt | Simple | Massive token waste, no caching | Rejected |
| Batch issue decomposition | Already exists | Needs budget enforcement | Enhance |
| Context pack approach | Cache-friendly, predictable | Requires maintenance | **Adopted** |
| Retrieval-based context (RAG) | Dynamic, precise | Complex infra, latency | Deferred (GitNexus provides some of this) |
| Skill routing | Reduces irrelevant loading | Needs manifest | **Adopted** |
| Model routing | Cost optimization | Needs policy + config | **Adopted** |
| Stable prefix caching | Major cost reduction | Requires discipline | **Adopted** |
| Long-context brute force | Simple with Kimi/Gemini | Expensive, no cache benefit | Rejected as default |
| Local models for cheap tasks | Near-zero cost | Limited capability | Adopted for triage/classification |

## How Long-Running Prompts Are Split

1. Batch spec expansion: context pack + task bullets (already structured)
2. Implementation: context pack + spec + relevant code (via GitNexus)
3. Review: context pack + diff + invariants
4. Each step has its own budget tier

## How Token/Cost Estimates Are Measured

- Pre-task: `estimate-tokens.mjs` counts selected context
- Post-task: actual tokens from provider response
- Telemetry JSON schema records both estimates and actuals
- Separate ledger for agentic vs AI Advisor costs

## How the Knowledge Graph Receives Agentic Observations

- Agentic observations use existing graph node types (Model, AgentRun, CostObservation, TokenUsageObservation)
- All tagged with `domain: 'agentic'`, `source: 'dev-pipeline'`
- Financial advisor data tagged with `domain: 'financial'`, `source: 'advisor'`
- Query isolation: graph queries filter by domain
- No cross-contamination between financial advice and dev metrics

## Consequences

- Agents load 5-10x less context per task
- Prompt caching hit rates increase significantly
- Model costs decrease via routing to cheaper models for simple tasks
- Skills are loaded precisely, reducing irrelevant instructions
- Agentic costs become measurable and trackable
- Future agents can prove optimization via telemetry
