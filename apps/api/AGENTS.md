# AGENTS.md - apps/api

Scope: `apps/api/**`

## Local Rules

- Keep [src/index.ts](src/index.ts) as the API composition root. Preserve both bare and `/api` compatibility mounts, request-id propagation, and startup route assertions.
- Keep public `GET /health` and `GET /version` aligned with the shared system contract used by web and worker, including runtime flags such as `safeModeActive`.
- Keep HTTP parsing, validation, status codes, and response shaping in route files such as [src/routes/dashboard/routes/summary.ts](src/routes/dashboard/routes/summary.ts) and [src/routes/integrations/powens/routes/callback.ts](src/routes/integrations/powens/routes/callback.ts).
- Keep orchestration in `domain/`, persistence in `repositories/`, provider and deterministic helpers in `services/`, and wiring in `runtime.ts` plus `plugin.ts`.
- Demo must short-circuit before any DB, Redis, or Powens access. `GET /auth/me` must stay `200`, `Cache-Control: no-store`, and must never hit DB or Powens.
- Powens callback must continue to allow either an admin session or a valid signed state. Never log callback codes, tokens, or decrypted provider payloads.
- Preserve normalized API errors, safe details only, and structured logs from [src/observability/logger.ts](src/observability/logger.ts).
- Preserve request-id propagation on every API path, including bare and `/api` compatibility routes, so smoke checks and runtime logs can correlate the same request end to end.

## Verify

- `pnpm api:typecheck`
- `bun test apps/api/src/auth/routes.test.ts`
- `bun test <changed-api-test-file>` for any changed Bun test file under `apps/api/src`
- `pnpm smoke:api` when public routes, proxy compatibility, or auth routing changes

## Pitfalls

- Do not move DB or provider work into route files.
- Do not remove route guards or startup route assertions without replacing them with equivalent protection.
- Keep `/auth/me`, `/dashboard/*`, and `/integrations/powens/*` aligned with [../../docs/agentic/contracts-map.md](../../docs/agentic/contracts-map.md).
