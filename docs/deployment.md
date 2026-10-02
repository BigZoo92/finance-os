# Deployment

## Release contract

Production uses immutable GHCR images orchestrated by Dokploy from `docker-compose.prod.yml`.

`.github/workflows/release.yml` publishes five images:

- `finance-os-web`
- `finance-os-api`
- `finance-os-worker`
- `finance-os-knowledge-service`
- `finance-os-quant-service`

The exact repository prefix comes from `GHCR_IMAGE_NAME`; tags are a release tag and a commit SHA. Do not use mutable `latest` deployment semantics.

## Runtime topology

`web` is the only public service. API, worker, ops-alerts, knowledge-service, quant-service, Neo4j, Qdrant, PostgreSQL, and Redis remain on the internal network. Schema migrations run once per release in the `migrate` service (`bun packages/db/src/migrate.ts`, the same API image); the API starts only after it completes successfully and never migrates at startup.

Health contracts:

- web: `/healthz`
- API: `/health`
- worker: heartbeat file shared with healthcheck and ops-alerts
- internal Python services: their Compose health checks

## Normal release

1. CI validates root tooling, skills/docs drift, lint, types, the migration journal (drift check and a fresh PostgreSQL apply), tests, Python checks, builds, E2E demo smoke, and Docker build smoke.
2. Release builds and optionally pushes all five images.
3. The workflow updates Dokploy Compose and `APP_IMAGE_TAG`.
4. Dokploy pulls immutable images and restarts the stack.
5. The workflow verifies the persisted tag; operators run post-deploy probes.

Required GitHub/Dokploy values are defined by the workflow, Compose, and [Configuration](configuration.md). Store secrets in GitHub secrets or Dokploy runtime values, not repository files.

## Pre-deploy checks

```text
pnpm check:ci
pnpm env:check:parity
pnpm docker:check
pnpm docker:build:smoke
```

For routing/proxy changes also exercise `pnpm smoke:api` locally against the intended runtime.

## Post-deploy checks

1. Confirm the deployed `APP_IMAGE_TAG` and commit SHA.
2. Check web `/healthz` and the proxied API health path.
3. Confirm API, worker heartbeat, PostgreSQL, Redis, knowledge, quant, Neo4j, Qdrant, and ops-alerts health.
4. Open demo mode first; it must work even if providers are unavailable.
5. In admin mode inspect provider diagnostics and data quality before running manual refresh.
6. Run `scripts/smoke-prod.mjs` with the target URL and credentials supplied through the documented environment contract.

## Rollback

Set Dokploy `APP_IMAGE_TAG` to the last known-good immutable tag and redeploy the same Compose file. Verify health and smoke probes. Database migrations must remain backward compatible across the rollback window; any destructive migration requires a separate reviewed rollout and recovery plan.

## Incident boundaries

Do not expose the API publicly to work around routing problems, disable auth checks for probes, or print resolved secrets. If only a provider/internal advisory service fails, keep the core cockpit online and follow [Operations](operations.md).
