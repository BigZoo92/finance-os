# Release Map

This repo already has a working automation model. Treat this map as an entry point, not a redesign brief.

## Workflow Topology

- CI: [../../.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Release: [../../.github/workflows/release.yml](../../.github/workflows/release.yml)
- Stub guard: [../../.github/workflows/no-agent-stubs.yml](../../.github/workflows/no-agent-stubs.yml)
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

## Release Guardrails

- Keep GHCR tags immutable.
- Do not use `latest`.
- Do not rebuild on Dokploy.
- Keep public traffic on `web`; `/api/*` continues to proxy internally to the API runtime.
- Do not alter autopilot, CI, release, or PR automation unless that work is explicitly scoped.
- Autopilot batch intake is strict 1:1 with the raw bullet list and only one spawned spec may auto-start at a time.
- Autopilot challenge completes only when Codex posts a `Status: READY` comment on the `improve:` issue.
- Autopilot implementation now stops at a draft PR handoff: GitHub creates the branch and PR, then a human must extract the task manually in Codex and push commits on that same branch.
- Manual Codex extraction must start from the `implement:` draft PR only, never from the `batch:`, `spec:`, or `improve:` issue tasks.
- Only one autopilot implementation PR should be open at a time. Additional improve issues queue under `autopilot:queued-pr` until the active lane closes.
- When CI fails on an autopilot implementation PR, autopilot must comment the failing job summary and log excerpt back onto the PR thread so Codex can continue from the real runner error.
- Merge-on-green must recognize a real non-stub implementation on the branch, promote the PR out of draft, rebase it onto the latest base if needed, and only merge once no stub file remains.

## Smoke and Manual Checks

- API smoke: [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs)
- Prod smoke: [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs)
- Required production route assertions live in [../../apps/api/src/index.ts](../../apps/api/src/index.ts)

## When to Read This First

- Workflow or release docs changed
- Route/public-entrypoint behavior changed
- Docker, GHCR, Dokploy, or smoke checks changed
- A change might break autopilot expectations even if the app code itself looks safe
