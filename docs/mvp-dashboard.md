# MVP Dashboard (daily driver)

Last updated: 2026-02-22.

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
  - dashboard summary
  - first transactions page
  - Powens status
- Query owns remote state:
  - summary query by `range`
  - infinite transactions query by `range` + `limit`
  - Powens status query
- Mutations:
  - `Sync now` invalidates `powens.status` + `dashboard.*`
  - callback sync invalidates same keys
- No `useEffect` request orchestration.

## Security and private mode

- Web:
  - `meta robots: noindex, nofollow, noarchive`
  - `robots.txt` disallow all
- API:
  - `X-Robots-Tag: noindex, nofollow, noarchive`
  - optional private header gate (`x-finance-os-access-token`)
  - optional debug token gate (`x-finance-os-debug-token`)

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
- `DEBUG_METRICS_TOKEN` (optional)
- `POWENS_MANUAL_SYNC_COOLDOWN_SECONDS` (default: `300`)
- `POWENS_SYNC_MIN_INTERVAL_PROD_MS` (default: `43200000`)
- `VITE_PRIVATE_ACCESS_TOKEN` (optional, web -> API header)

## Notes for next step (Trade Republic)

- Keep using provider-agnostic read-model shape (`connection`, `account`, `transaction`).
- Add new provider ingestion in worker/API without changing web query contracts.
- Reuse dashboard endpoints and UI sections as-is.
