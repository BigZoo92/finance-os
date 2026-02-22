# AGENT.md - `apps/api`

Last updated: 2026-02-22.

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
- Worker owns actual synchronization execution.

### 3.4 Security

- Never log Powens callback codes or access tokens.
- Return sanitized error messages only.
- Keep encryption logic centralized (`@finance-os/powens` crypto).

## 4) DB and env boundaries

- DB access only through `@finance-os/db`.
- Env access only through `@finance-os/env`.
- Avoid direct `process.env` usage in route/domain/repository logic.

## 5) Validation expectations

For Powens/API changes run:

- `pnpm api:typecheck`
- `pnpm worker:typecheck` when queue/job contracts changed
