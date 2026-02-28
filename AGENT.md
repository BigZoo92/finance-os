# AGENT.md

Last updated: 2026-02-27.

This file is the repository-wide source of truth for architecture and implementation rules for AI/code agents.

## 1) Non-negotiable maintenance rule

If a change affects architecture, boundaries, conventions, scripts, shared packages, or Powens flows, update this file in the same patch.

## 2) Monorepo architecture

`finance-os` is a pnpm TypeScript monorepo.

- `apps/api`: Elysia HTTP API.
- `apps/web`: TanStack Start web app.
- `apps/worker`: background jobs (Powens sync worker).
- `packages/db`: Drizzle schema/client.
- `packages/env`: central env parsing/validation.
- `packages/powens`: Powens client, crypto, queue payloads.
- `packages/prelude`: shared low-level utilities (currently error formatting).
- `packages/redis`: Redis client factory.
- `packages/ui`: shared UI components/styles.

## 3) Architecture principles

- Keep boundaries explicit:
- route layer: HTTP parsing, validation, status codes.
- domain/use-case layer: orchestration and business intent.
- repository layer: persistence and queue writes.
- service layer: external providers and deterministic helpers.
- Dashboard data is DB-first. Web must not call Powens provider APIs directly.
- Avoid monolithic files and hidden side effects.
- Prefer dependency injection for use-cases to keep testability high.
- Keep single-user assumptions. Do not introduce multi-user abstractions.
- Add abstractions only when they reduce real coupling.

### 3.1 Feature dual-path contract (mandatory)

- Every new feature must implement two explicit paths:
- demo path: no DB writes/reads, no Powens/provider calls, mocked deterministic payloads only.
- admin path: real DB + Powens/provider integrations, guarded by admin session or approved internal token where needed.
- Keep API behavior explicit for auth boundaries:
- `/auth/me` must remain stable (`200` with `{ mode: "admin"|"demo" }`, never `404`).
- Keep a protected route inventory endpoint available in production for diagnostics:
- `GET /debug/routes` (requires `x-finance-os-debug-token` or valid internal token).

## 4) API rules (Elysia)

Canonical pattern for backend features:

- `routes/`: thin Elysia route modules.
- `schemas.ts`: request schema definitions (`t.Object`, `t.Optional`, etc.).
- `domain/`: use-cases with no HTTP framework coupling.
- `repositories/`: DB/Redis operations.
- `services/`: external integration setup/helpers.
- `runtime.ts`: composition root for feature dependencies.
- `plugin.ts`: typed Elysia plugin that decorates feature runtime into context.

Required Elysia practices:

- Use Elysia plugin system for feature dependency injection.
- Type decorated context explicitly for feature route modules.
- Keep route registration modular (`.use(routePlugin)` per route module).
- Keep `set.status` and response shaping in route layer only.
- Validate dashboard ranges and pagination inputs at route boundary (`7d|30d|90d`).

## 5) Frontend rules (TanStack Start + Query + DB)

### 5.1 Loader-first data strategy

- Route-critical data should be loaded via route `loader`.
- Use `context.queryClient.ensureQueryData(...)` in loaders to prewarm cache.
- Keep loaders deterministic and side effects explicit.

### 5.2 TanStack Query usage

- Remote server state must use Query/Mutation, not local component state mirrors.
- Define query keys and query options in feature modules.
- Mutations must invalidate or refresh relevant query keys.
- Keep error normalization in helper functions, not ad hoc in JSX.
- Use route search params for dashboard range filters (avoid duplicate local state).

### 5.3 React anti-pattern avoidance

- Avoid `useEffect` and `useState` for request orchestration and remote state.
- Prefer:
- route loaders
- `useQuery`
- `useMutation`
- query cache invalidation
- Use local state only for true ephemeral UI-only state that Query/Router cannot model.

### 5.4 TanStack DB

- Use TanStack DB only when client-side relational/cache modeling provides clear value.
- Do not introduce TanStack DB for simple fetch/list/mutation flows where Query is sufficient.

## 6) Powens integration architecture

### 6.1 Flow overview

- Web gets connect URL from API `GET /integrations/powens/connect-url`.
- API connect-url must inject a short-lived signed `state` (HMAC, `admin:true`, `exp:+10min`) in the Powens webview URL.
- User completes Powens webview and lands on web callback route.
- Web callback route posts to API callback endpoint.
- API exchanges code for token, encrypts token, upserts connection, enqueues sync job.
- Worker consumes Redis jobs, syncs accounts/transactions, updates sync status.
- Web dashboard reads status from API `GET /integrations/powens/status`.

### 6.2 Callback flow responsibilities

- `apps/web` callback route: parse URL params, call API callback, render success/error.
- `apps/api` callback route: HTTP validation + status code mapping only.
- callback auth rule: accept callback only if admin cookie is valid OR signed Powens `state` is valid.
- `apps/api` callback use-case: decode code, exchange token, encrypt token, persist, enqueue.
- `apps/api` repositories: DB upsert + Redis queue push.

### 6.3 Sync flow responsibilities

- Manual sync API endpoint enqueues either:
- one connection sync (`powens.syncConnection`)
- all connections sync (`powens.syncAll`)
- Manual sync endpoint must enforce Redis cooldown guardrails in production usage.
- Worker owns sync execution and status transitions (`syncing`, `connected`, `error`, `reconnect_required`).

### 6.4 Worker responsibility boundaries

- Dequeue Powens jobs and isolate failures per connection.
- Acquire/release per-connection lock in Redis.
- Upsert accounts/transactions idempotently.
- Update `powens_connection` status and timestamps.
- Maintain operational metrics in Redis (daily sync count, daily Powens call count, last sync start/end).
- Never expose access tokens in logs.

### 6.5 Security rules

- Never log Powens `code` or access tokens.
- Persist only encrypted access tokens (`APP_ENCRYPTION_KEY` AES-GCM path).
- Treat callback query params as sensitive.
- Keep API error payloads sanitized (`toSafeErrorMessage`).
- Keep private deployments non-indexed (`robots` meta + `X-Robots-Tag` when applicable).
- If `PRIVATE_ACCESS_TOKEN` is enabled, only server-side calls may send it (`x-internal-token` or `Authorization: Bearer ...`).
- Never expose private/internal tokens through `VITE_*` variables.

## 7) Prelude package usage

Purpose:

- Host tiny shared utilities with no app-runtime coupling.
- Keep cross-app helpers centralized and consistent.

Usage rules:

- Keep modules cohesive and low-level (`errors`, `format`, etc.).
- Avoid dependencies from `prelude` into app code or heavy external SDKs.
- Keep public API explicit via `package.json` exports.
- Preserve backward compatibility for existing import paths when reorganizing modules.

Import conventions:

- Prefer explicit modules like `@finance-os/prelude/errors`.
- Root import `@finance-os/prelude` is allowed for stable umbrella exports.
- Legacy aliases (for example `@finance-os/prelude/format`) may remain for compatibility but should not be preferred for new code.

## 8) Validation checklist for agents

Before finishing a patch:

- Run targeted typechecks for touched workspaces.
- Confirm no generated files were manually edited.
- Confirm route/domain/repository/service boundaries remain clear.
- Confirm query keys and mutation invalidation are coherent.
- Confirm `AGENT.md` files are still accurate.

## 9) Local AGENT scopes

Read these in addition to this root file when touching those areas:

- `apps/api/AGENT.md`
- `apps/web/AGENT.md`
- `packages/prelude/AGENT.md`

## 10) Production deployment (Dokploy + Docker)

### 10.1 Source of truth

- Production Compose file: `docker-compose.prod.yml`.
- Production Dockerfile (multi-target): `infra/docker/Dockerfile`.
- Production deployment guide: `docs/deploy-dokploy.md`.
- CI/CD runbook: `docs/ci-cd.md`.
- Dokploy env matrix: `docs/deploy-dokploy-env.md`.

### 10.2 Image strategy and targets

- Use a single multi-stage Dockerfile with explicit targets, built in CI and pushed to GHCR:
- `web` target: TanStack Start build output (`apps/web/.output`) served by Node.
- `api` target: Bun runtime with API sources and workspace runtime deps only.
- `worker` target: Bun runtime with worker sources and workspace runtime deps only.
- Production compose must reference `image:` entries only for app services (`web`, `api`, `worker`).
- Do not use `build:` for production deploys (no server-side image build).
- Runtime containers must run as non-root users.
- Keep startup commands in `infra/docker/entrypoints/*.sh`.

### 10.3 Environment variable conventions

- Canonical public URL variables:
- `APP_URL` (main public app URL)
- `WEB_URL` (public web URL, usually same as `APP_URL`)
- `API_URL` (public API URL, typically `${APP_URL}/api`)
- Legacy `WEB_ORIGIN` remains supported for compatibility but do not use it for new production setup.
- Web runtime API URL strategy (TanStack Start):
- Browser requests must use `VITE_API_BASE_URL` (default `/api`).
- Server SSR requests must use `API_INTERNAL_URL` first (example `http://api:3001`).
- If `API_INTERNAL_URL` is missing, SSR falls back to `VITE_APP_ORIGIN` + `VITE_API_BASE_URL`.
- Public production traffic should terminate on `web` only. The TanStack Start/Nitro runtime proxies `/api/*` to `API_INTERNAL_URL`, so a separate public Dokploy route to `api:3001` is unnecessary and can diverge from local behavior.
- Build variables for production compose (Dokploy Git provider mode):
- `NODE_VERSION`
- `BUN_VERSION`
- `PNPM_VERSION`
- Dokploy runtime variables required for `web`:
- `API_INTERNAL_URL=http://api:3001`
- `VITE_API_BASE_URL=/api`
- `VITE_APP_ORIGIN=${APP_URL}` (or `${WEB_URL}` when different)
- optional debug: `LOG_LEVEL=debug` and/or `APP_DEBUG=1`
- optional server-only internal token: `PRIVATE_ACCESS_TOKEN` (same value in `api` and `web` runtime env)
- never define `VITE_PRIVATE_ACCESS_TOKEN`
- Dokploy runtime variables required for `api` auth hash:
- preferred: `AUTH_ADMIN_PASSWORD_HASH_B64` (base64 UTF-8 hash, recommended `pbkdf2$...`)
- fallback: `AUTH_ADMIN_PASSWORD_HASH`, then legacy `AUTH_PASSWORD_HASH_B64`, then `AUTH_PASSWORD_HASH`
- supported hash formats: `pbkdf2$...` (recommended) and legacy `$argon2...`
- Why B64: avoids `$` interpolation/escaping issues in Dokploy/Compose env editors.
- All production required variables are documented in `.env.prod.example`.
- Exhaustive Dokploy variable mapping is documented in `docs/deploy-dokploy-env.md`.
- `APP_IMAGE_TAG` is only relevant in GHCR image-pull mode (not in Git-provider build mode).

### 10.4 Migrations strategy

- Production migration strategy is **API bootstrap migration** (strategy A):
- API entrypoint runs `apps/api/src/bootstrap.ts`.
- `bootstrap.ts` applies Drizzle migrations from `packages/db/drizzle` before starting the API server.
- This behavior is controlled by `RUN_DB_MIGRATIONS` (`true` by default in production compose).
- Do not add manual SQL bootstrap scripts that bypass Drizzle migration history.

### 10.5 Healthchecks and service dependencies

- `web` and `api` use HTTP healthchecks via `infra/docker/healthchecks/http-healthcheck.mjs`.
- `worker` uses heartbeat-file healthcheck via `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`.
- `web` healthcheck target must be `/healthz` (never `/`) to avoid false-unhealthy on transient UI/SSR failures.
- `http-healthcheck.mjs` defaults to `/healthz` when `HEALTHCHECK_URL` has no explicit path.
- `depends_on` must use `condition: service_healthy` for startup ordering.
- `api` must not expose host ports in production compose (internal network only).
- Runtime hardening for app services (`web`, `api`, `worker`) should include:
- `read_only: true`
- `tmpfs` mount for `/tmp`
- `cap_drop: [ALL]`
- `security_opt: [no-new-privileges:true]`
- Keep Postgres/Redis writable (volumes) and internal-only (no published ports).

### 10.6 Deployment and verification workflow

- Validate Compose before deployment:
- `docker compose --env-file .env.prod -f docker-compose.prod.yml config`
- Pull and start (no build):
- `docker compose --env-file .env.prod -f docker-compose.prod.yml pull`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d`
- Verify:
- `docker compose --env-file .env.prod -f docker-compose.prod.yml ps`
- `docker compose --env-file .env.prod -f docker-compose.prod.yml logs --no-color --tail=200 web api worker`
- Dokploy routing must be:
- host `finance-os.enzogivernaud.fr` path `/` -> `web:3000`
- no separate public route to `api:3001` in the standard setup; `web` proxies `/api/*` internally
- Production 500 debug workflow:
- set `LOG_LEVEL=debug` and/or `APP_DEBUG=1` on `web`
- redeploy and inspect `web` logs (SSR stack + route + sanitized env snapshot)
- confirm `GET /healthz` returns `200 {"ok":true}` independently from `/`
- Production route/debug checks from inside `web` container:
- `wget -qO- http://127.0.0.1:3000/healthz`
- `wget -qSO- http://api:3001/auth/me --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'`
- `wget -qSO- 'http://api:3001/dashboard/summary?range=30d' --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'`
- optional: `wget -qO- http://api:3001/__routes --header='x-internal-token: <PRIVATE_ACCESS_TOKEN>'`
- API also exposes compatibility routes under `/api/*`; keep Dokploy `/api` strip-path enabled as the preferred routing mode.
- Agents changing deployment/runtime/env contracts must update:
- `docker-compose.prod.yml`
- `.env.prod.example`
- `docs/deploy-dokploy.md`
- this `AGENT.md` section

## 11) Auth and demo mode (single-user)

- Demo version first rule (non-negotiable):
- every feature must ship a working demo response by default.
- every feature must have two explicit paths:
  - `demo`: no DB access, no Powens call, mock data only.
  - `admin`: DB/Powens enabled.
- if requester is not authenticated as BigZoo, backend returns mocks and must stop before DB/Powens calls.
- frontend must never crash on missing/failed endpoints; fallback to demo data is required.
- Auth hash env resolution:
- use priority: `AUTH_ADMIN_PASSWORD_HASH_B64` -> `AUTH_ADMIN_PASSWORD_HASH` -> `AUTH_PASSWORD_HASH_B64` -> `AUTH_PASSWORD_HASH`.
- decoded/fallback hash must start with `pbkdf2$` or `$argon2`.
- Zod errors must stay actionable:
  - `<VAR> is not valid base64`
  - `Decoded hash must start with $argon2 or pbkdf2$`
- Auth model is single-user manual auth (no multi-user abstraction).
- API auth state must be resolved via `ctx.auth.mode` (`admin` or `demo`).
- API auth source of truth is the root auth derive (cookie -> `ctx.auth.mode`), not duplicated per feature.
- Demo mode is the default when cookie is missing or invalid.
- Any feature that reads or returns business data must support demo mode on the same route.
- Any non-auth feature must return mocks in demo mode before any DB/Powens call.
- Backend rule: in demo mode, return mock data only and stop before any DB query or Powens call.
- Mock datasets live under `apps/api/src/mocks/*`.
- Frontend rule: clearly show demo state (banner/badge), keep read-only flows available, and disable sensitive actions (connect/sync/write actions).
- Core endpoint contracts (must always exist in admin + demo):
  - `GET /auth/me`:
    - admin => `200 { mode: "admin", user: { email, displayName: "BigZoo" } }`
    - demo => `200 { mode: "demo", user: null }`
    - no DB/Powens call
  - `GET /dashboard/summary?range=7d|30d|90d`:
    - admin => DB-backed summary
    - demo => stable mock summary
  - `GET /dashboard/transactions?range=...&limit=...&cursor=...`:
    - admin => DB-backed paginated data
    - demo => stable mock pagination
  - `GET /integrations/powens/status`:
    - admin => DB-backed statuses
    - demo => stable mock statuses
  - sensitive Powens writes:
    - `GET /integrations/powens/connect-url` => admin-only
    - `POST /integrations/powens/sync` => admin-only
    - `POST /integrations/powens/callback` => admin cookie OR valid signed `state`
- Private access barrier:
  - accepted internal headers: `x-internal-token`, `Authorization: Bearer ...`, and compatibility `x-finance-os-access-token`.
  - internal token is server-side only (`web` SSR and internal tooling); never exposed to browser bundles.
  - in development, auth endpoints (`/auth/login`, `/auth/logout`, `/auth/me`) stay reachable without internal token.
- Auth cache/control:
  - `GET /auth/me` must be `Cache-Control: no-store`.
  - `GET /auth/me` contract:
    - admin session => `200 { mode: "admin", user: { email, displayName } }`
    - no session/invalid session => `200 { mode: "demo", user: null }`
    - endpoint must be safe (no DB/Powens reads).
  - route loaders should prefetch `auth.me` and SSR hydration should keep first render auth-consistent (no demo->admin flash).
  - SSR auth fetch must never crash route rendering:
    - `404/401` => fallback `{ mode: "demo", user: null }`
    - `5xx/network` => fallback `{ mode: "demo", user: null, error: "auth_unavailable" }` with server-side log only.
- API env debug log policy for auth hash:
  - enabled only when `LOG_LEVEL=debug`
  - log only source, final hash length, and short prefix
  - never log full hash or password
- Minimal observability baseline (required):
  - propagate `x-request-id` end-to-end (web SSR + API responses).
  - API logs must be structured JSON to stdout/stderr with `level`, `msg`, `route`, `method`, `status`, `requestId`.
  - HTTP error payloads must be normalized (`code`, `message`, `requestId`, optional safe `details`).

### Dokploy auth hash generation (PowerShell)

- Generate hash + base64 with repo script:
  - `pnpm auth:hash-b64`
- Or encode an existing hash in PowerShell:
  - `$hash = 'pbkdf2$sha256$...'; [Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($hash))`
- In Dokploy Environment, set `AUTH_ADMIN_PASSWORD_HASH_B64=<value>` on the Compose app.
- Keep legacy `AUTH_PASSWORD_HASH*` empty unless needed for temporary fallback.

### Feature checklist (required)

- Route keeps same URL contract for both modes (admin + demo switch in handler).
- Demo branch is evaluated first in the handler.
- Demo branch returns a minimal mock dataset from `apps/api/src/mocks/*`.
- Sensitive mutations are admin-only both in API and UI.
- UI has an explicit demo state for the feature.
- UI does not render demo as default while auth is unresolved; use pending state until auth query resolves.
- Security criteria are explicit per feature:
  - no secrets in logs/errors
  - internal-only operations require admin session or internal token
  - error payloads stay sanitized (`code`, `message`, `requestId`)

## 12) CI/CD release policy (GitHub Actions + GHCR + Dokploy)

- CI workflow (`.github/workflows/ci.yml`) runs on:
- `push` to `main`
- `pull_request` to `main`
- Release workflow (`.github/workflows/release.yml`) runs on tags `v*` only for real deploys.
- `workflow_dispatch` in release workflow is dry-run only (image build validation without push/deploy).
- Release workflow must:
- run CI gates first (lint, typecheck, tests, build)
- build/push GHCR images for `web`, `api`, `worker`
- tag images with release tag + `sha-*` (no `latest`)
- trigger Dokploy deploy via API only after successful push
- prefer `compose.deploy` with `composeId` for Docker Compose deployments
- keep `application.deploy` as fallback for application-mode setups
- Use minimum permissions:
- CI: `contents: read`
- Release build/push: `contents: read`, `packages: write`
- Keep secrets out of logs:
- never echo secrets values
- use GitHub `secrets.*` only
- Keep deploy tag-only:
- do not add deploy-on-branch or deploy-on-PR behavior
- if deployment mode is Dokploy Git-provider on `main`, rollback is done via git revert/reset on `main`
- `APP_IMAGE_TAG` pinning applies only to GHCR image-pull mode
- Do not use Dokploy branch webhook for tag releases:
- tag refs (`refs/tags/v*`) do not satisfy webhook branch filters and can return `Branch Not Match`
