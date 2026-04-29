# AGENTS.md - apps/worker

Scope: `apps/worker/**`

## Local Rules

- [src/index.ts](src/index.ts) is the worker entrypoint and operational contract. Keep connection-level failure isolation, Redis locks, idempotent upserts, and metric updates intact.
- Treat worker code as provider-facing and secret-sensitive. Never log Powens codes, tokens, decrypted access tokens, or raw provider payloads.
- Keep provider cash account upserts and unified asset upserts in sync so dashboard patrimoine reads do not drift from normalized banking data.
- Preserve the data-layer boundary for sync pipelines:
  - `raw`: provider payload snapshots are staged in `provider_raw_import` only.
  - `normalized`: read-model-safe business fields are persisted in first-class tables (`bank_account`, `transaction`, unified assets, recurring commitments).
  - `derived`: worker-derived helpers (label/category/merchant/object timestamps) must be deterministic and recomputable from raw payloads.
  - `manual`: user-authored edits stay authoritative in manual/domain tables and must not be overwritten by provider normalization runs.
- Preserve the current safety model:
  - per-connection Redis lock
  - reconnect-required handling on auth failures
  - archived Powens connections are skipped by manual and scheduled sync
  - heartbeat and scheduler behavior
  - graceful shutdown of DB and Redis clients
  - heartbeat file compatibility with `infra/docker/ops-alerts/monitor.mjs` and `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`
- Worker changes must not degrade the fail-soft behavior of the web or API runtimes.
- Keep the persisted Powens last-sync snapshot minimal and end-of-job only: transition logs, Redis counters, and DB writes for `lastSyncStatus` / `lastSyncReasonCode` must stay correlated by request id and must all short-circuit when `SYNC_STATUS_PERSISTENCE_ENABLED=false`.
- Keep the worker's localhost-only `GET /health` and `GET /version` contract aligned with the shared system contract used by api and web.
- Keep the optional market refresh scheduler (`src/market-refresh-scheduler.ts`) internal-only and fail-soft: it may only trigger `POST /dashboard/markets/refresh` over `API_INTERNAL_URL`, must respect `EXTERNAL_INTEGRATIONS_SAFE_MODE`, and must never log provider keys or raw provider payloads.
- Keep the optional advisor daily scheduler (`src/advisor-daily-scheduler.ts`) internal-only and fail-soft: it may only trigger `POST /dashboard/advisor/run-daily` over `API_INTERNAL_URL`, must use the internal token path when configured, must respect `EXTERNAL_INTEGRATIONS_SAFE_MODE`, and must never log provider keys or prompt payloads. The current recommended posture keeps this scheduler disabled by env and relies on the admin manual mission.

## Verify

- `pnpm worker:typecheck`
- There is no worker package test script today; when changing sync behavior, add or update focused tests in the touched package if possible and document any manual verification gaps.
- `bun test apps/worker/src/market-refresh-scheduler.test.ts` when market refresh scheduling changes

## Pitfalls

- Do not weaken transaction/account upsert idempotence backed by [../../packages/db/src/schema/powens.ts](../../packages/db/src/schema/powens.ts).
- Do not re-enable provider accounts/assets from an archived or superseded Powens connection without an explicit reconnect flow.
- Do not add browser-facing or SSR-facing concerns here.
