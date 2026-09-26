# API instructions

Scope: `apps/api/**`.

- `src/index.ts` is the composition root. Preserve bare and `/api` compatibility mounts, startup route assertions, request IDs, `/health`, and `/version`.
- Routes own HTTP parsing/status/shape; domain code owns orchestration; repositories own persistence; services own providers/deterministic helpers; runtime/plugin files wire them.
- Dashboard bounded modules live in `src/routes/dashboard/domain/<module>/` (advisor, data-quality, trading-lab, valuation) and are entered only through their `index.ts` barrel; domain code imports repositories as types only; HTTP route modules receive repositories from the runtime composition root instead of building them; `types.ts` reaches the domain as types only. `architecture-boundaries.test.ts` enforces these rules, and `DashboardUseCases` is the intersection of per-module slices (`DashboardCoreUseCases`, `DashboardAdvisorUseCases`, ...): add new use cases to the slice that owns them.
- Demo short-circuits before DB, Redis, provider, model, or write work. `/auth/me` remains DB/provider-free, `200`, and `no-store`.
- Cookie-auth mutations keep same-origin protection; worker/internal mutations require the current internal-token guard.
- Powens callback accepts admin or valid signed state, respects safe mode, and never logs codes/tokens.
- External-investment routes expose configuration/health/data only—never credentials or mutation capabilities.
- Advisor/news/markets GET routes read local normalized/cache state; live refresh stays on guarded POST/worker paths and fails soft.
- Keep errors normalized and logs structured through `src/observability/`.

Update `docs/integrations.md`, `docs/advisor.md`, or `docs/operations.md` only when their durable contract changes.

Verify with the changed Bun tests, `pnpm api:typecheck`, and `pnpm smoke:api` for route/proxy/auth topology.
