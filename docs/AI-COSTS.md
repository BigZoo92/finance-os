# AI Costs

Last updated: 2026-04-26

## What Is Implemented

Finance-OS now tracks AI spend as a first-class operational concern:

- per call: `ai_model_usage`
- per ledger line: `ai_cost_ledger`
- per run: `ai_run` + `ai_run_step`
- per manual mission: `ai_manual_operation` + `ai_manual_operation_step`
- per UI view: `/dashboard/advisor/spend`

The pricing source of truth is:

- `packages/ai/src/pricing/registry.ts`

Current pricing registry version:

- `2026-04-14`

## Pricing Registry Rules

- prices are versioned, not embedded in route code
- each pricing entry stores:
  - provider
  - model
  - effective date
  - source URL
  - input/output prices
  - cache/batch prices when relevant
- cost estimates are computed from observed usage payloads and the registry version active at call time

## Supported Cost Dimensions

Each model usage row records:

- provider
- model
- feature
- endpoint type
- run id
- run step id
- input tokens
- output tokens
- cached input tokens
- cache write tokens
- batch flag
- latency
- estimated USD
- estimated EUR

The spend analytics endpoint aggregates:

- daily totals
- weekly/monthly rollup via ledger date
- by provider
- by model
- by feature
- anomalies and budget-state warnings

## Budget Controls

Relevant env vars:

- `AI_BUDGET_DAILY_USD`
- `AI_BUDGET_MONTHLY_USD`
- `AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO`
- `AI_BUDGET_DISABLE_CHALLENGER_RATIO`
- `AI_SPEND_ALERT_DAILY_THRESHOLD_PCT`
- `AI_SPEND_ALERT_MONTHLY_THRESHOLD_PCT`

Behavior:

- below deep-analysis ratio: full stack available
- above deep-analysis ratio: deeper synthesis is disabled first
- above challenger ratio: challenger is disabled next
- above hard daily/monthly budget: model calls are blocked and the advisor falls back to deterministic artifacts

## Default Operating Posture

Current recommended mode:

- manual full mission from `/actualites`
- `AI_DAILY_AUTO_RUN_ENABLED=false`
- `WORKER_AUTO_SYNC_ENABLED=false`
- `NEWS_AUTO_INGEST_ENABLED=false`
- `MARKET_DATA_AUTO_REFRESH_ENABLED=false`

Suggested initial budget for a single-user deployment:

- local/dev: `AI_BUDGET_DAILY_USD=2`, `AI_BUDGET_MONTHLY_USD=40`
- production cautious: `AI_BUDGET_DAILY_USD=5`, `AI_BUDGET_MONTHLY_USD=75`

Rough operating bands:

- light usage: `$10-$25/month`
- normal daily brief + challenger + occasional chat: `$25-$75/month`
- heavy manual reruns and frequent chat: `$75-$150+/month`

These are estimates, not guarantees. Real usage depends on prompt size, news volume, chat frequency, and whether challenger stays enabled.

## How To Update Prices

1. check official provider pricing pages
2. update `packages/ai/src/pricing/registry.ts`
3. bump `AI_PRICING_REGISTRY_VERSION`
4. add/update pricing tests in `packages/ai/src/pricing/registry.test.ts`
5. document the change in `docs/AI-SETUP.md` and this file

Do not hardcode provider prices anywhere else.

## Cost Reduction Strategy Implemented

- deterministic metrics and recommendations first
- OpenAI nano/mini tiers for cheap classification and daily drafting
- Anthropic challenger only on top recommendations
- compact, targeted context instead of full history prompts
- persisted artifacts reused by chat and overview reads
- `KnowledgeContextBundle` adds a `tokenEstimate` and `maxTokens` cap before any graph context is inserted into advisor prompts

## Knowledge Graph Cost Posture

- Default embeddings are local deterministic hashing, so the graph adds no external model spend by default.
- External embedding providers are optional and server-only; never put embedding keys in `VITE_*`.
- Graph context should remain compact. The current default `KNOWLEDGE_GRAPH_MAX_CONTEXT_TOKENS=1800` is a ceiling, not a target.
- Cost observations and token usage can be stored as graph nodes for future model-router intelligence, but they must be provenance-backed and may be stale.
- budget-aware step skipping before hard failure

## Known Limits

- EUR conversion is controlled by `AI_USD_TO_EUR_RATE`; it is explicit, not live FX
- cost is estimated from provider usage metadata and the local pricing registry version
- no external billing reconciliation job is implemented yet
