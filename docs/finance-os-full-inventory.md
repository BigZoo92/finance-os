# Finance-OS Full Inventory

Current-state audit date: 2026-05-02

## 1. Purpose of this document

This document is a current-state inventory of Finance-OS for future product planning, technical architecture work, AI Advisor improvements, external investment onboarding, deployment hardening, and agent work. It documents what is present in the repository now, based on source inspection, existing context docs, GitNexus route/schema maps, and validation commands run during the audit.

This is not a product roadmap by itself. It separates discovered features from recommendations. If a feature, provider, route, or data path was not found in code or documentation, this document says "not found" or "unclear from current code" rather than inventing it.

Primary source files consulted include `AGENTS.md`, `CLAUDE.md`, `FINANCE-OS-CONTEXT.md`, `DESIGN.md`, `docs/context/*.md`, `package.json`, `pnpm-workspace.yaml`, `infra/docker/Dockerfile`, `.github/workflows/*.yml`, `packages/db/src/schema/*`, `packages/env/src/index.ts`, `apps/api/src`, `apps/web/src`, `apps/worker/src`, `apps/knowledge-service/src`, `apps/quant-service/src`, and package source trees under `packages/*/src`.

## 2. Global product overview

Finance-OS is a strictly personal, single-user finance cockpit. The product combines a cockpit/dashboard, banking synchronization, personal assets, goals, expenses, external investment analytics, market/news/social intelligence, an AI Advisor, and experimental quantitative tooling.

The product philosophy is:

- Demo mode is the default path. It must be deterministic, fixture-backed, safe to run without a database, and free of provider calls.
- Admin mode is the real-data path. It is protected by the admin session cookie and/or signed/internal state. It can use the database and external providers.
- Provider failures must fail soft. The application should remain usable with clear fallback copy, cached state, or deterministic mock state.
- The dashboard is DB-first. Normal cockpit reads should not call Powens or other providers directly.
- Secrets are server-only. No secret belongs in `VITE_*`, browser bundles, logs, or public runtime env.
- AI Advisor and agentic development pipelines are separate systems. The Temporal Knowledge Graph / GraphRAG layer is internal memory for the in-app Advisor, not a development-agent source of truth.
- External investment ingestion is read-only analytics. IBKR remains Flex reporting. Binance remains signed read-only Spot/Wallet `GET` allowlists. No trading, withdrawal, transfer, staking, margin/futures, convert, automatic rebalancing, or hidden execution-ready path was found or should be added.

Visible product areas discovered in the web app:

- Cockpit: first screen at `/`, with the protected Liquid Ether hero titled "Cockpit", daily overview, KPI cards, health signals, advisor summary, news, goals, and portfolio/expense summaries.
- Expenses: `/depenses`, with transaction list, range controls, export CSV, category/budget summaries, and admin classification editing.
- Wealth/assets: `/patrimoine`, with assets, accounts, balances, allocations, and manual asset state.
- Investments: `/investissements`, focused on external investments, positions, accounts, trades, cash flows, and context.
- Goals: `/objectifs`, with personal goal creation/progress/archive flows.
- Integrations: `/integrations`, with Powens and external investment connection/sync controls.
- Health: `/sante`, with diagnostics, route/runtime health, and safe operational state.
- Settings: `/parametres`, with configuration and preference UI.
- AI Advisor: `/ia`, `/ia/chat`, `/ia/memoire`, `/ia/trading-lab`, `/ia/couts`.
- Signals: `/signaux`, `/signaux/marches`, `/signaux/social`, `/signaux/sources`.
- Auth and system routes: `/login`, `/powens/callback`, `/health`, `/healthz`, `/version`, and legacy `/transactions`.

## 3. Global technical architecture

### Monorepo structure

The repository is a pnpm workspace defined by `pnpm-workspace.yaml`:

- `apps/*`
- `packages/*`

Root scripts are in `package.json`. Important commands include `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm -r --if-present test`, `pnpm -r --if-present build`, `pnpm check:ci`, smoke scripts, GitNexus commands, and agentic context/skill scripts.

### Apps

- `apps/api`: Bun + Elysia HTTP API. It owns auth, mode derivation, API route composition, dashboard read/write routes, provider integration routes, notifications, enrichment, debug, health, normalized error handling, request IDs, and internal/private gates.
- `apps/web`: TanStack Start / React / Vite frontend. It owns SSR routing, loaders, TanStack Query data access, cockpit UI, route components, public runtime env allowlisting, shell/navigation, design-system usage, and PWA UI.
- `apps/worker`: Bun worker. It owns Powens sync jobs, dashboard news/markets/social/advisor/attention schedulers, external investment sync orchestration, heartbeat/status server, Redis queue consumption, and sync metrics.
- `apps/desktop`: Tauri desktop shell. It wraps the web app for desktop/mobile targets. Build output under `apps/desktop/src-tauri/static`, generated schemas under `apps/desktop/src-tauri/gen`, and Rust target output are generated artifacts.
- `apps/knowledge-service`: Python FastAPI service for knowledge graph, hybrid retrieval, graph/context bundle endpoints, Neo4j/Qdrant optional backends, local fallback, redaction, seeding, and domain ingesters.
- `apps/quant-service`: Python FastAPI service for technical indicators, backtests, metrics, walk-forward analysis, scenario evaluation, and quant capability discovery.

### Packages

- `packages/ai`: AI prompt schemas, prompt text, provider clients, pricing registry, budget policy, knowledge context utilities, and AI eval cases.
- `packages/config-ts`: shared TypeScript config package.
- `packages/db`: Drizzle schema, migrations, DB client, and database contracts.
- `packages/domain`: present in workspace, details unclear from current audit output.
- `packages/env`: server-side environment loading and validation with zod, secret length checks, and safe environment defaults.
- `packages/external-investments`: read-only IBKR Flex and Binance Spot normalization, encrypted credentials, repository, sync job, context bundle, tests.
- `packages/finance-engine`: deterministic finance calculations, advisor snapshots, simulations, and typed domain outputs.
- `packages/powens`: Powens client, encryption helpers, derived data helpers, and tests.
- `packages/prelude`: low-level reusable helpers.
- `packages/redis`: Redis client wrapper.
- `packages/ui`: shared UI primitives and design-system aligned components.

### Backend architecture

`apps/api/src/index.ts` composes route groups and mounts most routes twice: raw internal routes and `/api/*` compatibility routes for web proxy/public traffic. Public browser traffic should terminate at `apps/web`; `apps/api` remains internal in production deployment.

Important backend patterns:

- `x-request-id` is accepted or generated and propagated in responses.
- Auth/session state is derived in `apps/api/src/auth/*`.
- CSRF/origin checks protect unsafe browser methods.
- Sensitive routes use no-store cache controls.
- Errors are normalized and secret-safe.
- Demo mode should use deterministic mocks and avoid DB/provider access.
- Admin mode can access DB/providers behind auth/internal gates.

### Frontend architecture

`apps/web` uses TanStack Start and React routes under `apps/web/src/routes`. Data fetching is centered in `apps/web/src/features/dashboard-api.ts`, TanStack Query hooks, loader-aware route components, and feature-specific demo data. `apps/web/src/lib/public-runtime-env.ts` explicitly allowlists `VITE_*` values that can reach the browser.

The current navigation source is `apps/web/src/components/shell/nav-items.ts`. Route generation output is generated and should not be manually edited.

### Worker architecture

The worker has a central bootstrap file, `apps/worker/src/index.ts`, plus focused scheduler and helper modules:

- `powens-auto-sync-scheduler.ts`
- `news-ingest-scheduler.ts`
- `market-refresh-scheduler.ts`
- `advisor-daily-scheduler.ts`
- `social-signal-scheduler.ts`
- `attention-rebuild-scheduler.ts`
- `external-investments-sync.ts`
- sync integrity, status persistence, reconnect recovery, raw import, gap detection, account dedupe/type helpers

`apps/worker/src/index.ts` is currently a large coordination file and is a maintainability hotspot.

### Database architecture

The database is modeled in Drizzle under `packages/db/src/schema`. Schema domains include Powens banking, accounts/transactions, assets, goals, recurring commitments, news, markets, signals, trading lab, AI advisor, external investments, enrichment, derived recompute, and technical probes. Migrations live under `packages/db/drizzle`.

### Python architecture

Python services are app-local packages with individual `pyproject.toml` files:

- `apps/knowledge-service/pyproject.toml`
- `apps/quant-service/pyproject.toml`

They use FastAPI, Pydantic, ORJSON/Uvicorn, and optional dev dependencies. Phase 2 added per-service `uv.lock` files, Ruff dev dependencies, and root pnpm orchestration (`pnpm python:lint`, `pnpm python:test`, `pnpm python:check`). A root uv workspace was intentionally deferred because the two services are independently deployable and do not currently share Python packages. `pnpm python:format:check` exists as a non-blocking format baseline check and currently reports pre-existing Ruff formatting drift.

### AI/knowledge architecture

The AI Advisor is TypeScript-led through `packages/ai`, `apps/api/src/routes/dashboard/domain/advisor/*`, Drizzle AI tables, and web UI. The knowledge graph service is Python-led and exposes internal graph/RAG endpoints. It supports local deterministic fallback and optional production backends. Knowledge ingestion domains include markets, news, advisor, social, cost ledger, and trading lab.

### Deployment and CI overview

CI is defined in `.github/workflows/ci.yml`. It installs pnpm/Bun, surfaces root `pnpm lint` as an explicit known-failing baseline check, runs the Docker workspace manifest drift check, runs workspace lint/typecheck/test/build, runs Python uv/Ruff/pytest checks, runs a deterministic Playwright demo E2E smoke job, and conditionally builds the Tauri desktop shell when desktop scope is detected.

Release is defined in `.github/workflows/release.yml`. It runs CI, builds GHCR images for web/api/worker from `infra/docker/Dockerfile`, builds a separate knowledge-service image, syncs Dokploy compose/env state, triggers deployment, and runs post-deploy smoke checks.

Production Docker topology is encoded in `infra/docker/Dockerfile` and compose files. The Dockerfile is multi-stage and separates web build, API runtime, and worker runtime. Public route topology must keep `web` public and `api` internal.

## 4. Core modes and data boundaries

### Demo mode

Demo mode is the default product path. It is intended to:

- Use deterministic fixtures/mocks only.
- Avoid DB reads/writes.
- Avoid provider calls.
- Keep analytics descriptive and fixture-backed.
- Keep AI and knowledge contexts deterministic where exposed.
- Return a safe `auth/me` mode that does not imply a real admin session.

Demo data appears in `apps/api/src/mocks`, `apps/web/src/features/demo-data.ts`, and feature-specific frontend fixtures such as market demo data. Some routes also accept mode/search parameters or demo fixture override headers for tests.

### Admin mode

Admin mode is protected by auth/session and internal state. It can:

- Read and write the database.
- Trigger provider sync jobs.
- Store encrypted provider credentials.
- Call server-side providers and AI services.
- Access admin-only navigation items such as AI costs and signal sources.

Admin mode is derived by `apps/api/src/auth/derive.ts` and enforced through auth guard helpers in `apps/api/src/auth/guard.ts`, route runtime checks, and route-specific policies.

### Internal/private calls

Internal/private calls are guarded by server-side internal tokens and signed states. The exact helper paths include `apps/api/src/auth/guard.ts`, Powens callback/state handling under `apps/api/src/routes/integrations/powens`, and internal route mounting in `apps/api/src/index.ts`.

### Auth/session

Auth routes live in `apps/api/src/auth/routes.ts`:

- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`

Passwords are validated against server-only hash env values. Session cookies are secure in production. Login attempts are rate-limited through Redis when available. Auth tests live in `apps/api/src/auth/routes.test.ts` and `apps/api/src/auth/guard.test.ts`.

### Signed state

Signed state is present in Powens connection/callback flows. Exact implementation is in the Powens integration route files and helpers under `apps/api/src/routes/integrations/powens`. The invariant is that Powens codes/tokens and signed state payloads must not be logged.

### Provider safety

Provider integrations must remain server-side:

- Powens credentials and tokens are encrypted at rest.
- IBKR/Binance credentials are encrypted and read-only.
- News/market/social provider keys are env-only.
- AI provider keys are env-only and should never be exposed through `VITE_*`.

### Privacy/secrets boundaries

The audit found browser-facing env allowlisting in `apps/web/src/lib/public-runtime-env.ts`. Public `VITE_*` examples are present for app title, API base URL, health UI flags, Powens cooldown UI flags, PWA flags, AI UI feature flags, and orchestration flags. No secret-bearing `VITE_*` example should be introduced.

### Fail-soft behavior

Fail-soft behavior appears throughout:

- Dashboard reads use fallback/demo data.
- Powens/provider sync failures update status instead of crashing the app.
- News/market providers maintain cache/provider state.
- Knowledge service route proxy returns unavailable fallbacks.
- Quant and knowledge Python services return normalized errors.
- Worker schedulers log failures and continue.

## 5. Feature inventory by domain

### Cockpit dashboard

#### Product purpose

The cockpit is the primary daily finance operating surface. It gives the user a fast read of net worth, liquidity, spending, account sync health, goals, AI recommendations, news/signals, and degraded-state warnings.

#### User-facing behavior

The route is `/` in `apps/web/src/routes/_app/index.tsx`. The navigation label is "Cockpit" in `apps/web/src/components/shell/nav-items.ts`. The page includes the Liquid Ether hero titled "Cockpit" through `apps/web/src/components/reactbits/liquid-ether.tsx`; this hero is explicitly protected from unrelated redesign. The page uses dashboard panels/cards, KPI tiles, health badges, advisor surfaces, news and market summaries, and links into other feature pages.

#### Data displayed

Discovered dashboard data includes totals, ranges, balances, cashflow, expenses, income, savings rate, wealth snapshots, category budgets, recurring commitments, month-end projection, personal goals, assets/positions, bank account sync status, news clusters, market context, AI daily brief, recommendations, health/freshness signals, and provider fallbacks.

#### Data captured

Cockpit itself appears mostly read-only. It can surface actions that navigate to integrations, goals, AI, expenses, or refresh/sync flows depending on mode.

#### Data sources

Sources include deterministic demo fixtures, dashboard DB repositories, finance-engine calculations, Powens-derived accounts/transactions/assets, manual assets/goals, AI tables, news/market tables, and provider/cache state.

#### Backend/API implementation

Main route: `GET /dashboard/summary`, implemented by `apps/api/src/routes/dashboard/routes/summary.ts`. Domain logic is in `apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.ts`. DB reads are in `apps/api/src/routes/dashboard/repositories/dashboard-read-repository.ts` and adjacent repositories. Types are in `apps/api/src/routes/dashboard/types.ts`.

#### Frontend implementation

Frontend API client/types are in `apps/web/src/features/dashboard-api.ts` and `apps/web/src/features/dashboard-types.ts`. UI components live under `apps/web/src/components/dashboard`. Demo data is in `apps/web/src/features/demo-data.ts`.

#### Worker/background behavior

The cockpit consumes worker-updated tables and Redis status indirectly. Worker jobs update Powens sync state, news, markets, advisor daily runs, attention items, and external investment data.

#### Database/storage

Core tables include `financialAccount`, `transaction`, `asset`, `investmentPosition`, `recurringCommitment`, `personalGoal`, AI tables, market/news/signal tables, and external investment tables.

#### External providers

No direct provider calls should happen from cockpit read routes. Provider data should already be stored or cached by sync/ingest flows.

#### Demo/admin behavior

Demo returns fixture-backed deterministic summaries. Admin reads DB state and may include provider freshness/status.

#### Error/fail-soft behavior

Dashboard fallbacks should preserve page usability when data is missing, stale, or provider sync is failing. API errors are normalized and safe.

#### Tests

Dashboard/domain tests exist under `apps/api/src/routes/dashboard/**.test.ts`, finance-engine tests under `packages/finance-engine/src`, and web tests under `apps/web/src`. Gaps: no discovered Playwright E2E test proving cockpit SSR load in demo mode.

#### Known limitations / TODOs

The cockpit depends on a large shared dashboard type surface. Some source files are large, including `apps/web/src/routes/_app/index.tsx`, `apps/web/src/components/dashboard/ai-advisor-panel.tsx`, and `apps/api/src/routes/dashboard/types.ts`.

#### Technical improvement opportunities

Add a minimal Playwright smoke: demo auth state, `/` SSR render, `GET /api/auth/me`, and no provider calls in demo. Split dashboard types by domain. Keep Cockpit hero untouched unless fixing an isolated bug.

### Authentication, demo, and admin mode

#### Product purpose

Auth separates the safe public/demo experience from the real single-user admin cockpit.

#### User-facing behavior

The login page is `apps/web/src/routes/login.tsx`. Demo users can view fixture-backed features. Admin users can access DB/provider controls and admin-only nav items.

#### Data displayed

Mode state, admin availability, user/session state, login errors, and protected/admin-only UI states.

#### Data captured

Admin login password/email fields, logout action, and session cookies.

#### Data sources

Server env hash values, Redis login attempt counters, secure cookies, and auth route derivation.

#### Backend/API implementation

`apps/api/src/auth/routes.ts`, `apps/api/src/auth/guard.ts`, `apps/api/src/auth/derive.ts`, `apps/api/src/auth/origin.ts`, and auth tests. Env validation for hashes is in `packages/env/src/index.ts`.

#### Frontend implementation

`apps/web/src/routes/login.tsx`, shell mode handling, auth query hooks, and route-level admin-only navigation hiding.

#### Worker/background behavior

Workers should not infer browser auth. Worker jobs run through internal queue/env boundaries.

#### Database/storage

No user table was found for multi-user auth. This matches the single-user invariant.

#### External providers

None directly. Auth protects admin provider actions.

#### Demo/admin behavior

Demo is anonymous/safe. Admin requires a valid session and is the only route to DB/provider mutation controls.

#### Error/fail-soft behavior

Login rate-limit failures and invalid credentials return safe normalized errors. Redis failures should not expose secrets.

#### Tests

`apps/api/src/auth/routes.test.ts`, `apps/api/src/auth/guard.test.ts`, `apps/api/src/auth/origin.test.ts` and system route tests.

#### Known limitations / TODOs

No E2E login/auth smoke found. Admin login smoke should use safe local fixtures or secrets only in CI secrets.

#### Technical improvement opportunities

Add E2E mode tests. Keep auth cookie/security assertions. Consider explicit API contract docs for mode response.

### Powens banking integration

#### Product purpose

Powens connects bank accounts, imports accounts and transactions, tracks sync health, and feeds the personal finance cockpit.

#### User-facing behavior

The integration UI is under `/integrations` and the callback route is `/powens/callback`. Users can initiate connect URL, view status/diagnostics, trigger sync, inspect connections, and see cooldown/fallback messaging.

#### Data displayed

Connection status, provider, bank/account identifiers, balances, currencies, sync status, last sync attempt/success/failure, reason codes, diagnostics, sync runs, backlog, audit trail, reconnect state, and Powens-derived accounts/transactions/assets.

#### Data captured

Connect flow actions, callback code/state, manual sync actions, connection deletion/archive action, and optional full resync flags.

#### Data sources

Powens APIs, encrypted Powens token storage, Redis queue/status, DB tables, deterministic demo fixtures.

#### Backend/API implementation

Routes are mounted under `/integrations/powens` and `/api/integrations/powens`:

- `GET /connect-url`
- `POST /callback`
- `GET /status`
- `POST /sync`
- `GET /sync-runs`
- `GET /diagnostics`
- `DELETE /connections/:connectionId`
- `GET /backlog`
- `GET /audit-trail`

Source files live under `apps/api/src/routes/integrations/powens`. Package code is in `packages/powens/src`.

#### Frontend implementation

Integration UI is in `apps/web/src/routes/_app/integrations.tsx` plus API hooks in `apps/web/src/features/dashboard-api.ts`.

#### Worker/background behavior

`apps/worker/src/index.ts` runs connection syncs, records sync run state in Redis, encrypts/decrypts tokens through package helpers, upserts accounts/assets/transactions/raw imports, detects sync integrity issues, handles reconnect recovery, enforces provider disable lists, and schedules auto sync through `powens-auto-sync-scheduler.ts`.

#### Database/storage

Tables in `packages/db/src/schema/powens.ts`:

- `powensConnection`: connection status, provider IDs, encrypted access token, sync timestamps/status/reason metadata.
- `financialAccount`: account identities, balances, currency, provider linkage, archived state.
- `transaction`: booking date, amount, currency, direction, label/hash, category/subcategory/tags, provider IDs.
- `providerRawImport`: raw imported provider objects for audit/replay.

Related tables: `asset`, `derivedRecomputeRun`, `derivedTransactionSnapshot`, recurring commitments.

#### External providers

Powens/Budget Insight API and webview. Env names include `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`, `POWENS_BASE_URL`, `POWENS_DOMAIN`, redirect URI names, webview URL names, sync interval/cooldown flags, and `APP_ENCRYPTION_KEY`.

#### Demo/admin behavior

Demo must not call Powens. Admin can connect/sync when credentials and session/internal state are valid.

#### Error/fail-soft behavior

Provider failure updates sync status and visible diagnostics while preserving app usability. Tokens/codes are not logged. Cooldown and safe-mode flags prevent noisy/risky calls.

#### Tests

Powens package tests: `packages/powens/src/*.test.ts`. Worker tests cover sync windows, account dedupe/type, gap detection, raw imports, reconnect recovery, persistence, and auto sync scheduler. API tests cover related route behavior where present.

#### Known limitations / TODOs

`apps/worker/src/index.ts` carries many Powens responsibilities in one large file. Docker runtime must keep `packages/powens` and related workspace packages copied into API/worker images.

#### Technical improvement opportunities

Extract Powens worker orchestration into smaller modules after adding route/job integration tests. Effect would be valuable here for typed provider errors, retries, timeouts, scoped resources, and circuit-breaker/fail-soft policies.

### Transactions, spending, budgets, and recurring commitments

#### Product purpose

This domain helps the user inspect expenses, classify transactions, understand spending structure, detect recurring commitments, and export recent transactions.

#### User-facing behavior

Primary route: `/depenses` in `apps/web/src/routes/_app/depenses.tsx`. UI includes range selector, export CSV, spending/budget summary panels, transaction table/cards, load-more pagination, and admin-only edit/classification action. There is also a legacy/public route file `apps/web/src/routes/transactions.tsx`.

#### Data displayed

Transaction date, label, account name or Powens account ID, category, subcategory, tags, direction, amount, currency, recurring-commitment links, budget projections, migration discrepancies, and pagination state.

#### Data captured

Admin classification edits: category, subcategory, income type where applicable, and tags. Range/search params and export actions are captured in the UI.

#### Data sources

Powens-synced `transaction` rows, derived snapshots, recurring commitment detection, demo fixtures, and dashboard transactions use case.

#### Backend/API implementation

Routes:

- `GET /dashboard/transactions`
- `GET /dashboard/transactions/migration-discrepancies`
- `PATCH /dashboard/transactions/:transactionId/classification`

Source files: `apps/api/src/routes/dashboard/routes/transactions.ts`, `apps/api/src/routes/dashboard/routes/transaction-classification.ts`, and `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts`.

#### Frontend implementation

`apps/web/src/routes/_app/depenses.tsx`, transaction hooks in `apps/web/src/features/dashboard-api.ts`, and shared UI components.

#### Worker/background behavior

Powens worker upserts transactions and raw imports. Derived recompute snapshots and recurring commitment detection can refresh derived financial state.

#### Database/storage

`transaction`, `recurringCommitment`, `recurringCommitmentTransactionLink`, `derivedTransactionSnapshot`, and `providerRawImport`.

#### External providers

Powens is the main upstream source. Demo mode uses fixtures only.

#### Demo/admin behavior

Demo shows deterministic transactions. Admin can edit classification and query real DB rows. Demo fixture override is present for tests.

#### Error/fail-soft behavior

Missing/stale transaction data should produce empty/degraded states rather than crashing. Classification failures surface safe toast/error copy.

#### Tests

Route/domain tests exist for some transaction and derived recompute paths. Worker tests cover sync integrity and raw import behavior.

#### Known limitations / TODOs

Classification edit UI currently uses prompt-style inputs, which is functional but not the long-term desired UX.

#### Technical improvement opportunities

Add route tests for classification authorization/demo blocking. Replace prompt editing with a small admin form/dialog after UI test coverage exists.

### Wealth, manual assets, and personal portfolio

#### Product purpose

This domain models personal net worth beyond bank transactions: bank accounts, manual assets, investment positions, allocation, and wealth snapshots.

#### User-facing behavior

Primary routes: `/patrimoine` and parts of `/investissements`. UI includes asset/account lists, balances, allocation panels, manual asset CRUD controls, and investment summaries.

#### Data displayed

Asset name, type, category, current value, currency, provider, provider external IDs, Powens account linkage, account balances, investment position metrics, allocation percentages, valuation snapshots, and stale data warnings.

#### Data captured

Manual asset create/update/delete fields: name, type/category, value, currency, notes/metadata where supported.

#### Data sources

Manual assets from DB, Powens accounts/assets, external investments, market data, and deterministic demo fixtures.

#### Backend/API implementation

Routes:

- `GET /dashboard/manual-assets`
- `POST /dashboard/manual-assets`
- `PATCH /dashboard/manual-assets/:assetId`
- `DELETE /dashboard/manual-assets/:assetId`
- dashboard summary/analytics routes consume asset data.

Source files: `apps/api/src/routes/dashboard/routes/manual-assets.ts`, `apps/api/src/routes/dashboard/repositories/dashboard-read-repository.ts`.

#### Frontend implementation

`apps/web/src/routes/_app/patrimoine.tsx`, `apps/web/src/routes/_app/investissements.tsx`, and dashboard API hooks/types.

#### Worker/background behavior

Powens sync upserts assets for Powens financial accounts. External investment sync upserts positions and valuation snapshots.

#### Database/storage

`asset` and `investmentPosition` in `packages/db/src/schema/assets.ts`, plus external investment position tables and Powens financial account tables.

#### External providers

Powens for linked accounts. IBKR/Binance for external investments. Market providers for valuation context where available.

#### Demo/admin behavior

Demo uses deterministic manual assets/positions. Admin persists manual asset edits.

#### Error/fail-soft behavior

Missing valuations and unknown cost basis warnings are surfaced instead of blocking the page.

#### Tests

Manual asset route tests were not specifically identified in baseline output. External investment package tests cover normalization/context bundle logic.

#### Known limitations / TODOs

The wealth route is a large TSX file and should be split only with tests.

#### Technical improvement opportunities

Create asset domain contracts shared between API and web. Add tests for manual asset admin-only write behavior.

### Personal goals

#### Product purpose

Goals let the user track savings, investment, or life objectives against current progress and portfolio/cash position.

#### User-facing behavior

Primary route: `/objectifs` in `apps/web/src/routes/_app/objectifs.tsx`. Dashboard also shows goal cards such as `apps/web/src/components/dashboard/personal-financial-goals-card.tsx`.

#### Data displayed

Goal title, description, target amount/value, current progress, target date, status, archived state, category/type, priority, progress percentage, and linked financial context where available.

#### Data captured

Goal create/update/archive actions and form fields.

#### Data sources

`personalGoal` table, deterministic demo goals, dashboard summary projections.

#### Backend/API implementation

Routes:

- `GET /dashboard/goals`
- `POST /dashboard/goals`
- `PATCH /dashboard/goals/:goalId`
- `POST /dashboard/goals/:goalId/archive`

Source: `apps/api/src/routes/dashboard/routes/goals.ts`.

#### Frontend implementation

`apps/web/src/routes/_app/objectifs.tsx`, goal card components, dashboard API hooks.

#### Worker/background behavior

No dedicated goal worker found. Goals are consumed by dashboard/advisor flows.

#### Database/storage

`personalGoal` in `packages/db/src/schema/goals.ts`.

#### External providers

None directly.

#### Demo/admin behavior

Demo shows deterministic goals. Admin writes DB goals.

#### Error/fail-soft behavior

Write failures should surface safe errors. Missing goals should render empty state.

#### Tests

Goal route tests not specifically identified. UI/web tests cover some route/component behavior.

#### Known limitations / TODOs

Goal calculations and advisor use of goals should be explicitly contract-tested.

#### Technical improvement opportunities

Add admin write tests and advisor-goal context tests.

### External investments: IBKR and Binance

#### Product purpose

External investments bring read-only brokerage/crypto analytics into Finance-OS while preserving strict no-trading boundaries.

#### User-facing behavior

Primary route: `/investissements`; integration controls under `/integrations`. UI displays account summary, positions, trades, cash flows, provider status, diagnostics, sync runs, credential state, stale data, missing market data, and cost basis warnings.

#### Data displayed

Connection/provider status, account IDs/names/types/currencies, instruments, symbols, ISIN/FIGI where available, positions, quantities, average/open cost, market value, P/L, trades, fees, cash flows, valuation snapshots, provider health, last sync time/status, and context bundle warnings.

#### Data captured

Provider credentials/configuration:

- IBKR Flex token/query IDs/config where required by package types.
- Binance read-only API key/secret and allowed permission metadata.
- Sync trigger actions and credential test/delete actions.

Never store plaintext secrets. Credentials are encrypted.

#### Data sources

IBKR Flex reports, Binance read-only Spot/Wallet APIs, encrypted credential table, DB normalized investment tables, market data, deterministic demo fixtures.

#### Backend/API implementation

Dashboard read routes under `/dashboard/external-investments`:

- `GET /summary`
- `GET /accounts`
- `GET /positions`
- `GET /trades`
- `GET /cash-flows`
- `GET /context-bundle`

Integration routes under `/integrations/external-investments`:

- `GET /status`
- `GET /diagnostics`
- `GET /sync-runs`
- `POST /sync`
- `POST /:provider/sync`
- `PUT /:provider/credential`
- `DELETE /:provider/credential`
- `POST /:provider/credential/test`

Source files: `apps/api/src/routes/dashboard/routes/external-investments.ts`, `apps/api/src/routes/integrations/external-investments/*`, and `packages/external-investments/src/*`.

#### Frontend implementation

`apps/web/src/routes/_app/investissements.tsx`, `apps/web/src/routes/_app/integrations.tsx`, dashboard API client/types.

#### Worker/background behavior

`apps/worker/src/external-investments-sync.ts` and `packages/external-investments/src/jobs.ts` orchestrate provider sync, normalization, status persistence, and fail-soft errors.

#### Database/storage

Tables in `packages/db/src/schema/external-investments.ts`:

- `externalInvestmentConnection`
- `externalInvestmentCredential`
- `externalInvestmentSyncRun`
- `externalInvestmentProviderHealth`
- `externalInvestmentRawImport`
- `externalInvestmentAccount`
- `externalInvestmentInstrument`
- `externalInvestmentPosition`
- `externalInvestmentTrade`
- `externalInvestmentCashFlow`
- `externalInvestmentValuationSnapshot`
- `advisorInvestmentContextBundle`

#### External providers

IBKR Flex and Binance Spot/Wallet read-only endpoints. Env names include `EXTERNAL_INVESTMENTS_ENABLED`, `EXTERNAL_INVESTMENTS_SAFE_MODE`, `IBKR_FLEX_*`, and `BINANCE_SPOT_*`.

#### Demo/admin behavior

Demo uses deterministic investment fixtures. Admin can store/test encrypted credentials and run read-only syncs. Safe mode can block sync side effects.

#### Error/fail-soft behavior

Sync failures should update provider health/sync run tables and preserve previous/cached data. Warnings are explicit in context bundles.

#### Tests

`packages/external-investments/src/external-investments.test.ts` exists and passed in baseline. More API route tests should be added.

#### Known limitations / TODOs

`packages/external-investments/src/repository.ts` is large. Docker production stages must include the package, which was corrected in this audit patch.

#### Technical improvement opportunities

Adopt Effect first in this package/job boundary: typed provider errors, retries, timeouts, redacted logging, credential resource scopes, and read-only operation allowlists.

### Markets and macro context

#### Product purpose

Markets/macro context gives the cockpit and AI Advisor fresh market conditions, quotes, macro observations, watchlist state, and context bundles.

#### User-facing behavior

Routes: `/signaux/marches` and legacy `/marches` route file. UI displays market overview, watchlist, macro indicators, context/freshness, provider health, and refresh controls.

#### Data displayed

Ticker, name, price, currency, region, asset class, daily change, percent change, volume, quote timestamp, macro series values, units, source, provider state, cache state, bundle timestamp, freshness/recency, and market narratives.

#### Data captured

Manual refresh action in admin mode. Search/filter actions may be URL/UI state.

#### Data sources

Market providers, macro providers, DB cache tables, deterministic demo market data.

#### Backend/API implementation

Routes:

- `GET /dashboard/markets/overview`
- `GET /dashboard/markets/watchlist`
- `GET /dashboard/markets/macro`
- `GET /dashboard/markets/context-bundle`
- `POST /dashboard/markets/refresh`

Source files: `apps/api/src/routes/dashboard/routes/markets.ts`, `apps/api/src/routes/dashboard/repositories/dashboard-markets-repository.ts`, market provider services, and market analytics domain files.

#### Frontend implementation

`apps/web/src/routes/_app/signaux/marches.tsx`, `apps/web/src/routes/_app/marches.tsx`, `apps/web/src/components/markets/markets-dashboard.tsx`, and market demo data under `apps/web/src/features/markets`.

#### Worker/background behavior

`apps/worker/src/market-refresh-scheduler.ts` schedules refresh. API refresh can also trigger provider fetches in admin/internal mode.

#### Database/storage

`marketQuoteSnapshot`, `marketMacroObservation`, `marketCacheState`, `marketProviderState`, `marketContextBundleSnapshot`, and `marketOhlcvBar`.

#### External providers

Env and docs show EODHD, Twelve Data, and FRED. Related env names include `MARKET_DATA_EODHD_ENABLED`, `MARKET_DATA_TWELVEDATA_ENABLED`, `MARKET_DATA_FRED_ENABLED`, `EODHD_API_KEY`, `TWELVEDATA_API_KEY`, `FRED_API_KEY`, and market series/watchlist env names.

#### Demo/admin behavior

Demo uses deterministic fixtures. Admin can use live providers when enabled, but should fail soft and cache state.

#### Error/fail-soft behavior

Provider failures should preserve previous snapshots/cache state and surface stale/unavailable warnings.

#### Tests

Market scheduler tests exist. Route/domain coverage is partial.

#### Known limitations / TODOs

Large market UI and service files exist. Market data provider contracts would benefit from typed errors and retries.

#### Technical improvement opportunities

Effect is a strong fit for market provider adapters, refresh jobs, timeouts, retry schedules, and freshness scoring.

### News, signals, and social intelligence

#### Product purpose

This domain aggregates finance-relevant news, source health, social signals, and manual imports to inform the cockpit and AI Advisor.

#### User-facing behavior

Routes:

- `/signaux`
- `/signaux/social`
- `/signaux/sources`
- legacy `/actualites`

UI displays article/news feeds, source health, signal items, manual ingestion, social source state, run history, and freshness/quality metrics.

#### Data displayed

News title, source, URL, published date, summary, language, provider IDs, topics, entities, sectors, impact/confidence/recency scores, contradiction/cluster metadata, signal source config, signal item payloads, ingestion run status, health, freshness, and provider diagnostics.

#### Data captured

Admin-only signal source create/update/delete, manual signal/news ingestion payloads, source settings, and social import actions.

#### Data sources

HN Algolia, GDELT, ECB RSS/data, SEC, FRED, social providers, article metadata scraper, DB cache, deterministic demo fixtures.

#### Backend/API implementation

News routes:

- `GET /dashboard/news`
- `GET /dashboard/news/context`
- `POST /dashboard/news/ingest`

Signal routes:

- `GET /dashboard/signals/sources`
- `POST /dashboard/signals/sources`
- `PATCH /dashboard/signals/sources/:id`
- `DELETE /dashboard/signals/sources/:id`
- `GET /dashboard/signals/runs`
- `POST /dashboard/signals/ingest/manual`
- `GET /dashboard/signals/items`
- `GET /dashboard/signals/health`

Source files: `apps/api/src/routes/dashboard/routes/news.ts`, `apps/api/src/routes/dashboard/routes/signal-sources.ts`, `apps/api/src/routes/dashboard/repositories/dashboard-news-repository.ts`, provider services under `apps/api/src/routes/dashboard/services/providers`, and docs in `docs/context/NEWS-FETCH.md`, `docs/context/SIGNALS-PROVIDERS.md`.

#### Frontend implementation

`apps/web/src/routes/_app/signaux/index.tsx`, `/social.tsx`, `/sources.tsx`, `/actualites.tsx`, API hooks/types, and dashboard/news components.

#### Worker/background behavior

`apps/worker/src/news-ingest-scheduler.ts` and `apps/worker/src/social-signal-scheduler.ts` schedule ingestion. Signal sources/runs/items persist status and data.

#### Database/storage

News tables:

- `newsArticle`
- `newsArticleSourceRef`
- `newsCacheState`
- `newsProviderState`

Signal tables:

- `signalSource`
- `signalIngestionRun`
- `signalItem`

#### External providers

HN, GDELT, ECB RSS/data, SEC, FRED, X/Twitter recent search, Bluesky, and metadata scraping. Env names include `NEWS_PROVIDER_*`, `SEC_USER_AGENT`, `FRED_API_KEY`, social source/provider names in docs/env.

#### Demo/admin behavior

Demo must be deterministic and no-provider. Admin can ingest from enabled providers and store source/run/item state.

#### Error/fail-soft behavior

Provider failures update cache/provider state and should not block the dashboard. Article metadata fetch is bounded by byte/time limits.

#### Tests

News scheduler tests exist. Signal source route/domain tests exist in several dashboard files, but root lint currently flags some non-null assertions in signal tests/repositories.

#### Known limitations / TODOs

Source health and manual ingestion need strong no-noise defaults and route tests for admin/demo boundaries.

#### Technical improvement opportunities

Use Effect-style provider adapters for timeout/retry/dedupe and typed provider errors. Keep provider payload redaction and source metadata explicit.

### AI Advisor

#### Product purpose

The AI Advisor explains and challenges deterministic finance-engine outputs, produces daily briefs/recommendations, enables grounded chat, tracks model cost, and can use knowledge/market/news/investment context.

#### User-facing behavior

Routes:

- `/ia`: advisor overview, daily brief, recommendations, assumptions, signals, spend.
- `/ia/chat`: grounded finance chat.
- `/ia/memoire`: knowledge graph/context memory.
- `/ia/couts`: AI model usage/costs, admin-only navigation item.

#### Data displayed

Daily brief, recommendations, recommendation challenges, macro signals, news signals, transaction label suggestions, assumptions, chat messages, model usage, cost ledger, run history, evals, knowledge topics/answers, manual operation progress, and budget warnings.

#### Data captured

Chat messages, manual refresh/run actions, run-daily trigger, relabel-transactions trigger, eval run/query parameters, and admin controls. No secret input should be captured in UI.

#### Data sources

Finance-engine snapshots, dashboard DB data, AI Drizzle tables, AI provider responses, package prompt schemas, news/market/context bundles, external investment context bundles, knowledge service responses, and deterministic demo fallbacks.

#### Backend/API implementation

Routes under `/dashboard/advisor`:

- `GET /advisor`
- `GET /advisor/daily-brief`
- `GET /advisor/recommendations`
- `GET /advisor/runs`
- `GET /advisor/assumptions`
- `GET /advisor/signals`
- `GET /advisor/spend`
- `GET /advisor/knowledge-topics`
- `GET /advisor/knowledge-answer`
- `GET /advisor/manual-refresh-and-run`
- `GET /advisor/manual-refresh-and-run/:operationId`
- `POST /advisor/chat`
- `GET /advisor/chat`
- `GET /advisor/evals`
- `POST /advisor/run-daily`
- `POST /advisor/relabel-transactions`
- `POST /advisor/manual-refresh-and-run`

Source files: `apps/api/src/routes/dashboard/routes/advisor.ts`, `apps/api/src/routes/dashboard/domain/advisor/*`, `apps/api/src/routes/dashboard/repositories/dashboard-advisor-repository.ts`, `packages/ai/src/*`, `packages/finance-engine/src/*`.

#### Frontend implementation

`apps/web/src/routes/_app/ia/index.tsx`, `/chat.tsx`, `/memoire.tsx`, `/couts.tsx`, `apps/web/src/components/dashboard/ai-advisor-panel.tsx`, and dashboard API hooks/types.

#### Worker/background behavior

`apps/worker/src/advisor-daily-scheduler.ts` schedules daily AI runs. `apps/worker/src/attention-rebuild-scheduler.ts` can rebuild attention/trading lab items that the advisor may consume.

#### Database/storage

AI tables in `packages/db/src/schema/ai.ts`:

- `aiRun`
- `aiManualOperation`
- `aiManualOperationStep`
- `aiPromptTemplate`
- `aiPortfolioSnapshot`
- `aiDailyBrief`
- `aiRecommendation`
- `aiRecommendationChallenge`
- `aiMacroSignal`
- `aiNewsSignal`
- `aiTransactionLabelSuggestion`
- `aiAssumptionLog`
- `aiChatThread`
- `aiChatMessage`
- `aiRunStep`
- `aiModelUsage`
- `aiCostLedger`
- `aiEvalCase`
- `aiEvalRun`

Investment advisor table: `advisorInvestmentContextBundle`.

#### External providers

OpenAI and Anthropic provider clients exist in `packages/ai/src/providers`. Env names include `AI_OPENAI_API_KEY`, `AI_OPENAI_BASE_URL`, model selector envs, `AI_ANTHROPIC_API_KEY`, `AI_ANTHROPIC_BASE_URL`, model selector envs, and AI budget/context settings.

#### Demo/admin behavior

Demo should use deterministic mock/fallback responses and no provider calls. Admin can call AI providers if enabled and within budget.

#### Error/fail-soft behavior

The Advisor must never block core finance UI. Provider/knowledge failures should produce safe fallback copy, cost/budget warnings, and persisted run status.

#### Tests

`packages/ai` tests cover schemas, pricing, knowledge context, and budget policy. Advisor route tests exist under `apps/api/src/routes/dashboard/routes/advisor.test.ts`.

#### Known limitations / TODOs

Large advisor domain/repository/UI files exist. The AI pipeline is complex and should be modularized only behind tests.

#### Technical improvement opportunities

Effect should become the standard for AI orchestration boundaries: provider client calls, retries/timeouts, typed model errors, cost budget checks, context bundle assembly, and redaction.

### Knowledge graph and GraphRAG memory

#### Product purpose

The knowledge layer provides internal AI Advisor memory, retrieval, provenance, temporal validity, contradiction history, confidence, and recency. It is not a source of truth for transactions and is not part of agentic development.

#### User-facing behavior

User-facing knowledge surfaces appear in `/ia/memoire` and Advisor knowledge routes. Users can inspect stats/schema/context/explain/query behavior where surfaced.

#### Data displayed

Knowledge stats, graph schema, query results, context bundles, paths, provenance, confidence, recency, temporal validity, contradictions, and unavailable fallback state.

#### Data captured

Knowledge query/explain/context bundle inputs. Rebuild trigger in admin/internal mode.

#### Data sources

AI, markets, news, social, cost ledger, trading lab, deterministic seed data, local graph store, optional Neo4j/Qdrant backends.

#### Backend/API implementation

API proxy routes under `/dashboard/advisor/knowledge`:

- `GET /advisor/knowledge/stats`
- `GET /advisor/knowledge/schema`
- `POST /advisor/knowledge/query`
- `POST /advisor/knowledge/context-bundle`
- `POST /advisor/knowledge/explain`
- `POST /advisor/knowledge/rebuild`

Python service routes:

- `GET /health`
- `GET /version`
- `POST /knowledge/ingest`
- `POST /knowledge/query`
- `POST /knowledge/context-bundle`
- `POST /knowledge/rebuild`
- `GET /knowledge/stats`
- `GET /knowledge/schema`
- `POST /knowledge/explain`
- `POST /knowledge/ingest/markets`
- `POST /knowledge/ingest/news`
- `POST /knowledge/ingest/advisor`
- `POST /knowledge/ingest/social`
- `POST /knowledge/ingest/cost-ledger`
- `POST /knowledge/ingest/trading-lab`

Source files: `apps/api/src/routes/dashboard/routes/advisor-knowledge.ts`, `apps/knowledge-service/src/finance_os_knowledge/*`.

#### Frontend implementation

`apps/web/src/routes/_app/ia/memoire.tsx` and Advisor UI.

#### Worker/background behavior

Knowledge ingestion may be triggered by API/admin flows or scheduled domain jobs; exact full scheduling is partially unclear from current code, but ingest endpoints and domain ingesters exist.

#### Database/storage

Knowledge service has local JSON/storage and optional Neo4j/Qdrant backends. It does not appear to use the main Drizzle schema as its primary graph store.

#### External providers

Neo4j, Qdrant, and optional OpenAI embeddings. Env names include `KNOWLEDGE_*`, `NEO4J_*`, `QDRANT_*`, and embedding provider/model names.

#### Demo/admin behavior

Demo should use deterministic fixtures/local fallback. Admin may use production backends when enabled. Admin can be configured to allow local fallback or require production backends.

#### Error/fail-soft behavior

API proxy builds unavailable fallbacks. Python service degrades when production backend is unavailable, preserving health/status metadata.

#### Tests

No Python tests ran in baseline because `pytest` was not installed. Source contains no obvious committed Python test directory from this audit output.

#### Known limitations / TODOs

No root Python workspace, lockfile, or guaranteed Python dev setup found. Retrieval/token budget behavior needs stronger contract tests.

#### Technical improvement opportunities

Add uv workspace or documented per-service uv environments, Ruff, pytest, and a service contract smoke. Add typed context bundle budgets and redaction tests.

### Trading Lab and quant service

#### Product purpose

Trading Lab is a research and paper-analysis surface for strategies, backtests, walk-forward analysis, scenarios, attention items, and signal feed exploration. It must not become trading execution.

#### User-facing behavior

Primary route: `/ia/trading-lab` in `apps/web/src/routes/_app/ia/trading-lab.tsx`. UI components under `apps/web/src/components/trading-lab` support strategy forms, backtest runner, scenarios, attention items, and signal feed.

#### Data displayed

Strategies, parameters, backtest runs, metrics, equity curves, drawdowns, walk-forward windows, scenario state, attention items, signal links, capabilities, market data preview, and quant-service availability.

#### Data captured

Strategy definitions, backtest parameters, scenario settings, attention item patch actions, run triggers, market data preview parameters, and from-signal scenario creation.

#### Data sources

Trading lab DB tables, market OHLCV data, quant-service calculations, signal items, deterministic demo data.

#### Backend/API implementation

Trading lab API routes under `/dashboard`:

- `GET /capabilities`
- `GET /strategies`
- `GET /strategies/:id`
- `POST /strategies`
- `PATCH /strategies/:id`
- `DELETE /strategies/:id`
- `GET /backtests`
- `GET /backtests/:id`
- `POST /backtests/run`
- `POST /backtests/walk-forward`
- `POST /market-data/preview`
- `GET /scenarios`
- `POST /scenarios`
- `PATCH /scenarios/:id`
- `GET /attention`
- `PATCH /attention/:id`
- `POST /attention/rebuild`
- `POST /scenarios/from-signal`
- `GET /signals/feed`

Quant service routes:

- `GET /health`
- `GET /version`
- `GET /quant/capabilities`
- `POST /quant/indicators`
- `POST /quant/backtest`
- `POST /quant/metrics`
- `POST /quant/walk-forward`
- `POST /quant/scenario/evaluate`

Source files: `apps/api/src/routes/dashboard/routes/trading-lab.ts`, `apps/api/src/routes/dashboard/services/trading-lab-market-data.ts`, `apps/quant-service/src/finance_os_quant/*`.

#### Frontend implementation

`apps/web/src/routes/_app/ia/trading-lab.tsx`, `apps/web/src/components/trading-lab/*`.

#### Worker/background behavior

`apps/worker/src/attention-rebuild-scheduler.ts` rebuilds attention items.

#### Database/storage

`tradingLabStrategy`, `tradingLabBacktestRun`, `tradingLabPaperScenario`, `tradingLabSignalLink`, `attentionItem`, plus market OHLCV/signal tables.

#### External providers

Quant service is internal. Market providers provide OHLCV/context. No trading provider/execution API should be used.

#### Demo/admin behavior

Demo uses deterministic research/paper data. Admin can persist research entities and call internal quant service when enabled.

#### Error/fail-soft behavior

Quant service failures should return safe unavailable state and preserve existing research data.

#### Tests

Phase 2 root orchestration runs quant Python tests through `pnpm python:test`. TS trading-lab route tests were not clearly identified in baseline output.

#### Known limitations / TODOs

`apps/api/src/routes/dashboard/routes/trading-lab.ts` is large. Quant service now has root uv/Ruff/pytest orchestration, but Ruff format checking is still a non-blocking baseline.

#### Technical improvement opportunities

Add route contract tests and decide whether to make Python format enforcement blocking after a focused format-only patch. Keep all trading lab operations explicitly paper/research only.

### Analytics, derived recompute, and finance engine

#### Product purpose

Analytics and derived recompute produce descriptive telemetry, projections, derived transaction snapshots, and deterministic calculations for the cockpit and AI Advisor.

#### User-facing behavior

Analytics appears in dashboard, expense, wealth, advisor, and health surfaces. Derived recompute status may be surfaced under health/admin panels.

#### Data displayed

Analytics summary, freshness, recompute runs, transaction snapshots, discrepancy counts, projections, month-end values, recurring commitments, savings/investment projections, and assumptions.

#### Data captured

Admin recompute trigger, range/search parameters, and assumptions where exposed.

#### Data sources

DB tables, finance-engine calculations, deterministic fixtures.

#### Backend/API implementation

Routes:

- `GET /dashboard/analytics`
- `GET /dashboard/derived-recompute`
- `POST /dashboard/derived-recompute`

Source files: `apps/api/src/routes/dashboard/routes/analytics.ts`, `apps/api/src/routes/dashboard/routes/derived-recompute.ts`, domain files under `apps/api/src/routes/dashboard/domain`, and `packages/finance-engine/src`.

#### Frontend implementation

Shared dashboard API hooks and route components.

#### Worker/background behavior

Worker sync flows can create state that derived recompute consumes. Dedicated recompute worker scheduling was not clearly found.

#### Database/storage

`derivedRecomputeRun`, `derivedTransactionSnapshot`, finance domain source tables.

#### External providers

None directly. Inputs come from persisted provider data.

#### Demo/admin behavior

Demo deterministic. Admin reads/writes recompute status.

#### Error/fail-soft behavior

Recompute failures should leave previous derived values usable and expose safe status.

#### Tests

`apps/api/src/routes/dashboard/routes/derived-recompute.test.ts` exists. `packages/finance-engine` tests passed baseline.

#### Known limitations / TODOs

Analytics source-of-truth docs should stay synchronized when metrics are introduced.

#### Technical improvement opportunities

Add source-of-truth graph docs per new analytics feature. Consider project references for finance-engine if typecheck grows.

### Notifications and PWA

#### Product purpose

Notifications and PWA support optional install/offline/notification UX while preserving opt-in and admin-gated push behavior.

#### User-facing behavior

PWA-related settings are likely surfaced in `/parametres` and health/settings components. Push UI is opt-in and should remain disabled in demo for real subscriptions/delivery.

#### Data displayed

Push settings, opt-in state, subscription state, preview-send state, service worker/install hints, offline status.

#### Data captured

Opt-in action, browser subscription payload, send-preview trigger.

#### Data sources

Browser service worker/subscription APIs, server notification settings, env flags.

#### Backend/API implementation

Routes under `/notifications/push`:

- `GET /settings`
- `POST /opt-in`
- `POST /subscription`
- `POST /send-preview`

Source: `apps/api/src/routes/notifications/routes/push.ts`.

#### Frontend implementation

PWA components and public runtime flags in `apps/web/src`. Exact component list was not exhaustively traced in this audit.

#### Worker/background behavior

No dedicated notification worker found in baseline inspection.

#### Database/storage

No dedicated notification table found in Drizzle schema list. Storage may be env/browser or not implemented.

#### External providers

Web Push/VAPID if enabled. Env names are present in docs/env.

#### Demo/admin behavior

Demo must keep deterministic mock states and avoid real subscriptions/delivery. Admin-only behavior is required by `apps/web/AGENTS.md`.

#### Error/fail-soft behavior

Push unavailable/denied states should not block app usage.

#### Tests

No explicit push tests identified.

#### Known limitations / TODOs

Persistence model and test coverage are unclear from current code.

#### Technical improvement opportunities

Add tests proving demo mode cannot create a real subscription or send preview.

### Enrichment notes and bulk triage

#### Product purpose

Enrichment allows attaching notes or triage metadata to domain items and supports bulk triage workflows.

#### User-facing behavior

The exact frontend surface is unclear from current code, but API routes exist.

#### Data displayed

Enrichment notes by item key, triage state, metadata, and timestamps.

#### Data captured

Note body/metadata and bulk triage payloads.

#### Data sources

`enrichmentNote` table or demo enrichment store.

#### Backend/API implementation

Routes under `/enrichment`:

- `GET /notes`
- `POST /notes`
- `POST /bulk-triage`

Source: `apps/api/src/routes/enrichment`.

#### Frontend implementation

Not clearly identified in current audit output.

#### Worker/background behavior

No worker behavior found.

#### Database/storage

`enrichmentNote` in `packages/db/src/schema/enrichment.ts`; demo store under `apps/api/src/routes/enrichment/mocks`.

#### External providers

None directly.

#### Demo/admin behavior

Demo store exists. Admin should persist to DB where route runtime allows.

#### Error/fail-soft behavior

Safe route errors expected.

#### Tests

Not clearly identified.

#### Known limitations / TODOs

Frontend ownership and product surface need clarification.

#### Technical improvement opportunities

Document owning domain and add route tests before expanding.

### Health, diagnostics, observability, and smoke checks

#### Product purpose

Health/diagnostics keeps the personal deployment operable, debuggable, and safe without leaking secrets.

#### User-facing behavior

Routes include `/sante`, `/health`, `/healthz`, `/version`, debug/admin diagnostics, provider status pages, and post-deploy smoke checks.

#### Data displayed

Service health, version/build metadata, DB health, auth mode, config safe summaries, metrics, provider diagnostics, sync status, worker heartbeat, and route topology.

#### Data captured

Admin debug/smoke actions where present.

#### Data sources

Runtime health builders, DB ping, Redis/worker heartbeat, provider tables, env safe summaries, Docker healthcheck endpoints.

#### Backend/API implementation

Routes:

- API `GET /health`
- API `GET /version`
- API `GET /db/health`
- API `GET /__routes`
- API `GET /api/__routes`
- API `GET /debug/routes`
- API `GET /api/debug/routes`
- Debug `GET /debug/health`
- Debug `GET /debug/auth`
- Debug `GET /debug/config`
- Debug `GET /debug/metrics`

Source: `apps/api/src/index.ts`, `apps/api/src/routes/system.ts`, `apps/api/src/routes/debug/router.ts`.

#### Frontend implementation

`apps/web/src/routes/health.tsx`, `apps/web/src/routes/healthz.tsx`, `apps/web/src/routes/version.tsx`, and `/sante` route.

#### Worker/background behavior

Worker exposes a status server, writes heartbeat file, records sync metrics in Redis, and is monitored by Docker health/ops alerts.

#### Database/storage

`technicalProbe` exists for simple DB checks. Provider/sync tables also store status.

#### External providers

None required for base health. Provider diagnostics may check external integrations in admin mode.

#### Demo/admin behavior

Debug/config outputs must stay secret-safe. Admin/internal gates apply to sensitive diagnostics.

#### Error/fail-soft behavior

Health checks should return useful degraded state without exposing secrets.

#### Tests

System tests exist. Docker ops alert tests exist at `infra/docker/ops-alerts/monitor.test.mjs` for alerting changes.

#### Known limitations / TODOs

Root `pnpm lint` fails while CI validate uses `pnpm -r --if-present lint`, which currently misses root Biome lint. This is a CI signal-quality issue.

#### Technical improvement opportunities

Align CI lint with root lint once existing Biome violations are fixed or scoped. Add CI summary output and artifact logs for failing smoke/build jobs.

### Desktop shell

#### Product purpose

Desktop shell packages Finance-OS as a Tauri app.

#### User-facing behavior

Desktop runs the web app in Tauri. Desktop-specific user surfaces were not deeply audited.

#### Data displayed

Same as web, via bundled static output.

#### Data captured

Same as web, plus platform shell interactions where Tauri permissions allow.

#### Data sources

Prepared web dist and Tauri runtime.

#### Backend/API implementation

Desktop does not own API routes.

#### Frontend implementation

`apps/desktop`, Tauri config and generated permissions.

#### Worker/background behavior

None found.

#### Database/storage

Not found in this audit.

#### External providers

Same as web/API if connected to the deployed/local backend.

#### Demo/admin behavior

Same as web.

#### Error/fail-soft behavior

Desktop build scope is detected by `scripts/desktop-scope.mjs` and CI conditionally runs Tauri build.

#### Tests

Desktop build is conditional in CI. No dedicated desktop E2E found.

#### Known limitations / TODOs

Generated/static desktop artifacts can be large and should remain ignored from normal source audit and Docker context.

#### Technical improvement opportunities

Keep desktop out of production server Docker contexts and add a lightweight desktop build smoke only when scope changes.

## 6. API inventory

Most API routes are mounted both without `/api` and under `/api` by `apps/api/src/index.ts` for compatibility/proxy topology. Dashboard routes are under `/dashboard`; integration routes are under `/integrations/*`; auth routes are under `/auth`; notifications are under `/notifications/push`; enrichment routes are under `/enrichment`.

### System and debug

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/health` | API health | public/safe | `apps/api/src/routes/system.ts` | system tests |
| GET | `/version` | version/build metadata | public/safe | `apps/api/src/routes/system.ts` | system tests |
| GET | `/db/health` | DB health probe | internal/debug safe | `apps/api/src/index.ts` | unclear |
| GET | `/__routes` | route topology | debug/internal | `apps/api/src/index.ts` | unclear |
| GET | `/api/__routes` | route topology with `/api` prefix | debug/internal | `apps/api/src/index.ts` | unclear |
| GET | `/debug/routes` | debug route list | debug/internal | `apps/api/src/index.ts` | unclear |
| GET | `/api/debug/routes` | debug route list with `/api` prefix | debug/internal | `apps/api/src/index.ts` | unclear |
| GET | `/debug/health` | debug health | admin/internal | `apps/api/src/routes/debug/router.ts` | unclear |
| GET | `/debug/auth` | auth debug summary | admin/internal, secret-safe | `apps/api/src/routes/debug/router.ts` | unclear |
| GET | `/debug/config` | safe config summary | admin/internal, secret-safe | `apps/api/src/routes/debug/router.ts` | unclear |
| GET | `/debug/metrics` | metrics/debug | admin/internal | `apps/api/src/routes/debug/router.ts` | unclear |

### Auth

| Method | Path | Purpose | Mode/auth | Request shape | Response shape | Source | Tests |
|---|---|---|---|---|---|---|---|
| POST | `/auth/login` | create admin session | public with rate-limit | login password/email fields | session/mode or safe error | `apps/api/src/auth/routes.ts` | auth route tests |
| POST | `/auth/logout` | clear session | session-aware | none | ok/mode | `apps/api/src/auth/routes.ts` | auth route tests |
| GET | `/auth/me` | return current mode/session | public safe | none | demo/admin mode, user/admin state | `apps/api/src/auth/routes.ts` | auth route tests |

### Dashboard core

| Method | Path | Purpose | Mode/auth | Request shape | Response shape | Source | Tests |
|---|---|---|---|---|---|---|---|
| GET | `/dashboard/summary` | cockpit summary | demo/admin split | range/mode params | summary DTO | `routes/summary.ts` | partial |
| GET | `/dashboard/analytics` | descriptive analytics | demo/admin split | range params | analytics DTO | `routes/analytics.ts` | partial |
| GET | `/dashboard/transactions` | paged transactions | demo/admin split | range, cursor, limit, mode | items/pagination | `routes/transactions.ts` | partial |
| GET | `/dashboard/transactions/migration-discrepancies` | migration discrepancies | admin/debug | query params | discrepancy list | `routes/transactions.ts` | unclear |
| PATCH | `/dashboard/transactions/:transactionId/classification` | update classification | admin | category/subcategory/incomeType/tags | updated row/status | `routes/transaction-classification.ts` | partial |
| GET | `/dashboard/manual-assets` | list manual assets | demo/admin | none/query | asset list | `routes/manual-assets.ts` | unclear |
| POST | `/dashboard/manual-assets` | create asset | admin | asset fields | asset row | `routes/manual-assets.ts` | unclear |
| PATCH | `/dashboard/manual-assets/:assetId` | update asset | admin | partial asset fields | asset row | `routes/manual-assets.ts` | unclear |
| DELETE | `/dashboard/manual-assets/:assetId` | delete/archive asset | admin | none | status | `routes/manual-assets.ts` | unclear |
| GET | `/dashboard/goals` | list goals | demo/admin | none/query | goal list | `routes/goals.ts` | unclear |
| POST | `/dashboard/goals` | create goal | admin | goal fields | goal row | `routes/goals.ts` | unclear |
| PATCH | `/dashboard/goals/:goalId` | update goal | admin | partial goal fields | goal row | `routes/goals.ts` | unclear |
| POST | `/dashboard/goals/:goalId/archive` | archive goal | admin | none | status/goal row | `routes/goals.ts` | unclear |
| GET | `/dashboard/derived-recompute` | recompute status | admin/internal | none/query | run/status | `routes/derived-recompute.ts` | existing |
| POST | `/dashboard/derived-recompute` | trigger recompute | admin/internal | trigger options | operation/run | `routes/derived-recompute.ts` | existing |

### Dashboard news, markets, signals

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/dashboard/news` | news feed | demo/admin | `routes/news.ts` | partial |
| GET | `/dashboard/news/context` | news context bundle | demo/admin | `routes/news.ts` | partial |
| POST | `/dashboard/news/ingest` | trigger news ingest | admin/internal | `routes/news.ts` | partial |
| GET | `/dashboard/markets/overview` | market overview | demo/admin | `routes/markets.ts` | partial |
| GET | `/dashboard/markets/watchlist` | watchlist | demo/admin | `routes/markets.ts` | partial |
| GET | `/dashboard/markets/macro` | macro observations | demo/admin | `routes/markets.ts` | partial |
| GET | `/dashboard/markets/context-bundle` | market context bundle | demo/admin | `routes/markets.ts` | partial |
| POST | `/dashboard/markets/refresh` | refresh market data | admin/internal | `routes/markets.ts` | partial |
| GET | `/dashboard/signals/sources` | list sources | admin/demo safe | `routes/signal-sources.ts` | partial |
| POST | `/dashboard/signals/sources` | create source | admin | `routes/signal-sources.ts` | partial |
| PATCH | `/dashboard/signals/sources/:id` | update source | admin | `routes/signal-sources.ts` | partial |
| DELETE | `/dashboard/signals/sources/:id` | delete source | admin | `routes/signal-sources.ts` | partial |
| GET | `/dashboard/signals/runs` | ingestion runs | admin/demo safe | `routes/signal-sources.ts` | partial |
| POST | `/dashboard/signals/ingest/manual` | manual ingest | admin | `routes/signal-sources.ts` | partial |
| GET | `/dashboard/signals/items` | signal item feed | demo/admin | `routes/signal-sources.ts` | partial |
| GET | `/dashboard/signals/health` | signal health | demo/admin | `routes/signal-sources.ts` | partial |

### Dashboard external investments

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/dashboard/external-investments/summary` | investment summary | demo/admin | `routes/external-investments.ts` | package tests |
| GET | `/dashboard/external-investments/accounts` | accounts | demo/admin | `routes/external-investments.ts` | package tests |
| GET | `/dashboard/external-investments/positions` | positions | demo/admin | `routes/external-investments.ts` | package tests |
| GET | `/dashboard/external-investments/trades` | trades | demo/admin | `routes/external-investments.ts` | package tests |
| GET | `/dashboard/external-investments/cash-flows` | cash flows | demo/admin | `routes/external-investments.ts` | package tests |
| GET | `/dashboard/external-investments/context-bundle` | advisor bundle | demo/admin | `routes/external-investments.ts` | package tests |

### Dashboard AI Advisor and knowledge

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/dashboard/advisor` | advisor overview | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/daily-brief` | daily brief | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/recommendations` | recommendations | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/runs` | run history | admin/demo safe | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/assumptions` | assumptions | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/signals` | advisor signals | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/spend` | AI spend | admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/knowledge-topics` | knowledge topics | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/knowledge-answer` | knowledge answer | demo/admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/manual-refresh-and-run` | operation state | admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/manual-refresh-and-run/:operationId` | operation by ID | admin | `routes/advisor.ts` | advisor tests |
| POST | `/dashboard/advisor/manual-refresh-and-run` | start manual operation | admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/chat` | chat thread/list | demo/admin | `routes/advisor.ts` | advisor tests |
| POST | `/dashboard/advisor/chat` | grounded chat | demo/admin, provider gated | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/evals` | evals | admin | `routes/advisor.ts` | advisor tests |
| POST | `/dashboard/advisor/run-daily` | trigger daily run | admin | `routes/advisor.ts` | advisor tests |
| POST | `/dashboard/advisor/relabel-transactions` | trigger relabel | admin | `routes/advisor.ts` | advisor tests |
| GET | `/dashboard/advisor/knowledge/stats` | knowledge stats | demo/admin | `routes/advisor-knowledge.ts` | unclear |
| GET | `/dashboard/advisor/knowledge/schema` | graph schema | demo/admin | `routes/advisor-knowledge.ts` | unclear |
| POST | `/dashboard/advisor/knowledge/query` | graph query | demo/admin | `routes/advisor-knowledge.ts` | unclear |
| POST | `/dashboard/advisor/knowledge/context-bundle` | graph context bundle | demo/admin | `routes/advisor-knowledge.ts` | unclear |
| POST | `/dashboard/advisor/knowledge/explain` | graph explanation | demo/admin | `routes/advisor-knowledge.ts` | unclear |
| POST | `/dashboard/advisor/knowledge/rebuild` | rebuild graph | admin/internal | `routes/advisor-knowledge.ts` | unclear |

### Dashboard Trading Lab

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/dashboard/capabilities` | trading/quant capabilities | demo/admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/strategies` | list strategies | demo/admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/strategies/:id` | get strategy | demo/admin | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/strategies` | create strategy | admin | `routes/trading-lab.ts` | unclear |
| PATCH | `/dashboard/strategies/:id` | update strategy | admin | `routes/trading-lab.ts` | unclear |
| DELETE | `/dashboard/strategies/:id` | delete strategy | admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/backtests` | list backtests | demo/admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/backtests/:id` | get backtest | demo/admin | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/backtests/run` | run backtest | admin/internal | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/backtests/walk-forward` | run walk-forward | admin/internal | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/market-data/preview` | preview market data | admin/internal | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/scenarios` | list paper scenarios | demo/admin | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/scenarios` | create paper scenario | admin | `routes/trading-lab.ts` | unclear |
| PATCH | `/dashboard/scenarios/:id` | update paper scenario | admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/attention` | attention items | demo/admin | `routes/trading-lab.ts` | unclear |
| PATCH | `/dashboard/attention/:id` | update attention item | admin | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/attention/rebuild` | rebuild attention | admin/internal | `routes/trading-lab.ts` | unclear |
| POST | `/dashboard/scenarios/from-signal` | create scenario from signal | admin | `routes/trading-lab.ts` | unclear |
| GET | `/dashboard/signals/feed` | trading signal feed | demo/admin | `routes/trading-lab.ts` | unclear |

### Integrations

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/integrations/powens/connect-url` | build Powens webview URL | admin/signed state | `powens/routes/connect-url.ts` | partial |
| POST | `/integrations/powens/callback` | Powens callback | signed state | `powens/routes/callback.ts` | partial |
| GET | `/integrations/powens/status` | Powens status | demo/admin safe | `powens/routes/status.ts` | partial |
| POST | `/integrations/powens/sync` | enqueue Powens sync | admin/internal | `powens/routes/sync.ts` | partial |
| GET | `/integrations/powens/sync-runs` | sync run history | admin/demo safe | `powens/routes/sync-runs.ts` | partial |
| GET | `/integrations/powens/diagnostics` | diagnostics | admin | `powens/routes/diagnostics.ts` | partial |
| DELETE | `/integrations/powens/connections/:connectionId` | archive/delete connection | admin | `powens/routes/connections.ts` | unclear |
| GET | `/integrations/powens/backlog` | backlog | admin | `powens/routes/backlog.ts` | unclear |
| GET | `/integrations/powens/audit-trail` | audit trail | admin | `powens/routes/audit-trail.ts` | unclear |
| GET | `/integrations/external-investments/status` | external investment status | demo/admin safe | `external-investments/routes/status.ts` | package tests |
| GET | `/integrations/external-investments/diagnostics` | diagnostics | admin | `external-investments/routes/diagnostics.ts` | package tests |
| GET | `/integrations/external-investments/sync-runs` | sync runs | admin/demo safe | `external-investments/routes/sync-runs.ts` | package tests |
| POST | `/integrations/external-investments/sync` | sync all providers | admin/internal | `external-investments/routes/sync.ts` | package tests |
| POST | `/integrations/external-investments/:provider/sync` | sync provider | admin/internal | `external-investments/routes/sync.ts` | package tests |
| PUT | `/integrations/external-investments/:provider/credential` | upsert encrypted credential | admin | `external-investments/routes/credentials.ts` | package tests |
| DELETE | `/integrations/external-investments/:provider/credential` | delete credential | admin | `external-investments/routes/credentials.ts` | package tests |
| POST | `/integrations/external-investments/:provider/credential/test` | test credential | admin | `external-investments/routes/credentials.ts` | package tests |

### Notifications and enrichment

| Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|
| GET | `/notifications/push/settings` | push settings | demo/admin safe | `notifications/routes/push.ts` | unclear |
| POST | `/notifications/push/opt-in` | opt in | admin/feature gated | `notifications/routes/push.ts` | unclear |
| POST | `/notifications/push/subscription` | save subscription | admin/feature gated | `notifications/routes/push.ts` | unclear |
| POST | `/notifications/push/send-preview` | send preview | admin/feature gated | `notifications/routes/push.ts` | unclear |
| GET | `/enrichment/notes` | fetch enrichment notes | demo/admin | `enrichment/routes/notes.ts` | unclear |
| POST | `/enrichment/notes` | write enrichment note | admin/demo store | `enrichment/routes/notes.ts` | unclear |
| POST | `/enrichment/bulk-triage` | bulk triage | admin/demo store | `enrichment/routes/bulk-triage.ts` | unclear |

### Python service APIs

| Service | Method | Path | Purpose | Mode/auth | Source | Tests |
|---|---|---|---|---|---|---|
| knowledge | GET | `/health` | health | internal | `apps/knowledge-service/.../app.py` | `pnpm python:test` |
| knowledge | GET | `/version` | version | internal | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/ingest` | generic ingest | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/query` | retrieve | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/context-bundle` | build bundle | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/rebuild` | rebuild | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | GET | `/knowledge/stats` | stats | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | GET | `/knowledge/schema` | schema | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/explain` | explanation | internal/admin | `app.py` | `pnpm python:test` |
| knowledge | POST | `/knowledge/ingest/*` | domain ingesters | internal/admin | `app.py` | `pnpm python:test` |
| quant | GET | `/health` | health | internal | `apps/quant-service/.../app.py` | `pnpm python:test` |
| quant | GET | `/version` | version | internal | `app.py` | `pnpm python:test` |
| quant | GET | `/quant/capabilities` | capabilities | internal | `app.py` | `pnpm python:test` |
| quant | POST | `/quant/indicators` | indicators | internal/admin | `app.py` | `pnpm python:test` |
| quant | POST | `/quant/backtest` | backtest | internal/admin | `app.py` | `pnpm python:test` |
| quant | POST | `/quant/metrics` | metrics | internal/admin | `app.py` | `pnpm python:test` |
| quant | POST | `/quant/walk-forward` | walk-forward | internal/admin | `app.py` | `pnpm python:test` |
| quant | POST | `/quant/scenario/evaluate` | scenario evaluate | internal/admin | `app.py` | `pnpm python:test` |

## 7. Database inventory

Schema source is `packages/db/src/schema`. Migrations are under `packages/db/drizzle`. Exact columns should be confirmed in the schema files before migrations or contract changes. Key discovered tables:

| Table/export | Purpose | Important columns or groups | Relationships/read-write paths | Owning feature | Migrations |
|---|---|---|---|---|---|
| `powensConnection` | Powens connection state | provider IDs, encrypted token, status, sync timestamps, reason metadata | worker sync, Powens routes, dashboard status | Powens | Drizzle migrations |
| `financialAccount` | Bank/account records | provider, account IDs, balances, currency, archived state | Powens worker, dashboard summary/assets | Banking/cockpit | Drizzle migrations |
| `transaction` | Imported transactions | provider IDs, dates, amount, currency, direction, label/hash, category, tags | transactions UI, finance engine, recurring commitments | Spending | Drizzle migrations |
| `providerRawImport` | Provider audit/replay payloads | provider, connection, object type, external IDs, payload/timestamps | worker raw import, diagnostics | Powens | Drizzle migrations |
| `asset` | Manual/provider assets | name/type/value/currency/provider linkage | wealth UI, dashboard summary, worker Powens asset upsert | Wealth | Drizzle migrations |
| `investmentPosition` | Older/internal position model | instrument/value/allocation style fields | wealth/dashboard reads | Wealth | Drizzle migrations |
| `personalGoal` | User goals | title, target/current values, status, dates, archived state | goals routes/UI/advisor | Goals | Drizzle migrations |
| `recurringCommitment` | Detected recurring obligations | merchant/category/amount/cadence/confidence | analytics/dashboard | Spending | Drizzle migrations |
| `recurringCommitmentTransactionLink` | Link commitments to transactions | commitment ID, transaction ID | recurrence detection | Spending | Drizzle migrations |
| `derivedRecomputeRun` | Recompute operation state | status, timestamps, metadata/error | recompute route | Analytics | Drizzle migrations |
| `derivedTransactionSnapshot` | Snapshot of derived transaction calculations | transaction/date/category/derived values | analytics/dashboard | Analytics | Drizzle migrations |
| `newsArticle` | Normalized news | title, URL, source, published date, summary, topics, scores | news routes/UI/advisor | News | Drizzle migrations |
| `newsArticleSourceRef` | Provider source refs | provider ID, article ID, raw IDs | dedupe/provenance | News | Drizzle migrations |
| `newsCacheState` | News cache state | key, timestamps, status | news routes/worker | News | Drizzle migrations |
| `newsProviderState` | News provider health | provider, status, last run/error | news ingestion | News | Drizzle migrations |
| `marketQuoteSnapshot` | Quotes | ticker, price, change, currency, timestamp, provider | markets UI/advisor | Markets | Drizzle migrations |
| `marketMacroObservation` | Macro series | series ID, value, unit, timestamp, provider | macro UI/advisor | Markets | Drizzle migrations |
| `marketCacheState` | Market cache state | key/status/timestamps | market refresh | Markets | Drizzle migrations |
| `marketProviderState` | Market provider health | provider/status/error/timestamps | market refresh | Markets | Drizzle migrations |
| `marketContextBundleSnapshot` | Market bundle snapshots | bundle payload, timestamps, provenance | advisor/markets | Markets/AI | Drizzle migrations |
| `marketOhlcvBar` | OHLCV bars | symbol, date/time, open/high/low/close/volume | trading lab/quant | Trading Lab | Drizzle migrations |
| `signalSource` | Signal source config | provider/type/query/enabled/metadata | signal source admin | Signals | Drizzle migrations |
| `signalIngestionRun` | Ingest run state | source/provider/status/counts/error | signals UI/worker | Signals | Drizzle migrations |
| `signalItem` | Signal feed items | source, title/content, URL, payload, scores | signals/trading lab/advisor | Signals | Drizzle migrations |
| `tradingLabStrategy` | Strategy definition | name/type/parameters/data source/status | trading lab UI/API | Trading Lab | Drizzle migrations |
| `tradingLabBacktestRun` | Backtest results | strategy ID, params, metrics, curves, status | trading lab/quant | Trading Lab | Drizzle migrations |
| `tradingLabPaperScenario` | Paper scenario | strategy/symbol/config/status/performance | trading lab | Trading Lab | Drizzle migrations |
| `tradingLabSignalLink` | Signal to strategy/scenario links | signal ID, entity linkage | trading lab | Trading Lab | Drizzle migrations |
| `attentionItem` | Attention queue | priority/state/source/next action | trading lab/advisor | Trading Lab | Drizzle migrations |
| `externalInvestmentConnection` | Provider connection | provider, status, timestamps | external investment routes/worker | External investments | Drizzle migrations |
| `externalInvestmentCredential` | Encrypted credentials | provider, encrypted payload, metadata, test status | credential routes/sync | External investments | Drizzle migrations |
| `externalInvestmentSyncRun` | Sync run state | provider, status, counts, error, timestamps | sync routes/worker | External investments | Drizzle migrations |
| `externalInvestmentProviderHealth` | Provider health | provider, status, freshness, error | diagnostics/status | External investments | Drizzle migrations |
| `externalInvestmentRawImport` | Raw investment payloads | provider, object type, IDs, payload | audit/replay | External investments | Drizzle migrations |
| `externalInvestmentAccount` | Investment accounts | provider, account ID, name/type/currency | investments UI/advisor | External investments | Drizzle migrations |
| `externalInvestmentInstrument` | Instruments | symbol, name, ISIN/FIGI/type/currency | positions/trades | External investments | Drizzle migrations |
| `externalInvestmentPosition` | Positions | account, instrument, quantity, cost, market value, P/L | investments UI/advisor | External investments | Drizzle migrations |
| `externalInvestmentTrade` | Trades | account, instrument, side, quantity, price, fees, timestamp | trades UI | External investments | Drizzle migrations |
| `externalInvestmentCashFlow` | Cash movements | account, amount, currency, type, timestamp | cash-flow UI | External investments | Drizzle migrations |
| `externalInvestmentValuationSnapshot` | Valuation snapshots | account/position value, timestamp | investments/advisor | External investments | Drizzle migrations |
| `advisorInvestmentContextBundle` | Investment context bundle | payload, warnings, freshness | Advisor | External investments/AI | Drizzle migrations |
| `aiRun` | AI run lifecycle | type/status/provider/model/timestamps | advisor route/worker | AI Advisor | Drizzle migrations |
| `aiManualOperation` | Manual operation state | operation type/status/progress | manual refresh UI | AI Advisor | Drizzle migrations |
| `aiManualOperationStep` | Manual operation steps | step/status/timestamps/error | operation detail | AI Advisor | Drizzle migrations |
| `aiPromptTemplate` | Prompt versions | key/version/template/metadata | AI orchestration | AI Advisor | Drizzle migrations |
| `aiPortfolioSnapshot` | Advisor portfolio snapshot | snapshot payload/timestamp | advisor daily | AI Advisor | Drizzle migrations |
| `aiDailyBrief` | Daily brief | brief content/run ID | advisor UI | AI Advisor | Drizzle migrations |
| `aiRecommendation` | Recommendations | title/body/priority/status/evidence | advisor UI | AI Advisor | Drizzle migrations |
| `aiRecommendationChallenge` | Challenger critiques | critique/reasoning/confidence | advisor UI | AI Advisor | Drizzle migrations |
| `aiMacroSignal` | Macro signals | signal content/scores | advisor UI | AI Advisor | Drizzle migrations |
| `aiNewsSignal` | News signals | signal content/source refs | advisor UI | AI Advisor | Drizzle migrations |
| `aiTransactionLabelSuggestion` | Label suggestions | transaction ref/suggested labels/confidence | relabeling | AI Advisor | Drizzle migrations |
| `aiAssumptionLog` | Assumptions | assumption text/source/version | advisor transparency | AI Advisor | Drizzle migrations |
| `aiChatThread` | Chat thread | thread metadata | chat UI | AI Advisor | Drizzle migrations |
| `aiChatMessage` | Chat messages | role/content/context refs/tokens | chat UI | AI Advisor | Drizzle migrations |
| `aiRunStep` | AI run steps | step/status/timing/error | observability | AI Advisor | Drizzle migrations |
| `aiModelUsage` | Model usage | tokens/model/provider/cost refs | cost UI | AI Advisor | Drizzle migrations |
| `aiCostLedger` | Cost ledger | usage/cost/budget metadata | AI costs | AI Advisor | Drizzle migrations |
| `aiEvalCase` | Eval cases | prompt/expected/metadata | AI evals | AI Advisor | Drizzle migrations |
| `aiEvalRun` | Eval runs | case/run results/status | AI evals | AI Advisor | Drizzle migrations |
| `enrichmentNote` | Notes/triage | item key/body/metadata/timestamps | enrichment routes | Enrichment | Drizzle migrations |
| `technicalProbe` | Basic probe table | small probe fields | DB health/probe | Observability | Drizzle migrations |

## 8. External integrations inventory

### Powens

- Purpose: bank account connection, account/transaction import, sync status.
- Credentials/env names: `POWENS_CLIENT_ID`, `POWENS_CLIENT_SECRET`, `POWENS_BASE_URL`, `POWENS_DOMAIN`, redirect/webview env names, `APP_ENCRYPTION_KEY`.
- APIs used: webview connect/callback and account/transaction list flows through `packages/powens/src/client.ts`.
- Sync flow: admin connect URL -> callback stores encrypted token -> worker sync imports accounts/transactions/raw payloads -> dashboard reads DB.
- Data retrieved: accounts, balances, transactions, provider metadata.
- Storage: `powensConnection`, `financialAccount`, `transaction`, `providerRawImport`, `asset`.
- Fail-soft: status/diagnostic records, cooldowns, disabled provider lists, safe logs.
- Tests: Powens package and worker sync tests.
- Limitations: worker orchestration file is large.

### IBKR Flex

- Purpose: read-only brokerage reporting ingestion.
- Credentials/env names: `IBKR_FLEX_ENABLED`, `IBKR_FLEX_BASE_URL`, `IBKR_FLEX_USER_AGENT`, `IBKR_FLEX_TIMEOUT_MS`, provider credential payload fields.
- APIs used: IBKR Flex report endpoints through `packages/external-investments/src/ibkr-flex-client.ts`.
- Sync flow: encrypted credential -> sync job -> normalize -> external investment tables -> dashboard/advisor bundle.
- Data retrieved: accounts, instruments, positions, trades, cash flows, valuations depending on report content.
- Storage: external investment tables.
- Fail-soft: provider health/sync run state and warnings.
- Tests: external-investments package tests.
- Limitations: no API route integration tests clearly found.

### Binance Spot/Wallet

- Purpose: read-only crypto account analytics.
- Credentials/env names: `BINANCE_SPOT_ENABLED`, `BINANCE_SPOT_BASE_URL`, `BINANCE_SPOT_RECV_WINDOW_MS`, `BINANCE_SPOT_TIMEOUT_MS`, encrypted credential fields.
- APIs used: signed read-only Spot/Wallet `GET` allowlist through `packages/external-investments/src/binance-readonly-client.ts`.
- Sync flow: encrypted credential -> signed read-only requests -> normalize -> tables -> dashboard/advisor.
- Data retrieved: balances/account/asset data and related read-only wallet/spot information.
- Storage: external investment tables.
- Fail-soft: provider health/sync run state and warnings.
- Tests: external-investments package tests.
- Limitations: keep no-trading boundary explicit.

### Market data providers

- Providers found: EODHD, Twelve Data, FRED.
- Purpose: quotes, watchlist, macro data, OHLCV for trading lab.
- Env names: `MARKET_DATA_EODHD_ENABLED`, `MARKET_DATA_TWELVEDATA_ENABLED`, `MARKET_DATA_FRED_ENABLED`, `EODHD_API_KEY`, `TWELVEDATA_API_KEY`, `FRED_API_KEY`, series/watchlist settings.
- Storage: market tables.
- Fail-soft: cache/provider state and stale warnings.
- Tests: scheduler tests; more provider adapter tests recommended.

### News providers

- Providers found: HN Algolia, GDELT, ECB RSS/data, SEC, FRED.
- Purpose: news feed, context bundles, signals.
- Env names: `NEWS_PROVIDER_*`, `SEC_USER_AGENT`, `FRED_API_KEY`, metadata fetch limits.
- Storage: news and signal tables.
- Fail-soft: provider/cache state and bounded metadata fetch.
- Tests: partial scheduler/route tests.

### Social providers

- Providers found: X/Twitter recent search and Bluesky/manual social imports in code/docs.
- Purpose: social signal ingestion and source health.
- Env names: social provider env names are present in docs/env but exact full list should be checked before configuration changes.
- Storage: signal source/run/item tables.
- Fail-soft: source health and run status.
- Tests: scheduler tests.

### AI providers

- Providers found: OpenAI and Anthropic in `packages/ai/src/providers`.
- Purpose: classifier/daily/deep/challenger models, grounded chat, recommendations, labels, evals.
- Env names: `AI_OPENAI_API_KEY`, `AI_OPENAI_BASE_URL`, `AI_OPENAI_*_MODEL`, `AI_ANTHROPIC_API_KEY`, `AI_ANTHROPIC_BASE_URL`, `AI_ANTHROPIC_*_MODEL`, budget/context envs.
- Storage: AI run/model usage/cost tables.
- Fail-soft: budget policy, route fallback, normalized errors.
- Tests: package tests and advisor route tests.

### Knowledge backends

- Providers/backends found: local graph store, Neo4j, Qdrant, optional OpenAI/local embeddings.
- Purpose: graph memory and retrieval for AI Advisor.
- Env names: `KNOWLEDGE_*`, `NEO4J_*`, `QDRANT_*`, embedding provider/model/dimensions.
- Storage: local graph files or Neo4j/Qdrant.
- Fail-soft: degraded service and local fallback depending on env.
- Tests: runnable through `pnpm python:test`; production backend integration still needs optional service-backed coverage.

### Infrastructure integrations

- Redis: queues, auth rate limits, sync metrics, status.
- Postgres: Drizzle data store.
- GHCR: release images.
- Dokploy: deployment sync/trigger.
- Docker ops alerts: production health/5xx/heartbeat/disk monitoring.

## 9. AI Advisor and knowledge inventory

### AI Advisor purpose

The Advisor enriches deterministic personal finance calculations with explanations, recommendations, grounded chat, challengers, summaries, and labels. It must not replace source-of-truth financial tables and must not initiate trading/execution.

### Data it receives

Discovered inputs:

- Portfolio/cockpit snapshots from finance-engine/dashboard repositories.
- Transactions, recurring commitments, goals, assets, accounts.
- External investment context bundle, including warnings for stale/missing cost/market data.
- Market context bundle and macro observations.
- News/signals context.
- Knowledge graph context.
- Chat history within configured limits.
- Prompt templates and assumptions.

### Context bundle structure

TypeScript context bundle utilities exist in `packages/ai/src/knowledge-context.ts` and advisor domain files. External investment context bundle persistence exists in `advisorInvestmentContextBundle`. Market and news context snapshots exist in DB tables. Knowledge service context bundles include graph paths, provenance, confidence, recency, and temporal metadata.

### Personal finance data sent

Potentially sent in admin mode: financial summaries, portfolio snapshots, transactions/labels in bounded form, goals, recurring commitments, and investment summaries. Sensitive raw credentials/tokens must never be sent.

### Market/news/tweet data sent

Market quotes, macro observations, news summaries, signal items, provider/source metadata, and social signals can be sent as context when enabled.

### Investment data sent

External investment context can include positions, accounts, valuations, trades/cash summaries, warnings, and freshness metadata. It must remain analytics-only.

### Graph/context model

The Python knowledge service models entities, relations, observations, provenance, confidence, temporal validity, contradiction history, and hybrid retrieval. It has domain ingesters for markets, news, advisor, social, cost ledger, and trading lab.

### Prompts

Prompt files exist in `packages/ai/src/prompts`, with schemas under `packages/ai/src/schemas`. Prompt template persistence also exists in `aiPromptTemplate`.

### Token/context budget

AI budget policy exists in `packages/ai/src/orchestration/budget-policy.ts`. Model pricing registry exists in `packages/ai/src/pricing/registry.ts`. Knowledge graph max context tokens are configurable.

### Privacy protections

Protections found:

- Server-only provider env vars.
- Public runtime env allowlist.
- Safe logging conventions in AGENTS and runtime code.
- Knowledge/AI feature flags.
- Demo deterministic path.
- Budget/cost ledger.

Gaps:

- No single redaction test matrix across AI context bundle assembly was found.
- Python Ruff format checking is now available but intentionally non-blocking because it reports broad pre-existing formatting drift.

### Demo/admin separation

Demo should use deterministic AI/advisor/knowledge fixtures or safe fallbacks. Admin may call AI and knowledge services when enabled.

### Limitations

- No Effect dependency or standard Effect pattern currently found.
- Large advisor orchestration files increase review risk.
- Knowledge/AI context privacy and budget tests should be strengthened.

### Recommended next steps

1. Define a shared typed `AdvisorContextBundle` contract with redaction metadata and token estimates.
2. Add tests proving demo mode does not call providers.
3. Add Effect-based provider orchestration for AI calls only after the first adapter pattern is reviewed.
4. Decide whether Python services should stay as per-service uv projects or move to a root uv workspace after shared Python packages exist.
5. Add AI context budget diagnostics visible in admin mode.

## 10. Build, CI, deployment inventory

### Package manager and scripts

The monorepo uses pnpm 10.x with Bun for API/worker/package tests and Vite/TanStack Start for web builds. Root commands:

- `pnpm install --frozen-lockfile`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm -r --if-present test`
- `pnpm -r --if-present build`
- `pnpm check:ci`
- `pnpm docker:check`
- `pnpm python:lint`
- `pnpm python:test`
- `pnpm python:check`
- `pnpm python:format:check`
- `pnpm test:e2e`

Package scripts are uneven:

- API/worker have typecheck/start/dev but no local lint/test script.
- Web has build/typecheck/test.
- AI, finance-engine, external-investments have Bun tests.
- DB/env/prelude/redis/ui have typecheck.
- Python services are root-orchestrated through pnpm scripts that delegate to per-service uv environments.

### CI workflows

`.github/workflows/ci.yml`:

- checkout
- pnpm setup/cache
- Node 22
- Bun setup
- Python 3.12 and uv setup
- `pnpm install --frozen-lockfile`
- explicit non-blocking root `pnpm lint` known-failing baseline
- `pnpm docker:check`
- `pnpm -r --if-present lint`
- `pnpm -r --if-present typecheck`
- `pnpm -r --if-present test`
- `pnpm python:check`
- `pnpm -r --if-present build`
- separate Playwright demo E2E smoke job with Chromium install
- conditional Tauri validate
- concurrency with cancel-in-progress

Important finding: `pnpm check:ci` passed, but `pnpm lint` failed because CI/workspace lint currently runs package lint scripts only and misses root Biome lint. This is a signal-quality gap, not a new failure from this audit patch.

### Dockerfiles

`infra/docker/Dockerfile`:

- Uses Dockerfile syntax `1.7`.
- Has `pnpm-base`, `manifests`, `deps`, `build-web`, `deps-api`, `bundle-api`, `api`, `deps-worker`, `bundle-worker`, `worker`, and `web` stages.
- Builds web with Vite/TanStack Start.
- Runs API/worker on Bun Alpine.
- Uses Node Alpine for web Nitro output.
- Adds non-root users.
- Keeps entrypoints in `infra/docker/entrypoints`.

Audit patch corrected Docker workspace drift by adding `packages/external-investments` package manifest and runtime copies to API/worker stages. `.dockerignore` was also updated to exclude desktop generated/static/target artifacts and Python caches.

Python services have separate Dockerfiles under each app.

### Images

Release builds GHCR images for:

- web
- api
- worker
- knowledge-service

The quant-service image is present in source but not clearly built in release workflow.

### Deployment flow

Release workflow builds images, syncs Dokploy compose/env, triggers deployment, waits for public health, and runs `scripts/smoke-prod.mjs`.

### Checks

Baseline:

- install passed
- root lint failed pre-change
- typecheck passed
- workspace tests passed
- workspace build passed
- check:ci passed despite root lint mismatch
- Python `pytest` missing in the pre-Phase-2 global environment; Phase 2 adds uv-managed Python checks.
- Docker daemon unavailable locally

### Current weaknesses

- Root lint is explicit but still non-blocking in CI until existing Biome violations are fixed.
- Playwright E2E smoke exists, but it is intentionally a deterministic demo smoke rather than an admin/provider test.
- Python format checking is available but non-blocking due pre-existing formatting drift.
- Docker build could not be locally validated because Docker daemon was unavailable.
- Docker manifest stage is hand-maintained and can drift as workspace packages change.
- Web build reports large chunks for main/three/react-related assets.
- No affected-task graph beyond desktop scope detection.

### Optimization opportunities

- Add root lint to CI after fixing existing lint errors, or make root lint a separate required check with known baseline.
- Add a minimal Playwright smoke in CI.
- Add Python uv/Ruff/pytest checks.
- Consider `pnpm fetch` or `pnpm deploy` in Docker after testing compatibility with workspace links and Bun runtime.
- Consider an affected task graph script before adopting Nx/Turbo/Moon. The repo likes Nx mentality but does not require Nx.
- Add bundle analysis and route-level chunking for heavy three/reactbits/trading lab routes.

### Research sources consulted for audit recommendations

Official/current docs consulted during this audit:

- Docker multi-stage builds: https://docs.docker.com/build/building/multi-stage/
- Docker build cache optimization: https://docs.docker.com/build/cache/optimize/
- pnpm Docker guidance: https://pnpm.io/docker
- pnpm deploy: https://pnpm.io/cli/deploy
- Bun Docker guide: https://bun.sh/guides/ecosystem/docker
- TypeScript project references: https://www.typescriptlang.org/docs/handbook/project-references.html
- Effect Layers/Config/Schema/Retrying: https://effect.website/docs/
- uv workspaces: https://docs.astral.sh/uv/concepts/projects/workspaces/
- Ruff configuration: https://docs.astral.sh/ruff/configuration/
- Playwright CI: https://playwright.dev/docs/ci
- GitHub Actions concurrency/caching: https://docs.github.com/en/actions
- TanStack Start hosting: https://tanstack.com/start/latest/docs/framework/react/guide/hosting
- Vite 8 / Rolldown current status: https://vite.dev/blog/announcing-vite8

## 11. Testing inventory

### Test tools

- Bun test for several TS packages and API/worker tests.
- Vitest/jsdom/testing-library for web tests.
- Node test for Docker ops alerts.
- Python pytest via per-service uv environments and root pnpm scripts.
- Playwright demo E2E smoke via `playwright.config.ts`.

### Unit tests

Found and passing in baseline:

- `packages/ai` tests
- `packages/finance-engine` tests
- `packages/external-investments` tests
- Powens package tests
- Worker helper/scheduler tests
- Web Vitest tests

### Integration/route tests

Found:

- Auth route/guard/origin tests.
- System route tests.
- Advisor route tests.
- Derived recompute route tests.
- Some dashboard/domain tests.

Gaps:

- Manual asset/goal route write tests unclear.
- External investment API route tests unclear.
- Trading lab route tests unclear.
- Notification route tests unclear.
- Enrichment route tests unclear.

### E2E tests

Phase 2 added a minimal Playwright smoke:

- deterministic demo API stub for `/api/auth/me` and the cockpit attention read
- web app boots in demo mode
- `GET /api/auth/me` returns safe demo mode with `Cache-Control: no-store`
- cockpit `/` renders without fatal SSR crash
- no live providers or admin credentials required
- optional admin login smoke remains deferred until safe fixtures/secrets are defined

### Python tests

Phase 2 added root-managed Python checks through uv: `pnpm python:lint`, `pnpm python:test`, and `pnpm python:check`. `pnpm python:format:check` exists but is non-blocking because it currently reports broad pre-existing Ruff formatting drift.

### Security-sensitive tests

Existing tests cover auth cookies/rate-limit behavior and some route cache-control. More tests are needed for:

- no secrets in public runtime env
- no provider calls in demo
- encrypted external investment credential persistence
- AI context redaction
- push subscription disabled in demo

### Recommended minimum test matrix

- Root Biome lint.
- Full TypeScript typecheck.
- Package tests.
- Web Vitest.
- API route auth/mode tests.
- Worker scheduler/job tests.
- Python Ruff/pytest.
- Playwright demo smoke.
- Docker target build smoke in CI with BuildKit cache.
- Production smoke after deploy.

## 12. Current technical debt

### Critical

- None confirmed during this audit. No active secret leak or data loss path was identified from inspected source. Continue treating demo/admin split, token logging, and read-only investment boundaries as P0 review areas.

### High

- Root `pnpm lint` fails pre-change while `pnpm check:ci` passes because CI uses workspace package lint scripts and misses root Biome lint.
- No E2E suite found for the critical demo/admin/cockpit SSR path.
- Python services have no root-managed dev/test environment; `pytest` is not installed locally, so Python tests cannot run from a clean baseline.
- Docker production package manifest/copy stages were drifting from workspace dependencies; fixed for `packages/external-investments` in this patch, but the hand-maintained pattern remains fragile.
- The worktree contains broad pre-existing/unrelated modifications and untracked external-investments files/migrations, increasing review risk.

### Medium

- Large source files: `create-dashboard-advisor-use-cases.ts`, `dashboard-advisor-repository.ts`, `apps/worker/src/index.ts`, `packages/external-investments/src/repository.ts`, `routes/trading-lab.ts`, `ai-advisor-panel.tsx`, `integrations.tsx`, `dashboard/types.ts`, `packages/env/src/index.ts`.
- No Effect dependency/pattern found despite many provider/job/use-case flows that fit typed effects.
- No TypeScript project references/build graph; typecheck is global and not obviously incremental by package.
- Duplicate zod major versions: zod v4 in API/web and zod v3 in worker/env.
- Web build reports large chunks around main/three/reactbits.
- Quant-service Docker/image is present but release workflow only clearly builds knowledge-service among Python services.
- Public runtime env and SSR safe-env logging allowlists should be periodically reconciled as new public flags are added.

### Low

- `.dockerignore` comments show mojibake from prior encoding, though behavior is unaffected.
- Generated/cached artifacts exist locally and need to stay ignored from audits/context.
- Documentation is rich but overlapping; this inventory should reduce future context scattering.

## 13. Recommended roadmap

### Immediate safe wins

1. Fix existing Biome lint violations, then make the currently explicit root lint baseline blocking.
2. Add Docker build smoke in CI for web/api/worker targets and knowledge/quant services after Docker daemon/runtime assumptions are validated.
3. Add route tests for external investment credential/sync auth and demo blocking.
4. Decide whether Python Ruff formatting should be applied in a dedicated format-only patch.
5. Expand the Playwright demo smoke into an admin-safe smoke only after fixture/secrets strategy is explicit.

### Short-term optimizations

1. Introduce a simple affected-task script using changed files and workspace dependency graph before considering Nx/Turbo/Moon.
2. Split `apps/worker/src/index.ts` into Powens sync orchestration, Redis metrics, status server, and scheduler bootstrap modules.
3. Split AI Advisor repository/use-case files by daily brief, recommendations, chat, costs, knowledge, and operations.
4. Add bundle analysis and manual chunking/route splitting for Three/ReactBits/Trading Lab.
5. Add contract tests for dashboard API response shapes consumed by web hooks.

### Effect adoption strategy

Use Effect where it reduces risk in async provider/job/domain orchestration:

- External provider adapters: Powens, IBKR, Binance, news, markets, AI providers.
- Worker jobs: retries, timeout, schedules, idempotent job results, cancellation, resource cleanup.
- Use cases: typed domain errors and dependency injection via Context/Layer.
- Config: either Effect Config or a thin wrapper around existing env validation after proving value.
- Schema: use Effect Schema where it replaces duplicated runtime/type contracts; do not churn stable zod routes all at once.
- Observability: typed spans/log annotations and redacted errors where useful.

Do not use Effect for:

- Presentational React components.
- Simple synchronous formatters.
- Stable CRUD route wrappers where zod/current code is clearer.
- A repo-wide rewrite without tests.

Recommended first implementation target: `packages/external-investments` provider clients and `apps/worker/src/external-investments-sync.ts`, because the domain is read-only, provider-heavy, and already package-isolated.

Phase 2 decision on 2026-05-02: defer the code-level Effect pilot until the external-investments WIP is stabilized. The package and worker sync path are currently part of a broad untracked integration surface, so adding a new runtime abstraction there would mix dependency introduction, provider orchestration, and unsettled feature code in one review. The safe follow-up spec is:

1. Add focused tests around one read-only provider operation covering success, timeout, retry exhaustion, redacted failure mapping, and unchanged public return shape.
2. Add `effect` only to the owning package.
3. Wrap exactly one isolated provider call with `Effect.tryPromise`, a bounded timeout, a small retry `Schedule`, and typed/redacted provider errors.
4. Keep existing exported functions and credential behavior unchanged.
5. Prove compatibility with `pnpm --filter @finance-os/external-investments test`, worker typecheck, and the E2E demo smoke.

### Bigger architectural migrations

- TypeScript project references after package boundaries and generated outputs are cleaned up.
- Nx/Turbo/Moon only if a measured affected-task script is insufficient.
- Vite 8/Rolldown migration only after TanStack Start compatibility and plugin behavior are validated in a branch.
- Full AI/knowledge architecture rewrite only after redaction/budget/context contract tests exist.
- Python service extraction/shared workspace after uv/Ruff/pytest baseline exists.

### Risky experiments to defer

- Full Effect rewrite.
- Mass dependency upgrades.
- Major Drizzle schema migrations in the same patch as docs/infrastructure changes.
- Admin login UX redesign.
- Cockpit hero redesign.
- Any trading/execution feature.

### Things not worth doing yet

- Forcing Effect into React UI.
- Adding Nx just for branding if a small task graph solves the problem.
- Replacing deterministic demo fixtures with live mocks.
- Moving all docs into one generated mega-doc; keep this inventory as a current-state map and link to specialized docs.

## 14. Open questions

1. Should root `pnpm lint` become the required CI lint after fixing the existing Biome violations, or should Biome be scoped differently?
2. Should Python services use one root uv workspace or separate uv lockfiles per service?
3. Should quant-service be built/published in the release workflow alongside knowledge-service?
4. What is the first accepted Effect pilot domain: external investments, Powens sync, market/news providers, or AI provider clients?
5. Which route should own enrichment notes in the product UI?
6. What is the minimum acceptable E2E coverage for local-only personal deployment versus production smoke checks?
7. Should zod v3/v4 duplication be converged now, or deferred until package owners are clarified?
