# Architecture Map (Deprecated)

This map moved to [architecture-canonical.md](./architecture-canonical.md). Keep this page as a compatibility redirect for one release cycle.

## Runtime Entry Points

- Canonical runtime topology: [architecture-canonical.md](./architecture-canonical.md)
- API runtime: [../../apps/api/src/index.ts](../../apps/api/src/index.ts)
- Web runtime: [../../apps/web/src/routes/__root.tsx](../../apps/web/src/routes/__root.tsx)
- Worker runtime: [../../apps/worker/src/index.ts](../../apps/worker/src/index.ts)
- Desktop runtime: [../../apps/desktop/src-tauri/src/main.rs](../../apps/desktop/src-tauri/src/main.rs)

## Package Anchors

- DB package: [../../packages/db/src/index.ts](../../packages/db/src/index.ts)
- Env package: [../../packages/env/src/index.ts](../../packages/env/src/index.ts)
- Powens package: [../../packages/powens/src/client.ts](../../packages/powens/src/client.ts)
- Redis package: [../../packages/redis/src/index.ts](../../packages/redis/src/index.ts)

## Layering Expectations

See the authoritative layering, dual-path, observability, and state-matrix template in [architecture-canonical.md](./architecture-canonical.md).

## First Reads By Change Type

- Auth/runtime changes: [../../apps/api/src/auth/routes.ts](../../apps/api/src/auth/routes.ts)
- Dashboard data changes: [../../apps/api/src/routes/dashboard/router.ts](../../apps/api/src/routes/dashboard/router.ts)
- Powens flow changes: [../../apps/api/src/routes/integrations/powens/router.ts](../../apps/api/src/routes/integrations/powens/router.ts)
- Release-sensitive topology changes: [release-canonical.md](./release-canonical.md)
