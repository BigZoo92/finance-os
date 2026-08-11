---
name: finance-os-web-auth
description: Preserve TanStack Start SSR authentication and demo/admin hydration behavior. Use for root loaders, auth queries, login/logout, protected routes, API URL resolution, or SSR cache changes in apps/web.
---

# Web SSR and auth

Read `apps/web/AGENTS.md` and inspect the current flow before assuming a TanStack pattern.

## Sources to trace

- `apps/web/src/routes/__root.tsx`
- `apps/web/src/features/auth-query-options.ts`
- `apps/web/src/features/auth-ssr.ts`
- `apps/web/src/lib/api.ts`
- `apps/web/src/routes/login.tsx`
- `apps/api/src/auth/`

## Invariants

- `/auth/me` is the mode source of truth; an unavailable unauthenticated path degrades to demo rather than blank SSR.
- Server requests use `API_INTERNAL_URL`; browser requests use the web `/api` proxy. Do not hardcode hosts.
- Forward cookies and `x-request-id` on SSR calls without exposing internal tokens to the browser.
- Derive query keys, caching, and refetch policy from the current query factories. Do not impose a universal `staleTime` or duplicate mode key convention.
- Login/logout must invalidate or clear data that could cross the demo/admin boundary before navigation.
- Route redirects belong in route loaders or `beforeLoad`; components render already-resolved mode state.
- Initial SSR and client renders must agree. Keep time, randomness, storage, and browser globals out of unguarded render paths.

## Verification

Cover authenticated SSR, demo fallback, internal URL resolution, cookie forwarding, request IDs, and the first hydrated render. Start with `apps/web/src/features/auth-ssr.test.ts` and `apps/web/src/lib/api.test.ts`.
