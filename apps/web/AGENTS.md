# Web instructions

Scope: `apps/web/**`.

- Stay loader-first: route-critical server state prewarms TanStack Query through feature query factories.
- `/auth/me` resolves mode consistently across SSR and hydration; auth failure degrades to demo without admin-data flash.
- Route API calls through `src/lib/api.ts`; SSR uses `API_INTERNAL_URL`, browsers use `/api`, and request IDs/cookies stay server-safe.
- Keep route-owned filters in URL search params and server state in Query, not mirrored local state/effects.
- Read safe runtime `VITE_*` values through `src/lib/public-runtime-env.ts`; never introduce browser secrets.
- Demo fixtures are deterministic and provider/DB-free. Admin mutations are explicit, guarded, invalidate affected queries, and expose safe retry states.
- IBKR/Binance UI is status-and-sync only; no credential types, masked references, forms, or credential mutations.
- Read `DESIGN.md`; use existing tokens/surfaces, `.font-financial`, semantic signal colors, complete states, responsive/accessibility behavior, and reduced motion.
- Navigation lives in `src/components/shell/nav-items.ts`; the command palette derives from it. New shell pages belong under `src/routes/_app/`.
- Use the current D3 components for charts; do not add a competing chart/UI system.

Update `docs/product.md` for route structure and `docs/integrations.md` for news/provider behavior.

Verify with `pnpm web:test`, `pnpm web:typecheck`, and `pnpm web:build`; use Playwright for changed user flows.
