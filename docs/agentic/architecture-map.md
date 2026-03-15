# Architecture Map

Start here when you need the shortest path to the right runtime entrypoint.

## Runtime Entry Points

- API runtime: [../../apps/api/src/index.ts](../../apps/api/src/index.ts)
  - local rules: [../../apps/api/AGENTS.md](../../apps/api/AGENTS.md)
  - auth routes: [../../apps/api/src/auth/routes.ts](../../apps/api/src/auth/routes.ts)
  - dashboard feature root: [../../apps/api/src/routes/dashboard/router.ts](../../apps/api/src/routes/dashboard/router.ts)
  - Powens feature root: [../../apps/api/src/routes/integrations/powens/router.ts](../../apps/api/src/routes/integrations/powens/router.ts)
- Web runtime: [../../apps/web/src/routes/index.tsx](../../apps/web/src/routes/index.tsx)
  - local rules: [../../apps/web/AGENTS.md](../../apps/web/AGENTS.md)
  - SSR API client: [../../apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
  - dashboard shell: [../../apps/web/src/components/dashboard/app-shell.tsx](../../apps/web/src/components/dashboard/app-shell.tsx)
  - Powens callback route: [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx)
- Worker runtime: [../../apps/worker/src/index.ts](../../apps/worker/src/index.ts)
  - local rules: [../../apps/worker/AGENTS.md](../../apps/worker/AGENTS.md)

## Package Anchors

- DB schema and client: [../../packages/db/src/index.ts](../../packages/db/src/index.ts), [../../packages/db/src/schema/powens.ts](../../packages/db/src/schema/powens.ts)
- Env parsing: [../../packages/env/src/index.ts](../../packages/env/src/index.ts)
- Powens client and crypto: [../../packages/powens/src/client.ts](../../packages/powens/src/client.ts), [../../packages/powens/src/crypto.ts](../../packages/powens/src/crypto.ts)
- Redis factory: [../../packages/redis/src/index.ts](../../packages/redis/src/index.ts)
- Shared UI: [../../packages/ui/src/components/index.ts](../../packages/ui/src/components/index.ts)
- Low-level helpers: [../../packages/prelude/src/index.ts](../../packages/prelude/src/index.ts)
- TS config presets: [../../packages/config-ts/package.json](../../packages/config-ts/package.json)
- `packages/domain` exists today but has no active source files; read the concrete app/package code instead of assuming shared domain logic lives there.

## Layering Expectations

- API route files parse and shape HTTP only. Domain files orchestrate. Repository files persist. Service files talk to providers or deterministic helpers. Runtime and plugin files wire dependencies.
- Web route loaders prewarm Query and keep SSR auth-consistent. Feature modules own query keys and request functions.
- Worker owns provider sync loops, locks, and metrics; it should not become a second API layer.

## First Reads By Change Type

- Auth or session change: [../../apps/api/src/auth/routes.ts](../../apps/api/src/auth/routes.ts), [../../apps/api/src/auth/derive.ts](../../apps/api/src/auth/derive.ts), [../../apps/web/src/features/auth-ssr.ts](../../apps/web/src/features/auth-ssr.ts)
- Dashboard read-model change: [../../apps/api/src/routes/dashboard/routes/summary.ts](../../apps/api/src/routes/dashboard/routes/summary.ts), [../../apps/api/src/routes/dashboard/routes/transactions.ts](../../apps/api/src/routes/dashboard/routes/transactions.ts), [../../apps/web/src/features/dashboard-query-options.ts](../../apps/web/src/features/dashboard-query-options.ts)
- Powens flow change: [../../apps/api/src/routes/integrations/powens/runtime.ts](../../apps/api/src/routes/integrations/powens/runtime.ts), [../../apps/api/src/routes/integrations/powens/routes/callback.ts](../../apps/api/src/routes/integrations/powens/routes/callback.ts), [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx), [../../apps/worker/src/index.ts](../../apps/worker/src/index.ts)
- Release or deploy change: [release-map.md](release-map.md)
