# AGENTS.md - apps/web

Scope: `apps/web/**`

## Local Rules

- Stay loader-first. Route-critical data belongs in loaders and should prewarm Query with `ensureQueryData` or `ensureInfiniteQueryData`.
- Keep auth SSR-consistent: prefetch `/auth/me`, avoid demo-to-admin flashes, and fall back to demo instead of crashing SSR when auth is unavailable.
- Keep server state in Query options under `src/features/**`; do not mirror server state into local component state.
- Keep dashboard filters in URL search params. Do not introduce duplicate local filter state for route-owned data.
- Route all API calls through [src/lib/api.ts](src/lib/api.ts) so SSR cookie forwarding, `x-request-id`, and `/api` compatibility behavior stay consistent.
- UI work must cover loading, empty, error, and success states. Avoid generic equal-card layouts when touching dashboard surfaces such as [src/components/dashboard/app-shell.tsx](src/components/dashboard/app-shell.tsx).

## Verify

- `pnpm web:typecheck`
- `pnpm web:test`
- `pnpm web:build`

## Pitfalls

- Avoid `useEffect` request orchestration for route data.
- Do not bypass shared query options in [src/features/auth-query-options.ts](src/features/auth-query-options.ts), [src/features/dashboard-query-options.ts](src/features/dashboard-query-options.ts), or [src/features/powens/query-options.ts](src/features/powens/query-options.ts).
- When UI behavior changes, update [../../docs/agentic/ui-quality-map.md](../../docs/agentic/ui-quality-map.md) if the guidance or entry points changed.
