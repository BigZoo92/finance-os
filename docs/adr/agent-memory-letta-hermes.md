# ADR: Agent Memory — Letta, claude-subconscious, Hermes

> Status: Deferred (prototype later if token reduction proves insufficient)
> Date: 2026-04-26

## Context

Finance-OS already has:
- Claude Code's built-in memory system (`.claude/projects/*/memory/`)
- A Temporal Knowledge Graph with agentic node types (Model, AgentSkill, AgentRun, CostObservation, TokenUsageObservation)
- The new Agent Efficiency System with context packs, skill routing, and telemetry

The question: should we add a third-party persistent agent memory layer?

## Options Evaluated

### 1. Letta / claude-subconscious

**What it is**: A background agent (NOT a simple MCP tool) that runs alongside Claude Code via hooks API. It observes every session transcript, explores the codebase, builds memory over time, and injects "whispers" into Claude Code's prompts. Hooks: SessionStart, UserPromptSubmit (10s), PreToolUse (5s), Stop (120s async).

**Memory**: 8 structured blocks (core_directives, guidance, user_preferences, project_context, session_patterns, pending_items, self_improvement, tool_guidelines). One shared brain across all projects by default. Three modes: whisper (default), full (memory blocks + diffs), off.

**Pros**:
- Self-hostable (Letta server, Apache 2.0)
- Default model (zai/glm-5) is free on Letta Cloud
- Does not mutate CLAUDE.md — whispers only
- Hooks API integration is clean

**Cons**:
- **Not production-ready** — README explicitly says "demo app, not intended for production"
- **Transcript exfiltration** — every session transcript sent to Letta backend (cloud by default)
- **Hidden state** — background agent's reasoning chain is invisible; when it whispers bad guidance, debugging is very difficult
- **Memory confusion** — one shared brain across projects means cross-project leakage
- **No documented staleness/expiry mechanism**
- Production successor (Letta Code) is a different product (standalone agent, not plugin)
- Adds second model inference cost per session (hidden)

### 2. Hermes Agent (NousResearch)

**What it is**: A standalone coding agent (competitor to Claude Code, not a plugin). 95K+ GitHub stars. Persistent memory via MEMORY.md + USER.md files, auto-generated skills from experience, subagent delegation, session search (FTS5/SQLite).

**Memory**: 3 tiers — persistent files (MEMORY.md), procedural skills (auto-created from successful tasks), session search (full-text over past conversations). Agent manages its own memory via a `memory` tool.

**Pros**:
- Fully local-first (MIT licensed, no telemetry)
- Free — cost is purely LLM inference
- `/compress` command for context reduction
- Subagents reduce multi-step pipelines to zero-context-cost turns
- Supports local inference (Ollama, vLLM, llama.cpp)

**Cons**:
- **Not a Claude Code plugin** — adopting means switching agents entirely
- **Abandons existing Codex autopilot workflow** — incompatible architecture
- **Anthropic OAuth billing issues** — credential reuse with Claude subscriptions does not work for many users
- Self-improving skills can compound errors (bad trajectory → bad skill → propagation)
- Windows unsupported (WSL2 only)
- Early (v0.2.x, Feb 2026)

### 3. Custom Knowledge Graph Memory (already available)

**What it is**: Use the existing Neo4j/Qdrant knowledge graph with agentic node types.

**Pros**:
- Already built and integrated
- Clear domain separation (financial vs agentic)
- Exportable, auditable, versionable
- Queryable with Cypher
- No new dependencies

**Cons**:
- Requires knowledge-service to be running
- Not automatic — needs explicit ingestion
- Graph queries need to be written

## Decision: Defer External Tools, Use Existing Infrastructure

**Rationale**:

1. **Claude Code's built-in memory** already provides cross-conversation persistence for preferences, feedback, and project context. This handles the most common "remember X for next time" use cases.

2. **The knowledge graph** already has agentic node types. If we need persistent agent memory beyond Claude's built-in system, the graph is the right place — it's auditable, exportable, and clearly separated from financial data.

3. **The Agent Efficiency System** (context packs, skill routing, budget management) addresses the primary token reduction goal without needing persistent memory. If an agent task costs too many tokens, the fix is better context selection, not better memory.

4. **Adding Letta/claude-subconscious risks**:
   - Creating a hidden source of truth that conflicts with explicit docs
   - Confusing agentic memory with financial advisor memory
   - Adding operational complexity for marginal token savings
   - Making agent behavior harder to debug and reproduce

5. **Hermes** is better evaluated as a cheap local model (already covered by Gemma in the model routing policy) than as a memory system.

## Conditions for Revisiting

Revisit this decision if:
- Token costs remain high even after context packs and skill routing are fully adopted
- A specific agentic workflow requires cross-session state that Claude's built-in memory can't handle
- Letta/claude-subconscious matures significantly and demonstrates clear token reduction metrics
- The knowledge graph proves too heavy for lightweight agentic observations

## If Adopted Later

Requirements:
- Must write summarized observations into the agentic part of the knowledge graph with clear provenance
- Must tag all memories with `domain: 'agentic'`, `source: 'agent-memory'`
- Must not become a hidden source of truth — all important decisions must be in docs/code
- Must be exportable and auditable
- Must run locally/self-hosted
- Must not confuse agentic memory with financial advisor memory
