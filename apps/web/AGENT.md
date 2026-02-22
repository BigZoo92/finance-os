# AGENT.md - `apps/web`

Last updated: 2026-02-22.

This file defines implementation rules for the web workspace.

## 1) Stack and architectural intent

- Framework/runtime: TanStack Start.
- Routing: TanStack Router (file-based routes).
- Remote state: TanStack Query.
- Shared UI: `@finance-os/ui`.

## 2) Data flow rules

- Route-critical fetches should be done in route loaders.
- Prefer `context.queryClient.ensureQueryData(...)` inside loaders.
- Use `ensureInfiniteQueryData(...)` for paginated/infinite dashboard lists when needed.
- UI components consume data through `useQuery`/`useSuspenseQuery`.
- Writes use `useMutation` and must invalidate affected query keys.
- Keep query keys centralized in feature modules.

## 3) React anti-pattern rules

- Avoid `useEffect` and `useState` for remote data loading, syncing, and callback orchestration.
- Prefer loader/query/mutation patterns.
- Use local state only for strictly local ephemeral UI concerns.

## 4) Powens frontend architecture

### 4.1 Dashboard status flow

- Query options live under `src/features/powens/query-options.ts`.
- API functions live under `src/features/powens/api.ts`.
- Dashboard read-model query options live under `src/features/dashboard-query-options.ts`.
- Dashboard API functions live under `src/features/dashboard-api.ts`.
- Route `/` owns range through search params (`7d|30d|90d`) and loader deps.
- Manual sync mutation invalidates Powens + dashboard query keys.

### 4.2 Callback flow

- Callback route parses `connection_id` and `code` via `validateSearch`.
- Route loader posts callback payload to API.
- Component renders loader result and exposes sync mutation action.
- No callback orchestration with `useEffect`/`useRef`.

### 4.3 Private mode and indexing

- Keep private deployment non-indexed:
- `meta` robots noindex
- `public/robots.txt` disallow all
- If API private token mode is enabled, web API fetch must send `x-finance-os-access-token`.

## 5) Route file rules

- Never edit generated `src/routeTree.gen.ts` manually.
- Keep route files focused on route concerns; move reusable fetch logic to feature modules.

## 6) Validation expectations

For web changes run:

- `pnpm --filter @finance-os/web test`
- `pnpm web:build`

If API contracts were touched, also run:

- `pnpm api:typecheck`
