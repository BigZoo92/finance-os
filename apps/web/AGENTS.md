# AGENTS.md - apps/web

Scope: `apps/web/**`

## Local Rules

- Stay loader-first. Route-critical data belongs in loaders and should prewarm Query with `ensureQueryData` or `ensureInfiniteQueryData`.
- Keep auth SSR-consistent: prefetch `/auth/me`, avoid demo-to-admin flashes, and fall back to demo instead of crashing SSR when auth is unavailable.
- Keep server state in Query options under `src/features/**`; do not mirror server state into local component state.
- Keep dashboard goals in [src/features/goals/query-options.ts](src/features/goals/query-options.ts) and route admin writes through the feature API helpers so `x-request-id`, safe error normalization, and admin gating stay consistent.
- Keep dashboard budget/objective/projection/alert conventions aligned with the existing card modules:
  - category budgets stay in [src/components/dashboard/monthly-category-budgets-card.tsx](src/components/dashboard/monthly-category-budgets-card.tsx) with deterministic demo read-only behavior and admin-only edits.
  - personal objectives stay in [src/components/dashboard/personal-financial-goals-card.tsx](src/components/dashboard/personal-financial-goals-card.tsx) with safe local persistence and explicit non-blocking alert copy.
  - month-end projections stay in [src/components/dashboard/month-end-projection-card.tsx](src/components/dashboard/month-end-projection-card.tsx) as informative calculations that never trigger hidden writes or provider calls.
  - alert copy must remain fail-soft and action-guiding (informative in demo, actionable in admin) without implying hard-blocking errors.
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
- Keep PWA/offline/cache/notification/export conventions explicit and aligned with the personal-cockpit scope:
  - PWA installability stays progressive enhancement only; do not make core dashboard workflows depend on install prompts or service-worker-only features.
  - Offline behavior must stay fail-soft and deterministic in demo mode: use cached/read-only placeholders with explicit stale copy, and never introduce hidden DB/provider writes while offline.
  - Cache strategy should prefer predictable dashboard reads (stale-while-revalidate semantics where available) and must surface freshness metadata when values can be stale.
  - Push notification UX remains strictly opt-in, admin-gated, and kill-switch aware; demo mode must keep deterministic mock states with no real subscription or delivery side effects.
  - Export/report features must keep privacy-by-design defaults (no secrets, no raw provider tokens, explicit user intent before file generation) and preserve readable fallback messaging when generation fails.
  - Shared UI/API export barrels must remain intentional: when adding/removing exports, update the nearest index barrel and verify consumer imports to prevent accidental public-surface drift.
  - Desktop strategy is deferred by design: prioritize responsive mobile/tablet-first web quality now, and document desktop-shell assumptions as future work instead of coupling current features to Electron/native packaging decisions.
- Keep AI advisor context assembly, retrieval, and rendering conventions stable in [src/components/dashboard/ai-advisor-panel.tsx](src/components/dashboard/ai-advisor-panel.tsx) and [src/features/dashboard-query-options.ts](src/features/dashboard-query-options.ts):
  - context must be deterministic in demo mode and sourced only from loader/query contracts; never add hidden provider calls or side-effect writes.
  - retrieval must stay read-only (`GET /dashboard/advisor`) with explicit fail-soft fallback copy when live/admin data is delayed or unavailable.
  - citation chips/links must only reference data present in the advisor payload; avoid synthetic sources that cannot be traced to contract fields.
  - redact or omit sensitive values in advisor UI text (tokens, callback codes, account identifiers) and keep request-id-safe logging assumptions intact.
  - cost guardrails are mandatory: keep expensive generation behind existing API/runtime flags and preserve deterministic local insights when AI advisor runtime toggles are off.
- Keep dashboard filters in URL search params. Do not introduce duplicate local filter state for route-owned data.
- Route all API calls through [src/lib/api.ts](src/lib/api.ts) so SSR cookie forwarding, `x-request-id`, and `/api` compatibility behavior stay consistent.
- Read non-sensitive web runtime config through [src/lib/public-runtime-env.ts](src/lib/public-runtime-env.ts) so SSR can inject safe `VITE_*` values at runtime without exposing secrets or hard-freezing them at build time, including dashboard health/reconnect kill-switches such as `VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED`, `VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED`, `VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED`, and `VITE_UI_RECONNECT_BANNER_ENABLED`.
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
