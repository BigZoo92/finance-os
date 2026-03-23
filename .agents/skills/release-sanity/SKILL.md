---
name: release-sanity
description: Validate whether a Finance-OS change can affect CI, release, deploy, smoke tests, or autopilot assumptions without redesigning them. Use when runtime entrypoints, workflows, deploy docs, images, or route exposure are in scope.
---

# Release Sanity

## Trigger

- Use when a change touches workflows, Docker, runtime entrypoints, smoke tests, route exposure, or deploy docs.
- Use when a code change could break release or deploy assumptions even if no workflow file changed.

## Inputs

- Changed files
- Expected runtime or deploy behavior
- Existing workflow and deployment docs

## Output

- Produce a release-impact note with:
- affected workflow or deploy surfaces
- smoke checks to run
- risks to current automation
- explicit non-goals if the workflow itself is not being changed

## Workflow

1. Read [../../../docs/agentic/release-map.md](../../../docs/agentic/release-map.md) first.
2. Trace whether the change affects CI, GHCR images, Dokploy, web-only public routing, the local deploy rules in [../../../infra/docker/AGENTS.md](../../../infra/docker/AGENTS.md), or autopilot manual-Codex-handoff assumptions.
3. When `issue_comment` workflows are in scope, verify that Codex-author gating happens before side effects and that comment failures cannot create retry storms.
4. When autopilot implementation flow is in scope, verify the draft PR handoff, single active PR lane, stub-only rejection, and merge-on-green rebase/merge assumptions together.
5. Prefer validation and documentation over redesign; do not expand scope into workflow rewrites unless asked.
6. Call out any smoke checks from [../../../scripts/smoke-api.mjs](../../../scripts/smoke-api.mjs) or [../../../scripts/smoke-prod.mjs](../../../scripts/smoke-prod.mjs) that should run, including the post-deploy `/health`, `/auth/me`, `/dashboard/summary`, and `/integrations/powens/status` coverage plus any required `SMOKE_AUTH_MODE` or smoke-admin secrets.

## Trigger Examples

- "Check whether this route-mounting change can break release or prod smoke expectations."
- "Review this deployment-doc update and tell me if any workflow assumptions or manual smoke steps changed."

## Verification

- Use [../../../docs/ci-cd.md](../../../docs/ci-cd.md), [../../../docs/deployment.md](../../../docs/deployment.md), [../../../docs/debugging.md](../../../docs/debugging.md), and [../../../infra/docker/AGENTS.md](../../../infra/docker/AGENTS.md) as the source docs.
- Re-read [../../../.github/workflows/release.yml](../../../.github/workflows/release.yml) and [../../../.github/workflows/ci.yml](../../../.github/workflows/ci.yml) when workflow impact is possible.
