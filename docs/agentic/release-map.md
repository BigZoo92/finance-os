# Release Map

This repo already has a working automation model. Treat this map as an entry point, not a redesign brief.

## Workflow Topology

- CI: [../../.github/workflows/ci.yml](../../.github/workflows/ci.yml)
- Release: [../../.github/workflows/release.yml](../../.github/workflows/release.yml)
- Stub guard: [../../.github/workflows/no-agent-stubs.yml](../../.github/workflows/no-agent-stubs.yml)
- Autopilot patch apply: [../../.github/workflows/autopilot-apply-codex-diff.yml](../../.github/workflows/autopilot-apply-codex-diff.yml)
- Autopilot batch to Codex: [../../.github/workflows/autopilot-batch-to-codex.yml](../../.github/workflows/autopilot-batch-to-codex.yml)
- Autopilot batch reply to specs: [../../.github/workflows/autopilot-batch-create-specs.yml](../../.github/workflows/autopilot-batch-create-specs.yml)
- Autopilot improve to draft PR: [../../.github/workflows/autopilot-improve-to-draft-pr.yml](../../.github/workflows/autopilot-improve-to-draft-pr.yml)
- Autopilot improve reply to ready: [../../.github/workflows/autopilot-improve-comment-to-ready.yml](../../.github/workflows/autopilot-improve-comment-to-ready.yml)
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
- Autopilot implementation PRs now prefer direct Codex branch updates; fenced unified diff comments remain a fallback path only.
- Autopilot patch apply rejects stub-only or no-op replies, nudges direct PR updates first, and only reopens retry PRs for true apply conflicts.
- Merge-on-green must recognize a real direct implementation on the branch, promote the PR out of draft, and only merge once no stub file remains.

## Smoke and Manual Checks

- API smoke: [../../scripts/smoke-api.mjs](../../scripts/smoke-api.mjs)
- Prod smoke: [../../scripts/smoke-prod.mjs](../../scripts/smoke-prod.mjs)
- Required production route assertions live in [../../apps/api/src/index.ts](../../apps/api/src/index.ts)

## When to Read This First

- Workflow or release docs changed
- Route/public-entrypoint behavior changed
- Docker, GHCR, Dokploy, or smoke checks changed
- A change might break autopilot expectations even if the app code itself looks safe
