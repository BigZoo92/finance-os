---
name: finance-os-deploy
description: Change Finance-OS CI, Docker, GHCR release, Dokploy, migrations, probes, or rollback safely. Use for workflows, Dockerfiles, Compose, release tags, production environment, and deployment failures.
---

# Deploy and release

Read `infra/docker/AGENTS.md` for Compose work and use `docs/deployment.md` as the operator contract.

## Boundaries

- Public traffic terminates on `web`; `api` remains internal and `/api/*` is proxied.
- Release currently builds the image set defined in `.github/workflows/release.yml`; derive the count and names there rather than documenting a fixed historical number.
- Images are immutable and traceable by release/SHA tags. Secrets are runtime inputs, never build args or image layers.
- Migrations must be deploy/rollback compatible and run exactly where the current release contract declares them.
- Keep health checks, worker heartbeat, ops-alerts mounts, resource limits, and log rotation aligned across Compose and docs.
- IBKR/Binance secrets go only to server runtimes that consume them, never `web` or browser configuration.

## Workflow

1. Run impact analysis on the changed script or runtime entry point.
2. Validate workflow permissions, cache/tag inputs, environment ownership, and failure propagation.
3. Render Compose with non-secret placeholders and inspect the resolved topology.
4. Update deployment documentation only for operator-visible changes.
5. Define rollback and post-deploy probes before shipping.

## Verification

Run the smallest workflow/script tests, `pnpm docker:check`, `pnpm env:check:parity`, relevant builds, and smoke checks when routes or deploy topology change. Never deploy, push images, or mutate Dokploy unless the user explicitly asks.
