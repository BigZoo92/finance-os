# AI Advisor Context Pack — Finance-OS

> Auto-generated. Source: docs/AI-SETUP.md, packages/ai/
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## AI Advisor Architecture

# AI Setup

Last updated: 2026-04-26

## Goal

This document describes the currently recommended advisor posture for Finance-OS:

- advisor stack enabled
- educational knowledge Q&A enabled
- chat, challenger, relabel, spend analytics, runs, signals, assumptions, evals enabled
- admin-only UI and mutations
- manual orchestration first
- no silent auto-run and no silent Powens auto-sync

This does not change GitHub workflows or the agentic/autopilot pipeline.

## Current Recommended Mode

Recommended now:

- `VITE_AI_ADVISOR_ENABLED=true`
- `VITE_AI_ADVISOR_ADMIN_ONLY=true`
- `AI_ADVISOR_ENABLED=true`
- `AI_ADVISOR_ADMIN_ONLY=true`
- `AI_ADVISOR_FORCE_LOCAL_ONLY=false`
- `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=true`
- `KNOWLEDGE_SERVICE_ENABLED=false` until the internal service is running
- `KNOWLEDGE_SERVICE_URL=http://127.0.0.1:8011` locally or `http://knowledge-service:8011` in Docker
- `KNOWLEDGE_GRAPH_RETRIEVAL_MODE=hybrid`
- `AI_CHAT_ENABLED=true`
- `AI_CHALLENGER_ENABLED=true`
- `AI_RELABEL_ENABLED=true`
- `AI_DAILY_AUTO_RUN_ENABLED=false`
- `WORKER_AUTO_SYNC_ENABLED=false`
- `NEWS_AUTO_INGEST_ENABLED=false`
- `MARKET_DATA_AUTO_REFRESH_ENABLED=false`

Operational consequence:

- the advisor surface is visible on `/actualites`
- the educational Q&A card is visible on `/actualites` with confidence, citations, and browse-topics fallback
- `/memoire` exposes graph health, hybrid search, entity inspection and AI Advisor context preview
- admin mode can call the internal knowledge service when `KNOWLEDGE_SERVICE_ENABLED=true`
- demo mode uses deterministic graph fixtures and never writes
- the full mission is started manually from the admin button `Tout rafraichir et analyser`
- no background advisor scheduler runs by itself
- no Powens auto-sync scheduler runs by itself
- no news auto-ingest scheduler runs by itself
- no market auto-refresh scheduler runs by itself

## Providers Enabled Now

Active now:

- OpenAI
  - transaction relabeling
  - daily brief drafting
  - grounded chat
- Anthropic Claude
  - challenger review on important recommendations

Prepared for later, not fully activated:

- Gemma/Qwen/local provider slot
  - targeted role 1: deterministic rewrite + normalization workloads (low-risk text shaping)
  - targeted role 2: degraded-mode prose fallback when OpenAI/Anthropic calls are budget-capped or unavailable
  - targeted role 3: local prompt-eval sandbox for privacy-sensitive experimentation before paid-provider rollout
- Twitter/X ingestion
- crypto ingestion

## Keys And Tokens To Generate

### Required for full paid mode

- `AI_OPENAI_API_KEY`
  - generate from your OpenAI API project
  - official docs:
    - models: `https://platform.openai.com/docs/models`
    - pricing: `https://openai.com/api/pricing/`
    - structured outputs: `https://developers.openai.com/api/docs/guides/structured-outputs`
- `AI_ANTHROPIC_API_KEY`
  - generate from Anthropic Console
  - official docs:
    - pricing: `https://platform.claude.com/docs/en/abo

## Key Constraints

- AI Advisor is NOT the agentic development pipeline
- Deterministic finance-engine outputs first, LLM enriches/explains/challenges
- Budget policy: daily + monthly caps, challenger and deep-analysis gates
- Pricing registry in packages/ai/src/pricing/registry.ts
- Cost ledger tracks per-model, per-feature usage in PostgreSQL
- Knowledge graph context enriches recommendations (not source of truth)
- Never enable trading execution
