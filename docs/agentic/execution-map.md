# Execution Map

This map is a fast path for agents and reviewers to understand how runtime behavior flows across `apps/web`, `apps/api`, `apps/worker`, and shared packages.

## Runtime Entry Flows

### 1) Dashboard read path (demo/admin split)

1. Browser requests dashboard route in `apps/web` route loaders.
2. Web route calls internal `/api/dashboard/*` endpoint via server-side proxy.
3. API route resolves mode (`demo` default; `admin` with valid session/internal state).
4. Domain service selects adapter:
   - `demoAdapter` uses deterministic mock fixtures only.
   - `adminAdapter` reads DB/providers with fail-soft guards.
5. API emits structured telemetry with `x-request-id` propagation and safe errors.
6. Web renders either full data, degraded widget fallback, or empty-state copy.

### 2) Powens connect + callback path

1. Admin user starts connect flow from web integration page.
2. API `/integrations/powens/connect-url` creates provider URL and state.
3. Provider callback hits API callback route.
4. Callback validation enforces signed state + admin/session checks.
5. Sensitive tokens are encrypted at rest and never logged.
6. Audit-trail and sync queues are updated; UI reads status with fallback messaging.

### 3) Worker sync execution path

1. Worker consumes sync job from Redis queue (BLPOP/lock discipline).
2. Worker fetches provider payloads and normalizes data contracts.
3. Batch upserts persist into DB repositories with integrity checks.
4. Worker emits structured logs/metrics with request correlation where present.
5. Failures retry safely and preserve app usability in admin surfaces.

## Canonical Ownership

- **Route and contract source-of-truth:** `docs/agentic/contracts-map.md`
- **Architecture anchors and package boundaries:** `docs/agentic/architecture-map.md`
- **Verification entrypoints:** `docs/agentic/testing-map.md`
- **Deploy + smoke behavior:** `docs/agentic/release-map.md`

## Foundation Audit Checklist (quick)

Use this list before merge when touching auth, routes, providers, or observability:

- Demo path remains deterministic, mock-backed, and DB/provider-free.
- Admin path remains explicitly gated and fail-soft.
- `x-request-id` propagation is preserved end-to-end.
- Error/log payloads stay normalized and secret-safe.
- Any route topology/proxy change is reflected in smoke checks and release docs.
- Behavior changes are backed by the smallest relevant automated verification.

## Suggested Verification Commands

Run from repo root, smallest-to-broader:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm check:ci`
- `node .agents/skills/scripts/validate-agent-foundation.mjs` (required when agentic docs/rules change)
