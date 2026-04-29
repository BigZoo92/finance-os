# Powens MVP (single-user)

## Prerequisites

Required environment variables:

- `DATABASE_URL`
- `REDIS_URL`
- `POWENS_CLIENT_ID`
- `POWENS_CLIENT_SECRET`
- `POWENS_BASE_URL`
- `POWENS_DOMAIN`
- `POWENS_REDIRECT_URI_DEV`
- `APP_ENCRYPTION_KEY` (must resolve to 32 bytes)

Optional environment variables:

- `POWENS_WEBVIEW_BASE_URL` (default: `https://webview.powens.com/connect`)
- `POWENS_WEBVIEW_URL` (use full URL override for manual sandbox tests)
- `POWENS_REDIRECT_URI_PROD`
- `POWENS_SYNC_INTERVAL_MS` (default: `43200000`, 2 sync/day)
- `POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS` (default: `7`, conservative late-posted catch-up)
- `POWENS_FORCE_FULL_SYNC` (default: `false`, kill-switch to force full window)
- `POWENS_SYNC_DISABLED_PROVIDERS` (default: empty CSV, disables sync for listed providers)

Use `.env.example` as template.

## Local setup

1. Start infra:
   - `pnpm infra:up`
2. Generate/apply DB schema:
   - `pnpm db:migrate`
3. Start apps:
   - `pnpm dev:apps`

## Connection flow

1. Open dashboard.
2. In "Connexions Powens", click `Connecter une banque`.
3. Complete Powens webview flow.
4. Powens redirects to `/powens/callback?connection_id=...&code=...`.
5. Web callback posts to `POST /integrations/powens/callback`.
6. API exchanges `code` at Powens (`POST /auth/token/access`), encrypts access token (AES-256-GCM), stores connection, and enqueues sync.
7. Worker syncs accounts + transactions into Postgres.

The callback upserts by `powens_connection_id`. A repeated callback for the same provider connection refreshes the encrypted token and reuses the existing row instead of creating a second active connection.

Powens endpoints used by this MVP:

- `POST /auth/token/access` (code -> access token)
- `GET /users/me/connections/{connectionId}/accounts`
- `GET /users/me/accounts/{accountId}/transactions`

## Manual sync

- Dashboard button `Sync maintenant` triggers `POST /integrations/powens/sync`.
- Callback page button `Lancer sync` triggers sync for the specific connection.
- Worker scheduler enqueues `powens.syncAll` every `POWENS_SYNC_INTERVAL_MS`.
- Incremental sync uses `last_success_at` watermark + lookback window (`POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS`) for safer late-posted transactions.
- Connection-scoped manual full-resync and global `POWENS_FORCE_FULL_SYNC=true` both switch to the large replay window.

## Idempotence model

- Connections: upsert on `powens_connection_id`; exact reconnects unarchive the same row and replace the encrypted access token.
- Accounts: upsert on `powens_account_id`.
- Duplicate accounts returned within one provider sync are collapsed by `(provider_connection_id, powens_account_id)` before DB upsert; the latest provider row wins.
- If a newly synced active Powens account has the same normalized IBAN as an enabled account on another Powens connection, the older account/asset is disabled. If that leaves the older connection with no enabled accounts, the older connection is archived with reason `duplicate_account_replaced`.
- Transactions:
  - Unique when Powens transaction id exists:
    - `(powens_connection_id, powens_transaction_id)` (partial unique, non-null id only).
  - Fallback unique when id is absent:
    - `(powens_connection_id, powens_account_id, booking_date, amount, label_hash)`.
- Worker uses bulk upserts in batches to avoid duplicates on retries.

## Disconnect / archive

- Admin can soft-disconnect a connection with `DELETE /integrations/powens/connections/:connectionId`.
- Demo mode cannot disconnect and never mutates DB/provider state.
- The route sets `powens_connection.archived_at`, records an archive reason, disables linked `financial_account` and provider `asset` rows, and preserves historical transactions/raw imports.
- Archived connections are hidden from Powens status and dashboard active connection reads.
- The worker skips archived connections for both manual and scheduled sync.

## Security model

- Powens `client_secret` is API/worker-only.
- Web never receives Powens secrets or long-lived token.
- `code` and access tokens are never logged.
- Access tokens are stored encrypted in DB using AES-256-GCM and `APP_ENCRYPTION_KEY`.

## Status and reconnect notes (PSD2)

- Connection statuses:
  - `connected`
  - `syncing`
  - `error`
  - `reconnect_required`
- `reconnect_required` is set when Powens auth calls return unauthorized responses (typically renewed PSD2 consent required).
- In that case, reconnect through webview to refresh the long-lived token.
