# Contracts Map (Deprecated)

This map moved to [contracts-canonical.md](./contracts-canonical.md). Keep this page as a compatibility redirect for one release cycle.

## Required API Contracts

- Canonical contract template and dual-path requirements: [contracts-canonical.md](./contracts-canonical.md)
- Auth contract route: [../../apps/api/src/auth/routes.ts](../../apps/api/src/auth/routes.ts)
- Dashboard summary contract route: [../../apps/api/src/routes/dashboard/routes/summary.ts](../../apps/api/src/routes/dashboard/routes/summary.ts)
- Dashboard transactions contract route: [../../apps/api/src/routes/dashboard/routes/transactions.ts](../../apps/api/src/routes/dashboard/routes/transactions.ts)

## Route Protection and Compatibility

- API entry and route registration: [../../apps/api/src/index.ts](../../apps/api/src/index.ts)
- Web API client compatibility behavior: [../../apps/web/src/lib/api.ts](../../apps/web/src/lib/api.ts)
- Web auth consumer: [../../apps/web/src/features/auth-query-options.ts](../../apps/web/src/features/auth-query-options.ts)
- Web dashboard consumer: [../../apps/web/src/features/dashboard-query-options.ts](../../apps/web/src/features/dashboard-query-options.ts)

## Powens Flow Contracts

- Powens router: [../../apps/api/src/routes/integrations/powens/router.ts](../../apps/api/src/routes/integrations/powens/router.ts)
- Powens callback route: [../../apps/api/src/routes/integrations/powens/routes/callback.ts](../../apps/api/src/routes/integrations/powens/routes/callback.ts)
- Powens callback UI: [../../apps/web/src/routes/powens/callback.tsx](../../apps/web/src/routes/powens/callback.tsx)
- Worker sync orchestrator: [../../apps/worker/src/index.ts](../../apps/worker/src/index.ts)

## Manual Contract Checks

Follow the canonical verification and fail-soft checklist in [contracts-canonical.md](./contracts-canonical.md) and [testing-canonical.md](./testing-canonical.md).
