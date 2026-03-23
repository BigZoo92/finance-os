# AGENTS.md - infra/docker

Scope: `infra/docker/**`

## Local Rules

- Treat this tree as the production runtime topology contract. Public browser traffic must continue to terminate on `web`; `api` stays internal-only and `/api/*` continues to flow through the web proxy.
- Keep healthcheck and observability wiring aligned across runtime and deploy files:
  - `web` health probes use `/healthz`
  - `api` health probes use `/health`
  - `worker` heartbeat file paths stay consistent with the worker runtime and the `ops-alerts` sidecar
- The `ops-alerts` sidecar is the minimum production observability layer. When changing it, preserve all four alert families unless the task explicitly scopes a contract change:
  - 5xx burst probes
  - healthcheck failures
  - worker heartbeat freshness
  - disk free percent
- Keep `ops-alerts` secret-safe: webhook URLs and headers must stay in runtime env only, never in `VITE_*`, docs examples, client code, or logs.
- Keep shared deploy assumptions intact when editing Compose or container entrypoints:
  - readonly mounts for heartbeat and disk probes stay aligned
  - `no-new-privileges` and current read-only/tmpfs hardening stay intact unless the task explicitly changes the security posture
  - the sidecar continues to reuse the existing API image instead of introducing a separate build surface

## Verify

- `node --test infra/docker/ops-alerts/monitor.test.mjs` for alerting or health-monitor changes
- `pnpm smoke:api` when routing, proxy, or healthcheck URLs change
- `pnpm check:ci` when the environment can install and run the full repo suite

## Pitfalls

- Do not expose `apps/api` directly on a new public route in deploy config unless the task explicitly changes the external topology.
- Do not change worker heartbeat paths in only one place; update the worker runtime, healthchecks, and `ops-alerts` sidecar together.
- Do not weaken the observability signal by removing `x-request-id` propagation expectations, safe structured logging, or smoke coverage without replacing them with an equivalent guardrail.
