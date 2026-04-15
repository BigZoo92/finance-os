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
- Keep the news experience (`/_app/actualites`, `news-feed.tsx`, `dashboard-query-options.ts`, `dashboard-api.ts`, demo fixtures, client fallback behavior, provider health, clusters, and context preview) aligned with [../../docs/context/NEWS-FETCH.md](../../docs/context/NEWS-FETCH.md), and update that document whenever this feature changes.
- Keep the markets experience (`/_app/marches`, `src/components/markets/*`, `src/features/markets/*`, demo fixtures, source/freshness badges, D3 visuals, and refresh affordances) aligned with [../../docs/context/MARKETS-MACRO.md](../../docs/context/MARKETS-MACRO.md); demo must stay deterministic, admin reads must stay snapshot-first, and the UI must never imply fake real-time precision.
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
  - retrieval must stay read-only (`GET /dashboard/advisor*`) with explicit fail-soft fallback copy when live/admin data is delayed or unavailable.
  - citation chips/links must only reference data present in the advisor payload; avoid synthetic sources that cannot be traced to contract fields.
  - redact or omit sensitive values in advisor UI text (tokens, callback codes, account identifiers) and keep request-id-safe logging assumptions intact.
  - cost guardrails are mandatory: keep expensive generation behind existing API/runtime flags and preserve deterministic local insights when AI advisor runtime toggles are off.
  - the `/actualites` advisor surface must cover daily brief, recommendations, signals, assumptions, spend analytics, run history, chat, manual full-mission status, and evals with coherent loading/degraded/error/admin-only states.
- Keep the `/patrimoine` manual-assets surface admin-only, backed by `/dashboard/manual-assets`, with a clear empty state and no hardcoded admin asset injection.
- Keep dashboard filters in URL search params. Do not introduce duplicate local filter state for route-owned data.
- Route all API calls through [src/lib/api.ts](src/lib/api.ts) so SSR cookie forwarding, `x-request-id`, and `/api` compatibility behavior stay consistent.
- Read non-sensitive web runtime config through [src/lib/public-runtime-env.ts](src/lib/public-runtime-env.ts) so SSR can inject safe `VITE_*` values at runtime without exposing secrets or hard-freezing them at build time, including dashboard health/reconnect kill-switches such as `VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED`, `VITE_DASHBOARD_HEALTH_GLOBAL_INDICATOR_ENABLED`, `VITE_DASHBOARD_HEALTH_WIDGET_BADGES_ENABLED`, and `VITE_UI_RECONNECT_BANNER_ENABLED`.
- Keep public `GET /health`, legacy `GET /healthz`, and `GET /version` aligned with the shared system contract used by api and worker, including runtime flags such as `safeModeActive`.
- UI work must cover loading, empty, error, and success states. Avoid generic equal-card layouts when touching dashboard surfaces.
- **App shell and navigation**: The app uses a pathless layout route `_app.tsx` that wraps all authenticated pages with a sidebar (desktop) / bottom nav (mobile). All new pages go under `src/routes/_app/`. System routes (`/login`, `/health`, `/powens/callback`) stay outside the shell at the top level.
- **Multi-page architecture**: The monolithic `app-shell.tsx` is superseded by dedicated pages under `_app/`:
  - `/` (cockpit) — KPIs, wealth trend, top dépenses, connexions, objectifs
  - `/depenses` — transactions, budgets, projections, structure dépenses
  - `/patrimoine` — actifs, historique patrimoine, soldes par connexion
  - `/investissements` — positions, valorisation
  - `/marches` — panorama marche, macro, watchlist mondiale, signaux
  - `/objectifs` — objectifs financiers (CRUD)
  - `/actualites` — news feed, IA advisor
  - `/integrations` — connexions Powens, sync runs, diagnostics, audit trail
  - `/sante` — vue consolidée de l'état système
  - `/parametres` — notifications push, derived recompute, exports
- **Design system compliance**: Always use tokens from `packages/ui/src/styles/globals.css` and patterns from `docs/frontend/design-system.md`. Financial amounts use `.font-financial`. Colors use semantic tokens (`positive`, `negative`, `warning`). Surface depth uses `surface-0/1/2`.
- **Sidebar navigation**: The navigation items are defined in `NAV_ITEMS` in `src/components/shell/nav-items.ts`. When adding/removing pages, update the route file, `nav-items.ts`, and the command palette `PAGES` in `src/components/shell/command-palette.tsx`. Nav is split into `main` (finances) and `system` sections.
- **Motion conventions**: Follow `docs/frontend/motion-and-interactions.md`. CSS transitions first, `motion` library only when needed. Use token durations/easing, not hardcoded values. Page transitions use `AnimatePresence` in `_app.tsx`.
- **Charts**: Use D3.js for all data visualization. `src/components/ui/d3-sparkline.tsx` provides `D3Sparkline` (interactive) and `MiniSparkline` (inline). Do not add Recharts, Victory, or similar heavy chart libraries.
- **ASCII identity**: Use `src/components/ui/ascii-brand.tsx` for visual accents. Never overuse — ASCII serves the interface, not the other way around.
- **Command palette**: `Cmd+K` opens the command palette (`src/components/shell/command-palette.tsx`). When adding a new page, add it to `PAGES` in this file.
- **Theme toggle**: Dark/light mode toggle in topbar with localStorage persistence. Theme is managed by `src/components/shell/theme-toggle.tsx`.
- **Shared formatting**: Use `src/lib/format.ts` for date/money/number formatting. Use `src/lib/export.ts` for CSV/PDF export utilities. Do not duplicate.

## Verify

- `pnpm web:typecheck`
- `pnpm web:test`
- `pnpm web:build`

## Pitfalls

- Avoid `useEffect` request orchestration for route data.
- Do not bypass shared query options in [src/features/auth-query-options.ts](src/features/auth-query-options.ts), [src/features/dashboard-query-options.ts](src/features/dashboard-query-options.ts), [src/features/markets/query-options.ts](src/features/markets/query-options.ts), [src/features/goals/query-options.ts](src/features/goals/query-options.ts), or [src/features/powens/query-options.ts](src/features/powens/query-options.ts).
- Do not read non-sensitive runtime `VITE_*` values directly from `import.meta.env` in app code when they must remain runtime-overridable in production; use [src/lib/public-runtime-env.ts](src/lib/public-runtime-env.ts) instead.
- When UI behavior changes, update [../../docs/agentic/ui-quality-map.md](../../docs/agentic/ui-quality-map.md) if the guidance or entry points changed.
