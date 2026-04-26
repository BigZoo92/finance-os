# Worker Sync Context Pack — Finance-OS

> Auto-generated. Sources: apps/worker/AGENTS.md, packages/redis/AGENTS.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Worker Rules

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
  - heartbeat and scheduler behavior
  - graceful shutdown of DB and Redis clients
  - heartbeat file compatibility with `infra/docker/ops-alerts/monitor.mjs` and `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`
- Worker changes must not degrade the fail-soft behavior of the web or API runtimes.
- Keep the persisted Powens last-sync snapshot minimal and end-of-job only: transition logs, Redis counters, and DB writes for `lastSyncStatus` / `lastSyncReasonCode` must stay correlated by request id and must all short-circuit when `SYNC_STATUS_PERSISTENCE_ENABLED=false`.
- Keep the worker's localhost-only `GET /health` and `GET /version` contract aligned with the shared system contract used by api and web.
- Keep the optional market refresh scheduler (`src/ma

## Key Constraints

- Bun runtime
- Redis-based job queue
- Powens sync jobs
- Batch upsert patterns
- Fail-soft on provider errors
