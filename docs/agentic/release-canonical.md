# Canonical Release Guide

> Canonical source for CI/release/deploy constraints and rollout expectations.

## Document Template (Required)

1. Workflow topology
2. Release invariants
3. **Demo/Admin dual-path**
4. **Observability & Safety**
5. **UI/UX state matrix** (for user-visible rollout changes)
6. Verification and smoke checks
7. Rollback / kill-switch

## Workflow Topology

- CI: `.github/workflows/ci.yml`
- Release: `.github/workflows/release.yml`
- Autopilot workflows under `.github/workflows/autopilot-*.yml`
- Stub guard: `.github/workflows/no-agent-stubs.yml`

## Release Invariants

- Public traffic enters via web runtime.
- GHCR tags are immutable and must not use `latest`.
- Deploy-time smoke checks must align with live route topology.
- Keep autopilot and release workflow assumptions intact unless explicitly scoped.

## Demo/Admin Dual-Path (Required)

- Release docs for feature rollouts must confirm demo path remains deterministic.
- Admin rollouts may enable live integrations but must preserve auth gating and fail-soft behavior.

## Observability & Safety (Required)

- **Request ID propagation:** verify request id remains visible end-to-end.
- **Logging redaction rules:** secrets and provider tokens never appear in deployment logs.
- **Normalized error contract:** release checks should confirm safe payloads on failed probes.
- **Health/smoke verification expectations:** `/health`, `/auth/me`, `/dashboard/summary`, and integration status checks where relevant.

## UI/UX State Matrix (Required for release-visible UX)

| Mode | Loading | Empty | Error | Degraded | Fallback copy |
| --- | --- | --- | --- | --- | --- |
| Demo | Required | Required | Required | Required | Required |
| Admin | Required | Required | Required | Required | Required |

## Verification and Smoke Checks

- `pnpm check:ci`
- `node scripts/smoke-api.mjs`
- `node scripts/smoke-prod.mjs`

## Rollback / Kill-Switch

- Revert release migration commits on regression.
- Keep redirect/deprecation stubs for at least one release cycle to reduce bookmark/link breakage.
- Use documented kill-switches before full rollback when mitigation is available.
