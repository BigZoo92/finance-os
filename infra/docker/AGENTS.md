# Docker instructions

Scope: `infra/docker/**` plus the root production Compose contract.

- Public traffic terminates on `web`; API and data/internal services remain private.
- Keep web `/healthz`, API `/health`, and worker heartbeat paths aligned with runtime code and ops-alerts.
- Preserve the four minimum alert families: 5xx burst, service health, heartbeat freshness, and disk capacity.
- Webhook URLs/headers are runtime secrets, never `VITE_*`, logs, or examples.
- Preserve read-only mounts, `no-new-privileges`, dropped capabilities, bounded logs, and resource/PID limits unless explicitly changing security posture.
- Keep PostgreSQL/Redis/Neo4j/Qdrant resource settings aligned with `docs/deployment.md` and `docs/operations.md`.

Verify Compose drift, relevant builds/smoke probes, and `node --test infra/docker/ops-alerts/monitor.test.mjs` for monitor changes.
