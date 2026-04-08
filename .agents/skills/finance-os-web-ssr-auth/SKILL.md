---
name: finance-os-web-ssr-auth
description: "SSR authentication, hydration, and mode-switching patterns for TanStack Start. Use when working on auth flows, route loaders, SSR/client coherence, or demo/admin transitions."
---

# Finance-OS Web SSR & Auth

## When to use
- Modifying route loaders or `beforeLoad` hooks
- Working on auth flows (login, session, cookie handling)
- Debugging SSR/client hydration mismatches
- Adding new protected routes
- Fixing demo-to-admin transition flashes

## When NOT to use
- API-only changes with no SSR implications
- Worker or background job work
- Pure styling changes

---

## 1. Root Loader Auth Prefetch

The root loader (`__root.tsx`) prefetches `/auth/me` on every SSR request. This ensures auth state is available before any child route renders.

```typescript
// Root loader pattern
beforeLoad: async ({ context }) => {
  // Prefetch auth — determines demo vs admin for all child routes
  await context.queryClient.ensureQueryData(authMeQueryOptions());
}
```

**Rules**:
- `/auth/me` is the single source of truth for auth state
- If SSR prefetch fails → fallback to demo mode (never show error page)
- Auth state flows down through router context, not global state

---

## 2. Mode-Aware Query Options

Every data-fetching query uses separate options for demo and admin modes:

```typescript
// Pattern: mode-aware query factory
export const dashboardQueryOptions = (mode: AppMode, range: string) =>
  mode === 'admin'
    ? { queryKey: ['dashboard', range], queryFn: () => apiFetch('/dashboard/summary', { range }) }
    : { queryKey: ['dashboard', 'demo', range], queryFn: () => mockDashboardSummary(range) };
```

**Rules**:
- Query keys MUST differ between demo and admin (prevents cache poisoning)
- Demo queries never call `apiFetch` — they return mock data synchronously
- `staleTime: 0` by default (conservative freshness)

---

## 3. No Flash on Mode Transition

When switching between demo and admin (login/logout), the UI must not flash stale content.

**Pattern**:
1. On login success: invalidate all queries, redirect to dashboard
2. On logout: clear query cache entirely, redirect to demo dashboard
3. Never show admin data with demo layout or vice versa

```typescript
// After login
queryClient.clear(); // wipe demo cache
router.navigate({ to: '/dashboard' });

// After logout
queryClient.clear(); // wipe admin cache
router.navigate({ to: '/dashboard' });
```

---

## 4. SSR Failure Fallback

If SSR fails (API unreachable, timeout), the app must degrade to demo mode — never show a blank page or error screen.

```typescript
// In root loader error handling
beforeLoad: async ({ context }) => {
  try {
    await context.queryClient.ensureQueryData(authMeQueryOptions());
  } catch {
    // SSR failed — degrade to demo mode silently
    context.queryClient.setQueryData(['auth', 'me'], { mode: 'demo' });
  }
}
```

---

## 5. API Client URL Resolution

`apiFetch()` handles URL resolution differently based on context:

| Context | URL base | Why |
|---|---|---|
| Client (browser) | `VITE_API_BASE_URL` or `/api` (proxy) | Browser requests |
| SSR (server) | `API_INTERNAL_URL` | Direct server-to-server, skip proxy |
| Fallback | `/api` relative | Safe default if env missing |

**Rules**:
- Never hardcode API URLs
- SSR requests use internal URL (faster, no TLS overhead)
- Client requests go through the web proxy (`/api/*` → `API_INTERNAL_URL`)

---

## 6. Route Protection

```typescript
// Protected admin route
export const Route = createFileRoute('/dashboard/goals')({
  beforeLoad: ({ context }) => {
    if (context.auth.mode !== 'admin') {
      throw redirect({ to: '/dashboard' }); // bounce to demo dashboard
    }
  },
});
```

**Rules**:
- Admin-only routes redirect to demo dashboard, never show "unauthorized"
- Demo routes are always accessible
- Route guards live in `beforeLoad`, not in components

---

## 7. Hydration Coherence

SSR and client must render identical initial HTML. Mismatches cause React hydration errors.

**Common causes**:
- Using `Date.now()` or `Math.random()` in render
- Reading `localStorage` during SSR (doesn't exist server-side)
- Different auth state between SSR and client first render

**Prevention**:
- Auth state comes from query cache (populated by SSR loader)
- Time-dependent values use server-provided timestamps
- Browser-only APIs are guarded with `typeof window !== 'undefined'`

## Common Mistakes

1. **Querying API in demo mode** — demo queries must use mocks, never `apiFetch`
2. **Same query key for demo and admin** — causes cache poisoning on mode switch
3. **Not clearing cache on login/logout** — shows stale data from wrong mode
4. **Accessing `window` in SSR** — crashes server-side render
5. **Hardcoding API URL** — breaks SSR which needs internal URL

## References
- [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md) — apps/web section
- [CONVENTIONS.md](docs/context/CONVENTIONS.md) — frontend conventions
- [FEATURES.md](docs/context/FEATURES.md) — authentication feature
