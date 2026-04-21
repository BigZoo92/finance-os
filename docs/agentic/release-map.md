# Release Map (Deprecated)

This map moved to [release-canonical.md](./release-canonical.md). Keep this page as a compatibility redirect for one release cycle.

## Workflow Topology

- Canonical release guidance: [release-canonical.md](./release-canonical.md)
- CI workflow: [../../.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Release workflow: [../../.github/workflows/release.yml](../../.github/workflows/release.yml)
- Stub guard workflow: [../../.github/workflows/no-agent-stubs.yml](../../.github/workflows/no-agent-stubs.yml)

## Deployment and Runtime Docs

- CI/CD overview: [../ci-cd.md](../ci-cd.md)
- Deployment reference: [../deployment.md](../deployment.md)
- Dokploy notes: [../deploy-dokploy.md](../deploy-dokploy.md)

## Release Guardrails

Authoritative guardrails (dual-path, observability, smoke, rollback) live in [release-canonical.md](./release-canonical.md).

## Smoke and Manual Checks

- API smoke: [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs)
- Prod smoke: [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs)
