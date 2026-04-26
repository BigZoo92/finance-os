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
    - pricing: `https://platform.claude.com/docs/en/about-claude/pricing`
    - API/data retention: `https://platform.claude.com/docs/en/build-with-claude/api-and-data-retention`

### Required for internal server-to-server calls

- `PRIVATE_ACCESS_TOKEN`
  - shared by API, worker, and SSR runtime if they call protected internal routes
  - used by optional schedulers and internal-only API calls
  - not required just to click the admin button from the browser

### Optional but recommended

- `AI_OPENAI_BASE_URL`
- `AI_ANTHROPIC_BASE_URL`
  - only if you route requests through your own gateway
- `AI_USD_TO_EUR_RATE`
  - explicit FX conversion for reporting
- `KNOWLEDGE_SERVICE_ENABLED=true`
  - only after `apps/knowledge-service` is running and reachable internally
- `NEO4J_PASSWORD`
  - required when using the Neo4j production graph backend

## Where To Store Secrets

### Local development

Use:

- `.env`

Rules:

- keep provider keys server-side only
- do not place provider secrets in any `VITE_*` variable
- do not commit `.env`

### Production runtime

Use:

- Dokploy runtime variables for API, worker, and web SSR where needed

Recommended split:

- API:
  - all `AI_*` provider, budget, and advisor flags
  - all `KNOWLEDGE_*`, `NEO4J_*`, and `QDRANT_*` server-only values
  - `PRIVATE_ACCESS_TOKEN`
- Worker:
  - `PRIVATE_ACCESS_TOKEN`
  - scheduler flags (`AI_DAILY_AUTO_RUN_ENABLED`, `WORKER_AUTO_SYNC_ENABLED`, `NEWS_AUTO_INGEST_ENABLED`, `MARKET_DATA_AUTO_REFRESH_ENABLED`)
- Web SSR:
  - browser-safe `VITE_*` flags only
  - `PRIVATE_ACCESS_TOKEN` only if SSR protected internal calls require it

### GitHub

Safe only for browser-safe defaults:

- `VITE_AI_ADVISOR_ENABLED`
- `VITE_AI_ADVISOR_ADMIN_ONLY`

Do not put provider API keys in `VITE_*`.

## Environment Variables

### Browser-safe flags

- `VITE_AI_ADVISOR_ENABLED`
- `VITE_AI_ADVISOR_ADMIN_ONLY`

### API runtime flags

- `AI_ADVISOR_ENABLED`
- `AI_ADVISOR_ADMIN_ONLY`
- `AI_ADVISOR_FORCE_LOCAL_ONLY`
- `AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED`
- `AI_CHAT_ENABLED`
- `AI_CHALLENGER_ENABLED`
- `AI_RELABEL_ENABLED`
- `AI_OPENAI_API_KEY`
- `AI_OPENAI_BASE_URL`
- `AI_OPENAI_CLASSIFIER_MODEL`
- `AI_OPENAI_DAILY_MODEL`
- `AI_OPENAI_DEEP_MODEL`
- `AI_ANTHROPIC_API_KEY`
- `AI_ANTHROPIC_BASE_URL`
- `AI_ANTHROPIC_CHALLENGER_MODEL`
- `AI_USD_TO_EUR_RATE`
- `AI_BUDGET_DAILY_USD`
- `AI_BUDGET_MONTHLY_USD`
- `AI_BUDGET_DISABLE_CHALLENGER_RATIO`
- `AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO`
- `AI_SPEND_ALERT_DAILY_THRESHOLD_PCT`
- `AI_SPEND_ALERT_MONTHLY_THRESHOLD_PCT`
- `AI_MAX_CHAT_MESSAGES_CONTEXT`

### Worker and scheduler flags

- `AI_DAILY_AUTO_RUN_ENABLED`
- `AI_DAILY_INTERVAL_MS`
- `WORKER_AUTO_SYNC_ENABLED`
- `POWENS_SYNC_INTERVAL_MS`
- `NEWS_AUTO_INGEST_ENABLED`
- `NEWS_FETCH_INTERVAL_MS`
- `MARKET_DATA_AUTO_REFRESH_ENABLED`
- `MARKET_DATA_REFRESH_INTERVAL_MS`
- `PRIVATE_ACCESS_TOKEN`

## Recommended Configurations

### Manual-first local admin mode

```env
VITE_AI_ADVISOR_ENABLED=true
VITE_AI_ADVISOR_ADMIN_ONLY=true

AI_ADVISOR_ENABLED=true
AI_ADVISOR_ADMIN_ONLY=true
AI_ADVISOR_FORCE_LOCAL_ONLY=false
AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=true
AI_CHAT_ENABLED=true
AI_CHALLENGER_ENABLED=true
AI_RELABEL_ENABLED=true

AI_DAILY_AUTO_RUN_ENABLED=false
WORKER_AUTO_SYNC_ENABLED=false
NEWS_AUTO_INGEST_ENABLED=false
MARKET_DATA_AUTO_REFRESH_ENABLED=false

AI_BUDGET_DAILY_USD=5
AI_BUDGET_MONTHLY_USD=75
AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO=0.5
AI_BUDGET_DISABLE_CHALLENGER_RATIO=0.75
AI_MAX_CHAT_MESSAGES_CONTEXT=8
```

### Deterministic compile-safe local mode without provider keys

```env
VITE_AI_ADVISOR_ENABLED=true
VITE_AI_ADVISOR_ADMIN_ONLY=true

AI_ADVISOR_ENABLED=true
AI_ADVISOR_ADMIN_ONLY=true
AI_ADVISOR_FORCE_LOCAL_ONLY=true
AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=false
AI_CHAT_ENABLED=true
AI_CHALLENGER_ENABLED=false
AI_RELABEL_ENABLED=false

AI_DAILY_AUTO_RUN_ENABLED=false
WORKER_AUTO_SYNC_ENABLED=false
NEWS_AUTO_INGEST_ENABLED=false
MARKET_DATA_AUTO_REFRESH_ENABLED=false
```

This keeps the feature visible and functional in deterministic/local-only mode even before provider keys are added.

## Setup Steps

1. apply the DB migrations

```bash
pnpm db:migrate
```

2. set the advisor env vars in local `.env` or Dokploy
3. start the runtimes

```bash
pnpm api:start
pnpm worker:start
pnpm web:dev
```

4. log in as admin and open `/actualites`
5. click `Tout rafraichir et analyser`

Equivalent manual API trigger:

```bash
curl -X POST http://127.0.0.1:3001/dashboard/advisor/manual-refresh-and-run \
  -H "content-type: application/json" \
  -H "cookie: <admin-session-cookie>"
```

Optional status reads:

- `GET /dashboard/advisor/manual-refresh-and-run`
- `GET /dashboard/advisor/manual-refresh-and-run/:operationId`

Artifacts remain readable through:

- `GET /dashboard/advisor`
- `GET /dashboard/advisor/recommendations`
- `GET /dashboard/advisor/spend`
- `GET /dashboard/advisor/evals`

## Manual Assets In Admin

Current rule:

- no hardcoded manual asset is injected in admin mode anymore
- admin shows only provider-backed assets plus the manual assets you explicitly create
- demo can keep deterministic mock manual assets

How to add a manual asset:

- UI: `/patrimoine` -> section `Actifs manuels admin`
- API:
  - `GET /dashboard/manual-assets`
  - `POST /dashboard/manual-assets`
  - `PATCH /dashboard/manual-assets/:assetId`
  - `DELETE /dashboard/manual-assets/:assetId`

## Optional vs Required

Required for deterministic advisor surface:

- DB migration
- `VITE_AI_ADVISOR_ENABLED=true`
- `AI_ADVISOR_ENABLED=true`

Required for the current recommended admin-only posture:

- `VITE_AI_ADVISOR_ADMIN_ONLY=true`
- `AI_ADVISOR_ADMIN_ONLY=true`

Required for paid provider usage:

- `AI_OPENAI_API_KEY`

Required for challenger:

- `AI_ANTHROPIC_API_KEY`
- `AI_CHALLENGER_ENABLED=true`

Optional:

- `AI_OPENAI_BASE_URL`
- `AI_ANTHROPIC_BASE_URL`
- `AI_USD_TO_EUR_RATE`

## How To Track Spend

Use:

- UI: `/actualites` advisor spend section
- API: `GET /dashboard/advisor/spend`
- DB tables:
  - `ai_model_usage`
  - `ai_cost_ledger`
  - `ai_run`
  - `ai_run_step`
  - `ai_manual_operation`
  - `ai_manual_operation_step`

Price registry source:

- `packages/ai/src/pricing/registry.ts`

## How To Update Prices Later

1. read the official provider pricing pages
2. update `packages/ai/src/pricing/registry.ts`
3. bump the registry version string
4. run:

```bash
bun test packages/ai/src
```

5. update:

- `docs/AI-COSTS.md`
- this file

## How To Disable Cleanly

Disable all advisor surfaces:

```env
VITE_AI_ADVISOR_ENABLED=false
AI_ADVISOR_ENABLED=false
AI_DAILY_AUTO_RUN_ENABLED=false
```

Keep the advisor visible but deterministic-only:

```env
AI_ADVISOR_FORCE_LOCAL_ONLY=true
AI_CHALLENGER_ENABLED=false
AI_RELABEL_ENABLED=false
```

Keep the advisor visible but switch knowledge Q&A to browse-only:

```env
AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED=false
```

Disable the expensive layers first:

```env
AI_CHALLENGER_ENABLED=false
```

## How To Enable Automation Later

Enable advisor scheduler later with:

```env
AI_DAILY_AUTO_RUN_ENABLED=true
```

Enable Powens auto-sync later with:

```env
WORKER_AUTO_SYNC_ENABLED=true
```

If you also want background news or market refresh:

```env
NEWS_AUTO_INGEST_ENABLED=true
MARKET_DATA_AUTO_REFRESH_ENABLED=true
```

No code change should be needed for those later activations.

## Estimated Operating Budget

Expected monthly ranges for a single-user cockpit:

- light: `$10-$25`
- standard: `$25-$75`
- heavy experimentation: `$75-$150+`

The main drivers are:

- number of manual full-mission reruns
- chat frequency
- news/context volume sent to the daily model
- challenger remaining enabled

## Guardrails And Known Risks

- no secrets in `VITE_*`
- demo mode never hits DB or providers
- chat is grounded on persisted artifacts, not raw full-history dumps
- costs are estimated from provider usage payloads plus the local pricing registry
- `AI_USD_TO_EUR_RATE` is explicit and can drift from real FX if not updated
- provider outages degrade to deterministic artifacts; they do not remove the advisor surface entirely
- knowledge-answer retrieval degrade must keep static topic browsing available instead of returning a dead-end error
- the current recommended mode is manual-first, so freshness depends on the operator clicking the full refresh button
