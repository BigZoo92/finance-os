# AGENTS.md - apps/web

Scope: `apps/web/**`

## Local Rules

- Stay loader-first. Route-critical data belongs in loaders and should prewarm Query with `ensureQueryData` or `ensureInfiniteQueryData`.
- Keep auth SSR-consistent: prefetch `/auth/me`, avoid demo-to-admin flashes, and fall back to demo instead of crashing SSR when auth is unavailable.
- Keep server state in Query options under `src/features/**`; do not mirror server state into local component state.
- Keep dashboard goals in [src/features/goals/query-options.ts](src/features/goals/query-options.ts) and route admin writes through the feature API helpers so `x-request-id`, safe error normalization, and admin gating stay consistent.
- Keep dashboard derived recompute status and trigger behavior in the shared dashboard feature helpers so admin gating, retry-safe errors, and demo mocks stay consistent with the API contract.
- Keep dashboard health signals in [src/components/dashboard/dashboard-health.ts](src/components/dashboard/dashboard-health.ts) and [src/components/dashboard/dashboard-health-panel.tsx](src/components/dashboard/dashboard-health-panel.tsx); demo must stay deterministic from the fixture matrix, admin must derive one global summary plus selective widget badges from loader/query data only.
- Keep the Powens manual sync cooldown UI in [src/features/powens/manual-sync-cooldown.ts](src/features/powens/manual-sync-cooldown.ts) as client-only state behind runtime-safe `VITE_*` config; it must never become authoritative or weaken demo/admin gating.
- Keep Powens connection badges driven by [src/features/powens/sync-status.ts](src/features/powens/sync-status.ts): admin should prefer the persisted last-sync snapshot from `/integrations/powens/status`, fall back to runtime status when `SYNC_STATUS_PERSISTENCE_ENABLED=false`, and keep demo deterministic without DB/provider writes.
- Keep Powens state semantics explicit and fail-soft in UI copy and mappings:
  - Runtime connection states from `PowensConnectionStatus.status` are `connected`, `syncing`, `error`, `reconnect_required`.
  - Persisted sync snapshot from `/integrations/powens/status` is `lastSyncStatus: OK|KO` with reason codes `SUCCESS`, `PARTIAL_IMPORT`, `SYNC_FAILED`, `RECONNECT_REQUIRED`.
  - `syncing` must stay visually distinct from persisted KO/OK snapshots so users can tell "in-flight" from "last known result".
  - When persistence is disabled or unavailable, degrade gracefully to runtime-only badges (`connected => OK`, `error|reconnect_required => KO`) and avoid blank/blocked dashboard states.
  - In safe-mode fallback (`safeModeActive=true` and/or response `fallback: safe_mode`), keep the dashboard usable with clear non-blocking messaging instead of action-breaking hard errors.
- Keep dashboard filters in URL search params. Do not introduce duplicate local filter state for route-owned data.
- Route all API calls through [src/lib/api.ts](src/lib/api.ts) so SSR cookie forwarding, `x-request-id`, and `/api` compatibility behavior stay consistent.
- Read non-sensitive web runtime config through [src/lib/public-runtime-env.ts](src/lib/public-runtime-env.ts) so SSR can inject safe `VITE_*` values at runtime without exposing secrets or hard-freezing them at build time, including dashboard health kill-switches such as `VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED`, `VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED`, and `VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED`.
- Keep public `GET /health`, legacy `GET /healthz`, and `GET /version` aligned with the shared system contract used by api and worker, including runtime flags such as `safeModeActive`.
- UI work must cover loading, empty, error, and success states. Avoid generic equal-card layouts when touching dashboard surfaces such as [src/components/dashboard/app-shell.tsx](src/components/dashboard/app-shell.tsx).

## Verify

- `pnpm web:typecheck`
- `pnpm web:test`
- `pnpm web:build`

## Pitfalls

- Avoid `useEffect` request orchestration for route data.
- Do not bypass shared query options in [src/features/auth-query-options.ts](src/features/auth-query-options.ts), [src/features/dashboard-query-options.ts](src/features/dashboard-query-options.ts), [src/features/goals/query-options.ts](src/features/goals/query-options.ts), or [src/features/powens/query-options.ts](src/features/powens/query-options.ts).
- Do not read non-sensitive runtime `VITE_*` values directly from `import.meta.env` in app code when they must remain runtime-overridable in production; use [src/lib/public-runtime-env.ts](src/lib/public-runtime-env.ts) instead.
- When UI behavior changes, update [../../docs/agentic/ui-quality-map.md](../../docs/agentic/ui-quality-map.md) if the guidance or entry points changed.
