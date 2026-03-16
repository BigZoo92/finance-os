# Contracts Map

These contracts should not regress without deliberate repo-wide updates.

## Required API Contracts

| Contract | API implementation | Web caller or related flow | Notes |
| --- | --- | --- | --- |
| `GET /auth/me` | [../../apps/api/src/auth/routes.ts](../../apps/api/src/auth/routes.ts) | [../../apps/web/src/features/auth-query-options.ts](../../apps/web/src/features/auth-query-options.ts), [../../apps/web/src/features/auth-ssr.ts](../../apps/web/src/features/auth-ssr.ts) | Must return `200`, `mode`, `user`, and `Cache-Control: no-store`; must not hit DB or Powens |
| `GET /dashboard/summary?range=7d\|30d\|90d` | [../../apps/api/src/routes/dashboard/routes/summary.ts](../../apps/api/src/routes/dashboard/routes/summary.ts) | [../../apps/web/src/features/dashboard-query-options.ts](../../apps/web/src/features/dashboard-query-options.ts), [../../apps/web/src/routes/index.tsx](../../apps/web/src/routes/index.tsx) | Demo must short-circuit before DB |
| `GET /dashboard/transactions?...` | [../../apps/api/src/routes/dashboard/routes/transactions.ts](../../apps/api/src/routes/dashboard/routes/transactions.ts) | [../../apps/web/src/features/dashboard-query-options.ts](../../apps/web/src/features/dashboard-query-options.ts) | Cursor pagination, demo short-circuit |
| `GET /integrations/powens/status` | [../../apps/api/src/routes/integrations/powens/routes/status.ts](../../apps/api/src/routes/integrations/powens/routes/status.ts) | [../../apps/web/src/features/powens/query-options.ts](../../apps/web/src/features/powens/query-options.ts) | Demo returns deterministic mock statuses |
| `GET /integrations/powens/sync-runs?limit=1..100` | [../../apps/api/src/routes/integrations/powens/routes/sync-runs.ts](../../apps/api/src/routes/integrations/powens/routes/sync-runs.ts) | [../../apps/web/src/features/powens/query-options.ts](../../apps/web/src/features/powens/query-options.ts), [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx) | Demo returns deterministic run history; admin mode reads Redis-backed worker metrics |
| `GET /integrations/powens/connect-url` | [../../apps/api/src/routes/integrations/powens/routes/connect-url.ts](../../apps/api/src/routes/integrations/powens/routes/connect-url.ts) | [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx) | Admin-only sensitive route |
| `POST /integrations/powens/sync` | [../../apps/api/src/routes/integrations/powens/routes/sync.ts](../../apps/api/src/routes/integrations/powens/routes/sync.ts) | [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx), [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx) | Admin-only, queue write only |
| `POST /integrations/powens/callback` | [../../apps/api/src/routes/integrations/powens/routes/callback.ts](../../apps/api/src/routes/integrations/powens/routes/callback.ts) | [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx) | Requires admin session or valid signed state |

## Route Protection and Compatibility

- API route registration and required production assertions live in [../../apps/api/src/index.ts](../../apps/api/src/index.ts).
- Both bare routes and `/api/*` compatibility routes are mounted from the same runtime in [../../apps/api/src/index.ts](../../apps/api/src/index.ts).
- Web-side API URL resolution and SSR fallback behavior live in [../../apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts).

## Powens Flow Contracts

- Signed state generation and validation: [../../apps/api/src/auth/powens-state.ts](../../apps/api/src/auth/powens-state.ts)
- Callback token exchange and encrypted persistence: [../../apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts](../../apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts)
- Encrypted token storage schema: [../../packages/db/src/schema/powens.ts](../../packages/db/src/schema/powens.ts)
- Token encryption format: [../../packages/powens/src/crypto.ts](../../packages/powens/src/crypto.ts)

## Manual Contract Checks

- `GET /auth/me` should never 404 in prod or prod-like environments.
- `POST /integrations/powens/callback` should fail with `401` or `403`, never a route miss, when auth/state is invalid.
- If a contract changes, update the caller, the nearest `AGENTS.md`, and this map in the same change.
