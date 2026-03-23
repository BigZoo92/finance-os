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
- API dashboard normalization:
  - [../../apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.test.ts](../../apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.test.ts)
- Web dashboard presentation helpers:
  - [../../apps/web/src/components/dashboard/wealth-history.test.ts](../../apps/web/src/components/dashboard/wealth-history.test.ts)
- Web auth and API client behavior:
  - [../../apps/web/src/features/auth-ssr.test.ts](../../apps/web/src/features/auth-ssr.test.ts)
  - [../../apps/web/src/features/auth-view-state.test.ts](../../apps/web/src/features/auth-view-state.test.ts)
  - [../../apps/web/src/lib/api.test.ts](../../apps/web/src/lib/api.test.ts)
  - [../../apps/web/src/lib/public-runtime-env.test.ts](../../apps/web/src/lib/public-runtime-env.test.ts)
  - [../../apps/web/src/features/powens/sanitize-connection-id.test.ts](../../apps/web/src/features/powens/sanitize-connection-id.test.ts)
- Worker import normalization:
  - [../../apps/worker/src/raw-import.test.ts](../../apps/worker/src/raw-import.test.ts)

## Scope-Based Verification

- Docs, AGENTS, or skills only:
  - `node .agents/skills/scripts/validate-agent-foundation.mjs`
- API auth or contract changes:
  - `pnpm api:typecheck`
  - `bun test <changed-api-test-file>`
  - `pnpm smoke:api` when route or proxy behavior changed
- Worker sync, import staging, or provider normalization changes:
  - `pnpm worker:typecheck`
  - `bun test apps/worker/src/raw-import.test.ts`
  - `bun test apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.test.ts`
- Dashboard asset-model or unified financial-account changes:
  - `pnpm api:typecheck`
  - `bun test apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.test.ts`
  - `pnpm worker:typecheck` when provider cash assets or financial accounts are refreshed from sync
  - `pnpm --filter @finance-os/db typecheck` when DB schema changes
  - `pnpm web:typecheck`
- Shared health/version contract changes across runtimes:
  - `pnpm api:typecheck`
  - `bun test apps/api/src/routes/system.test.ts`
  - `pnpm web:test`
  - `pnpm web:build`
  - `pnpm worker:typecheck`
  - `pnpm smoke:api` and/or `node scripts/smoke-prod.mjs --base=<url>` for deployed verification
- Production Compose alerting or health-monitoring changes:
  - `node --test infra/docker/ops-alerts/monitor.test.mjs`
  - `pnpm worker:typecheck` when heartbeat wiring or worker env changed
  - `pnpm smoke:api` when healthcheck URLs, proxy routing, or probe targets changed
  - `pnpm check:ci` when the environment can install and run the full repo suite
- Web loader, auth, or UI changes:
  - `pnpm web:typecheck`
  - `pnpm web:test`
  - `pnpm web:build`
  - `bun test apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.test.ts` when the UI depends on a changed dashboard summary contract
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
- Worker raw-import coverage exists as focused Bun tests, but normalized transaction persistence still relies on package typechecks plus CI migration checks rather than a dedicated end-to-end worker suite.
- Dashboard read-model routes and Powens route handlers have limited direct contract tests today.
- UI regression coverage is mostly manual for dashboard surfaces.

## Manual Checks Worth Doing

- Demo mode: dashboard loads mock summary, transactions, and Powens status with sensitive actions disabled.
- Admin mode: `/auth/me` resolves admin on first SSR render with no demo flash.
- Powens callback: invalid auth/state fails safely, valid admin/state flow returns success and queues sync.
- Release-sensitive changes: run the smoke scripts in [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs) and [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs) with the right env; prod smoke now covers `/health`, `/auth/me`, `/dashboard/summary`, and `/integrations/powens/status`, plus optional demo/admin auth context via `SMOKE_AUTH_MODE`.
