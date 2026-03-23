# Testing Map

Use this map to choose the smallest verification set that still matches the risk.

## Current Automated Coverage

- API auth and guards:
  - [../../apps/api/src/auth/routes.test.ts](../../apps/api/src/auth/routes.test.ts)
  - [../../apps/api/src/auth/guard.test.ts](../../apps/api/src/auth/guard.test.ts)
  - [../../apps/api/src/auth/session.test.ts](../../apps/api/src/auth/session.test.ts)
  - [../../apps/api/src/auth/powens-state.test.ts](../../apps/api/src/auth/powens-state.test.ts)
- API debug and system routing:
  - [../../apps/api/src/routes/debug/router.test.ts](../../apps/api/src/routes/debug/router.test.ts)
  - [../../apps/api/src/routes/system.test.ts](../../apps/api/src/routes/system.test.ts)
- Web auth and API client behavior:
  - [../../apps/web/src/features/auth-ssr.test.ts](../../apps/web/src/features/auth-ssr.test.ts)
  - [../../apps/web/src/features/auth-view-state.test.ts](../../apps/web/src/features/auth-view-state.test.ts)
  - [../../apps/web/src/lib/api.test.ts](../../apps/web/src/lib/api.test.ts)
  - [../../apps/web/src/features/powens/sanitize-connection-id.test.ts](../../apps/web/src/features/powens/sanitize-connection-id.test.ts)

## Scope-Based Verification

- Docs, AGENTS, or skills only:
  - `node .agents/skills/scripts/validate-agent-foundation.mjs`
- API auth or contract changes:
  - `pnpm api:typecheck`
  - `bun test <changed-api-test-file>`
  - `pnpm smoke:api` when route or proxy behavior changed
- Shared health/version contract changes across runtimes:
  - `pnpm api:typecheck`
  - `bun test apps/api/src/routes/system.test.ts`
  - `pnpm web:test`
  - `pnpm web:build`
  - `pnpm worker:typecheck`
  - `pnpm smoke:api` and/or `node scripts/smoke-prod.mjs --base=<url>` for deployed verification
- Web loader, auth, or UI changes:
  - `pnpm web:typecheck`
  - `pnpm web:test`
  - `pnpm web:build`
- DB, env, Powens, Redis, or prelude package changes:
  - `pnpm --filter <package> typecheck`
  - package-specific follow-up such as `pnpm db:generate` when schema changes
- Full confidence pass:
  - `pnpm lint`
  - `pnpm typecheck`
  - `pnpm -r --if-present test`
  - `pnpm -r --if-present build`

## Known Gaps

- There is no worker package test suite today.
- Dashboard read-model routes and Powens route handlers have limited direct contract tests today.
- UI regression coverage is mostly manual for dashboard surfaces.

## Manual Checks Worth Doing

- Demo mode: dashboard loads mock summary, transactions, and Powens status with sensitive actions disabled.
- Admin mode: `/auth/me` resolves admin on first SSR render with no demo flash.
- Powens callback: invalid auth/state fails safely, valid admin/state flow returns success and queues sync.
- Release-sensitive changes: run the smoke scripts in [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs) and [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs) with the right env.
