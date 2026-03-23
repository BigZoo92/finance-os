# AGENTS.md - apps/worker

Scope: `apps/worker/**`

## Local Rules

- [src/index.ts](src/index.ts) is the worker entrypoint and operational contract. Keep connection-level failure isolation, Redis locks, idempotent upserts, and metric updates intact.
- Treat worker code as provider-facing and secret-sensitive. Never log Powens codes, tokens, decrypted access tokens, or raw provider payloads.
- Keep provider cash account upserts and unified asset upserts in sync so dashboard patrimoine reads do not drift from normalized banking data.
- Preserve the current safety model:
  - per-connection Redis lock
  - reconnect-required handling on auth failures
  - heartbeat and scheduler behavior
  - graceful shutdown of DB and Redis clients
  - heartbeat file compatibility with `infra/docker/ops-alerts/monitor.mjs` and `infra/docker/healthchecks/worker-heartbeat-healthcheck.mjs`
- Worker changes must not degrade the fail-soft behavior of the web or API runtimes.
- Keep the worker's localhost-only `GET /health` and `GET /version` contract aligned with the shared system contract used by api and web.

## Verify

- `pnpm worker:typecheck`
- There is no worker package test script today; when changing sync behavior, add or update focused tests in the touched package if possible and document any manual verification gaps.

## Pitfalls

- Do not weaken transaction/account upsert idempotence backed by [../../packages/db/src/schema/powens.ts](../../packages/db/src/schema/powens.ts).
- Do not add browser-facing or SSR-facing concerns here.
