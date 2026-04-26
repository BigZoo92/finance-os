# AI Architecture

Last updated: 2026-04-26

## Scope

Finance-OS now ships a hybrid advisor stack for the personal cockpit:

- deterministic finance engine first
- LLMs only for structured classification, grounded synthesis, and challenger review
- educational knowledge-pack retrieval for bounded finance Q&A
- temporal financial knowledge graph memory and Hybrid GraphRAG context bundles
- persisted artifacts instead of prompting from raw history every time
- explicit cost, budget, and audit trails
- strict demo/admin split

The implementation lives in:

- `packages/finance-engine`
- `packages/ai`
- `apps/knowledge-service`
- `packages/db/src/schema/ai.ts`
- `apps/api/src/routes/dashboard/domain/advisor/**`
- `apps/api/src/routes/dashboard/repositories/dashboard-advisor-repository.ts`
- `apps/api/src/routes/dashboard/routes/advisor.ts`
- `apps/api/src/routes/dashboard/routes/advisor-knowledge.ts`
- `apps/worker/src/advisor-daily-scheduler.ts`
- `apps/api/src/routes/dashboard/domain/advisor/create-manual-refresh-and-run-use-case.ts`
- `apps/api/src/routes/dashboard/domain/dashboard-manual-assets.ts`
- `apps/web/src/components/dashboard/ai-advisor-panel.tsx`

## Research Inputs That Shaped The Design

Official and primary sources used before implementation:

- OpenAI models, pricing, structured outputs, and API/data usage docs
- Anthropic Claude pricing and API/data retention docs
- academic and institutional finance references for CAGR, real return, drawdown, Sharpe, Sortino, risk concentration, and scenario/stress framing

Implementation consequences:

- structured JSON outputs are mandatory for all LLM steps
- provider clients are abstracted behind a small shared interface
- pricing is versioned in code instead of hardcoded inline in business logic
- challenger review is separate from the main analyst path
- deterministic formulas stay the source of truth for metrics and guardrails
- chat uses persisted briefs, recommendations, assumptions, spend state, and signals instead of the raw full history

## Architectural Principles

1. Deterministic first: ratios, allocation drift, cash drag, emergency fund coverage, drawdown, diversification, and scenario outputs come from `packages/finance-engine`.
2. LLM second: OpenAI handles structured drafting/classification; Anthropic handles challenger reviews on the most important recommendations.
3. Challenger isolation: the challenger can only soften, flag, or confirm a recommendation. It does not replace the base deterministic recommendation set.
4. Grounded chat: chat answers consume persisted advisor artifacts and explicit assumptions. The system must prefer "unknown" over invented certainty.
5. Knowledge Q&A stays educational: retrieval is templated, citation-backed, and must block personalized, fiscal, legal, or buy/sell framing.
6. Fail-soft: demo stays fully deterministic. Admin can degrade to deterministic preview artifacts when DB/provider freshness or budget guardrails block deeper runs, and can degrade knowledge answers to browse-only topics when retrieval is disabled or low-confidence.
7. Cost-aware by default: every model call writes model usage and cost ledger records. Budgets can disable challenger or deeper analysis before hard stop.
8. Graph memory is enrichment only: `KnowledgeContextBundle` can add concepts, evidence, contradictions and graph paths, but deterministic `packages/finance-engine` remains the recommendation source of truth.

## Temporal Knowledge Graph Memory

`apps/knowledge-service` provides the internal AI memory layer:

- FastAPI service, internal Docker network only
- Graphiti/Zep-style temporal property graph model
- production target: Neo4j graph + Qdrant hybrid vector retrieval
- deterministic local JSON backend for demo, tests and degraded fallback
- hybrid retrieval across BM25/full-text, vector similarity, relation-weighted traversal, temporal recency, confidence and provenance
- temporal fields: `observedAt`, `validFrom`, `validTo`, `invalidatedAt`, `supersededBy`, `sourceTimestamp`, `ingestionTimestamp`
- contradiction-preserving relations such as `CONTRADICTED_BY`, `WEAKENS`, `INVALIDATES` and `SUPERSEDES`

The graph can store financial concepts, formulas, indicators, assumptions, market/news/tweet signals, model/cost observations and personal snapshots. It must not store unredacted secrets, Powens codes/tokens or raw sensitive financial PII.

See [ADR: Temporal Financial Knowledge Graph Memory + Hybrid GraphRAG](adr/temporal-knowledge-graph-graphrag.md).

## Runtime Modules

### `packages/finance-engine`

Responsibilities:

- asset-class assumptions and target bands
- time-value-of-money formulas
- risk proxies and drawdown helpers
- portfolio snapshot calculation
- deterministic recommendation generation
- simple contribution and cash-opportunity simulations

Outputs:

- `AdvisorSnapshot`
- `DeterministicRecommendation[]`
- explicit assumption logs

### `packages/ai`

Responsibilities:

- provider clients:
  - OpenAI Responses API
  - Anthropic Messages API
- prompt templates and versions
- JSON schemas for structured outputs
- pricing registry and cost estimation
- budget policy
- default seeded eval cases
- `KnowledgeContextBundle` TypeScript contract and compact prompt helper

### API advisor domain

`apps/api/src/routes/dashboard/domain/advisor/create-dashboard-advisor-use-cases.ts` orchestrates:

- deterministic preview generation
- daily pipeline execution
- OpenAI brief generation
- Anthropic challenger review
- transaction relabel suggestions
- educational knowledge topics and answer assembly
- grounded chat
- eval execution and persistence
- knowledge graph stats/query/context-bundle/schema/explain/rebuild proxy endpoints with demo fixtures and admin-only rebuild

`apps/api/src/routes/dashboard/domain/advisor/create-manual-refresh-and-run-use-case.ts` orchestrates the current manual mission:

- prevent concurrent full missions
- enqueue and wait for personal data freshness
- refresh news with the existing news ingest stack
- refresh market context with the existing markets stack
- run the advisor pipeline only after freshness checks or explicit degraded fallback
- persist a readable manual operation status with per-step progress

### API repository

`dashboard-advisor-repository.ts` is the persistence boundary for:

- runs and run steps
- prompt templates
- model usage and cost ledger
- snapshots, briefs, recommendations, challenges
- macro/news signals
- transaction label suggestions
- assumptions
- chat threads/messages
- eval cases and eval runs
- manual operations and their step timeline

`dashboard-manual-assets.ts` reuses the existing unified asset system for admin-authored manual assets instead of a parallel asset store.

### Worker

`apps/worker/src/advisor-daily-scheduler.ts`:

- triggers `POST /dashboard/advisor/run-daily` over `API_INTERNAL_URL`
- respects `EXTERNAL_INTEGRATIONS_SAFE_MODE`
- uses Redis lock to avoid overlapping daily runs
- keeps the internal HTTP contract as the execution boundary

`apps/worker/src/powens-auto-sync-scheduler.ts`, `news-ingest-scheduler.ts`, and `market-refresh-scheduler.ts` remain available, but the current recommended posture keeps them disabled by env and relies on the manual full-mission button instead.

### Web

`AiAdvisorPanel` renders:

- daily brief
- recommendations and challenger outcome
- signals and assumptions
- AI spend analytics
- run history
- educational Q&A with confidence badge, citations, and browse-only topic fallback
- manual full-mission status
- grounded chat
- eval status

`/_app/patrimoine` renders the admin manual-asset CRUD surface backed by `/dashboard/manual-assets`.

## Data Model

The advisor persistence layer adds:

- execution: `ai_run`, `ai_run_step`
- model accounting: `ai_model_usage`, `ai_cost_ledger`
- prompt registry: `ai_prompt_template`
- artifacts: `ai_portfolio_snapshot`, `ai_daily_brief`, `ai_recommendation`, `ai_recommendation_challenge`
- signals and labeling: `ai_macro_signal`, `ai_news_signal`, `ai_transaction_label_suggestion`
- grounding: `ai_assumption_log`, `ai_chat_thread`, `ai_chat_message`
- evaluation: `ai_eval_case`, `ai_eval_run`

Design goals:

- every persisted output points back to a run
- model usage is independent from business artifacts
- prompts and pricing versions remain queryable later
- chat stays replayable without re-reading the whole raw dataset

## Orchestration Modes

### Current recommended mode: manual full mission

The current production recommendation is a single admin-triggered mission started from `/actualites` or `POST /dashboard/advisor/manual-refresh-and-run`.

The flow is:

1. create a manual operation row and acquire a concurrency lock
2. enqueue personal sync for real connections when needed
3. wait for sufficient freshness or mark the step degraded explicitly
4. run `POST /dashboard/news/ingest` logic through the existing use case stack
5. run `POST /dashboard/markets/refresh` logic through the existing use case stack
6. execute the advisor pipeline
7. persist operation steps, advisor artifacts, usages, costs, and evals
8. expose status through `GET /dashboard/advisor/manual-refresh-and-run*`

### Advisor pipeline itself

Once freshness gates are satisfied, the advisor flow is:

1. read dashboard summary, goals, transactions, and news context bundle
2. compute deterministic finance snapshot
3. generate deterministic candidate recommendations
4. build deterministic daily brief fallback
5. optionally ask OpenAI for a structured daily brief draft
6. optionally ask Anthropic to challenge the top recommendations
7. optionally ask OpenAI to relabel ambiguous transactions
8. run seeded eval cases against the resulting state
9. persist artifacts, usage, cost, and eval results
10. expose latest state through `/dashboard/advisor*`

### Optional scheduled mode

The worker scheduler path still exists for later activation:

- `AI_DAILY_AUTO_RUN_ENABLED=true`
- `WORKER_AUTO_SYNC_ENABLED=true`

But it is intentionally off in the current recommended setup.

## Demo/Admin Split

### Demo

- no DB reads
- no DB writes
- no provider calls
- no LLM calls
- deterministic preview overview, educational knowledge Q&A, and deterministic demo chat only

### Admin

- DB-backed reads and persistence
- OpenAI and Anthropic only from the API runtime
- worker can trigger internal runs with `PRIVATE_ACCESS_TOKEN`
- admin mutations include:
  - `POST /dashboard/advisor/manual-refresh-and-run`
  - `POST /dashboard/advisor/run-daily`
  - `POST /dashboard/advisor/relabel-transactions`
  - `/dashboard/manual-assets` CRUD
- expensive steps can degrade independently via budget policy or provider absence
- no hardcoded manual asset is injected in admin mode

## Fail-Soft Behavior

Degradation order for advisor surfaces:

1. persisted artifacts
2. deterministic admin preview rebuilt from current structured dashboard data
3. educational knowledge answer retrieval, else browse-only topic navigation
4. deterministic demo fixtures in demo mode only

If LLM steps fail:

- the run is marked `degraded`, not silently `completed`
- deterministic outputs remain available
- challenger and deep analysis can be skipped without blocking the advisor surface

## Cost And Auditability

Every successful model call records:

- provider
- model
- feature
- endpoint type
- token counts
- cache/batch hints when available
- estimated USD/EUR cost
- latency
- pricing registry version

The daily brief UI surfaces both artifact quality and spend state so the operator can see when the system downgraded itself for cost reasons.

## Extension Points Prepared

Prepared but not fully activated:

- local/on-prem provider slot for Gemma, Qwen, or similar

Targeted Gemma/Qwen integration roles (when enabled):

- deterministic rewrite assistant for high-volume text normalization (category labels, merchant cleanup, summary compression)
- fallback synthesis model for non-critical advisor prose when paid providers are unavailable or budget-capped
- local privacy-first sandbox for prompt/response tuning before promoting prompts to paid production paths
- additional macro/data providers
- Twitter/X signal ingestion
- crypto news/market ingestion
- richer scenario simulators and risk-profile policies

These remain extension points only. The current production path is OpenAI + Anthropic + deterministic engine.
