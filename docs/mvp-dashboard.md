# MVP Dashboard (daily driver)

Last updated: 2026-02-24.

## Goal

Ship a stable private dashboard for personal daily use:

- global wealth view (Fortuneo + Revolut via Powens)
- last transactions with quick ranges
- incomes/expenses and top groups
- connection state and manual sync trigger

All dashboard reads are DB-first (no direct Powens calls from web).

## Architecture

### Read model endpoints (API)

- `GET /dashboard/summary?range=7d|30d|90d`
  - total balance
  - per-connection balances
  - per-account balances
  - incomes/expenses in range
  - top 5 expense groups (category fallback: `Unknown - <merchant>`)
- `GET /dashboard/transactions?range=7d|30d|90d&limit=30&cursor=...`
  - cursor pagination (`bookingDate|id`)
  - sorted by `booking_date desc, id desc`

### Status and sync endpoints

- `GET /integrations/powens/status`
  - status (`connected|syncing|error|reconnect_required`)
  - last sync / last success / last error
- `POST /integrations/powens/sync`
  - enqueues sync job only
  - manual sync rate-limited (default 5 minutes)

### Debug metrics endpoint

- `GET /debug/metrics`
  - `syncCountToday`
  - `powensCallsToday`
  - `lastSync` timestamps and result
  - connection statuses from DB
  - protected by private access + optional debug token

## Frontend data strategy (TanStack Start + Query)

- Route `/` loader prefetches:
  - auth mode (`GET /auth/me`)
  - dashboard summary
  - first transactions page
  - Powens status
- Router uses SSR Query dehydration/hydration so auth state is deterministic on first render.
- Query owns remote state:
  - auth query (`auth.me`)
  - summary query by `range`
  - infinite transactions query by `range` + `limit`
  - Powens status query
- Mutations:
  - `Sync now` invalidates `powens.status` + `dashboard.*`
  - callback sync invalidates same keys
- No `useEffect` request orchestration.
- UI never defaults to "demo" while auth is unresolved; it shows a neutral pending state.

## Security and private mode

- Web:
  - `meta robots: noindex, nofollow, noarchive`
  - `robots.txt` disallow all
- API:
  - `X-Robots-Tag: noindex, nofollow, noarchive`
  - optional internal token gate (`x-internal-token` / `Authorization: Bearer`)
  - `GET /auth/me` responses are `Cache-Control: no-store`
  - in development, auth endpoints (`/auth/login`, `/auth/logout`, `/auth/me`) are reachable even when private gate is enabled

## Guardrails (cost and stability)

- Worker scheduler:
  - in production, auto-sync interval cannot be below 12h
- Manual sync:
  - global cooldown enforced by Redis (default 300s)
- Metrics:
  - daily sync counter
  - daily Powens API calls counter
  - last sync started/ended metadata

## Env variables

Added/used by this MVP:

- `PRIVATE_ACCESS_TOKEN` (optional)
- `AUTH_ADMIN_EMAIL`
- `AUTH_PASSWORD_HASH_B64` (recommended)
- `AUTH_PASSWORD_HASH` (legacy fallback)
- `AUTH_SESSION_SECRET`
- `AUTH_SESSION_TTL_DAYS`
- `AUTH_LOGIN_RATE_LIMIT_PER_MIN`
- `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` (default: `300`)
- `POWENS_SYNC_MIN_INTERVAL_PROD_MS` (default: `43200000`)
- `VITE_API_BASE_URL` (recommended: `/api`)
- `PRIVATE_ACCESS_TOKEN` (optional, web SSR + api runtime)

## Notes for next step (Trade Republic)

- Keep using provider-agnostic read-model shape (`connection`, `account`, `transaction`).
- Add new provider ingestion in worker/API without changing web query contracts.
- Reuse dashboard endpoints and UI sections as-is.
