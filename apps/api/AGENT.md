# AGENT.md - `apps/api`

Last updated: 2026-02-27.

This file defines implementation rules for the API workspace.

## 1) API architecture rules

- Framework: Elysia.
- Keep each integration feature split into:
- `routes/` (HTTP only)
- `schemas.ts` (validation contracts)
- `domain/` (use-cases)
- `repositories/` (DB/queue persistence)
- `services/` (external provider setup/helpers)
- `runtime.ts` (feature composition root)
- `plugin.ts` (typed context injection)

Do not place DB writes or provider orchestration directly in route handlers.

For dashboard read-model endpoints, keep DB reads in dedicated repositories/use-cases (no Powens HTTP calls).

## 2) Elysia usage requirements

- Use feature plugins and `.decorate(...)` to inject runtime dependencies.
- Keep route modules thin and modular (`new Elysia().get/post...` then `.use(...)` from parent router).
- Type decorated context for route modules.
- Keep HTTP status/error mapping in route layer.
- Validate request payloads with Elysia `t` schemas from `schemas.ts`.

## 3) Powens integration architecture (`apps/api/src/routes/integrations/powens`)

### 3.1 Flow overview

- `GET /connect-url`: returns Powens connect URL.
- `POST /callback`: validates payload, executes callback use-case.
- `POST /sync`: enqueue sync for one/all connections.
- `GET /status`: returns current connection statuses.

### 3.2 Callback flow

- Route validates `connection_id` + `code`.
- Use-case decodes code, exchanges token, encrypts token.
- Repository upserts `powens_connection`.
- Queue repository enqueues `powens.syncConnection`.

### 3.3 Sync flow

- Route delegates to `requestSync` use-case.
- Use-case decides between `powens.syncConnection` and `powens.syncAll`.
- Manual sync is rate-limited in Redis (cooldown guardrail).
- Worker owns actual synchronization execution.

### 3.4 Security

- Never log Powens callback codes or access tokens.
- Return sanitized error messages only.
- Keep encryption logic centralized (`@finance-os/powens` crypto).

## 4) Dashboard read model (`apps/api/src/routes/dashboard`)

- `GET /dashboard/summary` and `GET /dashboard/transactions` are DB-only endpoints.
- Validate query params (`range`: `7d|30d|90d`, bounded `limit`, cursor format).
- Keep transaction pagination cursor-based and deterministic (`booking_date desc, id desc`).

## 5) Debug and private mode

- `GET /debug/metrics` must not expose secrets.
- `GET /__routes` is a debug endpoint for runtime route introspection.
- In production, `/__routes` must stay inaccessible unless `PRIVATE_ACCESS_TOKEN` is configured and provided.
- Respect private token checks (`x-finance-os-access-token`) when enabled.
- Respect optional debug token checks (`x-finance-os-debug-token`) for metrics endpoint.

## 6) DB and env boundaries

- DB access only through `@finance-os/db`.
- Env access only through `@finance-os/env`.
- Avoid direct `process.env` usage in route/domain/repository logic.

## 7) Validation expectations

For Powens/API changes run:

- `pnpm api:typecheck`
- `pnpm worker:typecheck` when queue/job contracts changed

## 8) Auth and demo mode rules

- Auth decision source is `ctx.auth.mode` (`admin` or `demo`), resolved once from root derive.
- Default mode is `demo` when auth cookie is absent/invalid.
- For data routes, evaluate demo mode first in the handler.
- In demo mode, return mocks and stop before any DB or Powens call.
- Keep mocks in `apps/api/src/mocks/*`.
- Sensitive endpoints (sync/connect/callback/write actions) must be admin-only.
- Auth endpoints:
  - `POST /auth/login` sets session cookie.
  - `POST /auth/logout` clears session cookie.
  - `GET /auth/me` returns auth mode + user payload and must be `Cache-Control: no-store`.
  - Auth hash source priority:
    - `AUTH_PASSWORD_HASH_B64` (recommended, base64 UTF-8) when present
    - fallback `AUTH_PASSWORD_HASH` for legacy compatibility
  - `/auth/me` contract:
    - admin => `200 { mode: "admin", user: { email, displayName } }`
    - demo => `200 { mode: "demo", user: null }`
  - `/auth/me` must never read DB/Powens.
- Core read endpoints:
  - `GET /dashboard/summary` and `GET /dashboard/transactions` must always exist and keep one contract for admin+demo.
  - demo branch must execute first and return mocks before any DB query.
  - keep `/api/*` compatibility routes available in addition to root routes for proxy strip-path resilience.
- Private access gate:
  - header `x-finance-os-access-token` when `PRIVATE_ACCESS_TOKEN` is enabled.
  - in development, `/auth/login`, `/auth/logout` and `/auth/me` remain accessible without this header.
- API errors must not leak internals: return sanitized `500` payloads.

### Feature checklist

- Data route implements admin/demo switch on the same endpoint.
- Demo branch returns a minimal mock dataset from `apps/api/src/mocks/*`.
- No repository or provider call is reachable from demo branch.
- Admin-only mutations enforce guard in API route layer.
