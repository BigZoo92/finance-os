# Release Map

This repo already has a working automation model. Treat this map as an entry point, not a redesign brief.

## Workflow Topology

- CI: [../../.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Release: [../../.github/workflows/release.yml](../../.github/workflows/release.yml)
- Stub guard: [../../.github/workflows/no-agent-stubs.yml](../../.github/workflows/no-agent-stubs.yml)
- Autopilot patch apply: [../../.github/workflows/autopilot-apply-codex-diff.yml](../../.github/workflows/autopilot-apply-codex-diff.yml)
- Autopilot batch to Codex: [../../.github/workflows/autopilot-batch-to-codex.yml](../../.github/workflows/autopilot-batch-to-codex.yml)
- Autopilot batch reply to specs: [../../.github/workflows/autopilot-batch-create-specs.yml](../../.github/workflows/autopilot-batch-create-specs.yml)
- Autopilot CI failure to Codex: [../../.github/workflows/autopilot-ci-failure-to-codex.yml](../../.github/workflows/autopilot-ci-failure-to-codex.yml)
- Autopilot improve to draft PR: [../../.github/workflows/autopilot-improve-to-draft-pr.yml](../../.github/workflows/autopilot-improve-to-draft-pr.yml)
- Autopilot improve reply to ready: [../../.github/workflows/autopilot-improve-comment-to-ready.yml](../../.github/workflows/autopilot-improve-comment-to-ready.yml)
- Autopilot queue pump: [../../.github/workflows/autopilot-queue-pump.yml](../../.github/workflows/autopilot-queue-pump.yml)
- Autopilot merge on green: [../../.github/workflows/autopilot-merge-on-green.yml](../../.github/workflows/autopilot-merge-on-green.yml)

## Deployment and Runtime Docs

- CI/CD overview: [../ci-cd.md](../ci-cd.md)
- Deployment reference: [../deployment.md](../deployment.md)
- Dokploy notes: [../deploy-dokploy.md](../deploy-dokploy.md)
- Debugging and prod checks: [../debugging.md](../debugging.md)
- Docker/deploy local rules: [../../infra/docker/AGENTS.md](../../infra/docker/AGENTS.md)

## Release Guardrails

- Keep GHCR tags immutable.
- Do not use `latest`.
- Do not rebuild on Dokploy.
- Keep public traffic on `web`; `/api/*` continues to proxy internally to the API runtime.
- Do not alter autopilot, CI, release, or PR automation unless that work is explicitly scoped.
- Autopilot batch intake is strict 1:1 with the raw bullet list and only one spawned spec may auto-start at a time.
- Autopilot challenge completes only when Codex posts a `Status: READY` comment on the `improve:` issue.
- Autopilot implementation starts from the `implement:` draft PR thread: Codex replies there with `AUTOPILOT_PATCH_V1`, and the patch-apply workflow updates the same PR branch automatically.
- Creating that implementation PR closes the linked `spec:` and `improve:` issues as completed; if the PR is later closed without merge, autopilot reopens and requeues the linked work.
- The `implement:` PR is the only valid execution artifact. Do not implement from `batch:`, `spec:`, or `improve:` issue tasks.
- Only one autopilot implementation PR should be open at a time. Additional improve issues queue under `autopilot:queued-pr` until the active lane closes.
- The queue pump should backfill the implementation request comment onto legacy stuck PRs that still carry the old waiting label.
- When CI fails on an autopilot implementation PR, autopilot must comment the failing job summary and log excerpt back onto the PR thread so Codex can continue from the real runner error with another patch reply.
- Manual local takeover on an `implement:` PR should validate with `pnpm check:ci`, which mirrors the current GitHub CI order with `CI=true`.
- Merge-on-green must recognize a real non-stub implementation on the branch, promote the PR out of draft, rebase it onto the latest base if needed, and only merge once no stub file remains.
- Release automation now waits for the public `/health` endpoint after `compose.deploy` and runs `scripts/smoke-prod.mjs`; the smoke must cover `/health`, `/auth/me`, `/dashboard/summary`, and `/integrations/powens/status` on both root and `/api` compatibility paths, with demo/admin-aware assertions and GitHub step-summary plus `::error` output on failure.
- Production Compose now includes an `ops-alerts` sidecar driven by [../../infra/docker/ops-alerts/monitor.mjs](../../infra/docker/ops-alerts/monitor.mjs); keep its webhook env, shared worker heartbeat volume, and readonly volume mounts aligned when changing deploy topology.
- Treat observability wiring as release-sensitive: `x-request-id` visibility, smoke coverage, healthcheck targets, and alert probe URLs must continue to match the public `web` entrypoint and the internal API/worker topology.
- Runtime-safe web feature flags must stay aligned across build args, `docker-compose.prod*.yml`, Dokploy env, and `public-runtime-env.ts`; that now includes the dashboard health signal flags alongside the existing Powens cooldown UI flags.
- Server-side Powens kill-switches that change worker/API write behavior, such as `SYNC_STATUS_PERSISTENCE_ENABLED`, `POWENS_FORCE_FULL_SYNC`, and `POWENS_SYNC_DISABLED_PROVIDERS`, must stay aligned across the API and worker runtime env in `docker-compose.prod.yml` and the Dokploy env snapshot even though they are not build args or `VITE_*` flags.

## Smoke and Manual Checks

- API smoke: [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs)
- Prod smoke: [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs) (`SMOKE_AUTH_MODE`, optional `SMOKE_ADMIN_EMAIL` / `SMOKE_ADMIN_PASSWORD`, optional `SMOKE_SUMMARY_RANGE`)
- Required production route assertions live in [../../apps/api/src/index.ts](../../apps/api/src/index.ts)
- The shared system contract is `GET /health` and `GET /version` across runtimes, with web retaining `GET /healthz` as a compatibility alias and worker exposing those routes on localhost only.

## When to Read This First

- Workflow or release docs changed
- Route/public-entrypoint behavior changed
- Docker, GHCR, Dokploy, or smoke checks changed
- A change might break autopilot expectations even if the app code itself looks safe
