# AGENT.md

Last updated: 2026-02-22.

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
- Avoid monolithic files and hidden side effects.
- Prefer dependency injection for use-cases to keep testability high.
- Keep single-user assumptions. Do not introduce multi-user abstractions.
- Add abstractions only when they reduce real coupling.

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
- User completes Powens webview and lands on web callback route.
- Web callback route posts to API callback endpoint.
- API exchanges code for token, encrypts token, upserts connection, enqueues sync job.
- Worker consumes Redis jobs, syncs accounts/transactions, updates sync status.
- Web dashboard reads status from API `GET /integrations/powens/status`.

### 6.2 Callback flow responsibilities

- `apps/web` callback route: parse URL params, call API callback, render success/error.
- `apps/api` callback route: HTTP validation + status code mapping only.
- `apps/api` callback use-case: decode code, exchange token, encrypt token, persist, enqueue.
- `apps/api` repositories: DB upsert + Redis queue push.

### 6.3 Sync flow responsibilities

- Manual sync API endpoint enqueues either:
- one connection sync (`powens.syncConnection`)
- all connections sync (`powens.syncAll`)
- Worker owns sync execution and status transitions (`syncing`, `connected`, `error`, `reconnect_required`).

### 6.4 Worker responsibility boundaries

- Dequeue Powens jobs and isolate failures per connection.
- Acquire/release per-connection lock in Redis.
- Upsert accounts/transactions idempotently.
- Update `powens_connection` status and timestamps.
- Never expose access tokens in logs.

### 6.5 Security rules

- Never log Powens `code` or access tokens.
- Persist only encrypted access tokens (`APP_ENCRYPTION_KEY` AES-GCM path).
- Treat callback query params as sensitive.
- Keep API error payloads sanitized (`toSafeErrorMessage`).

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
