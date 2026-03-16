# Autopilot Labels Glossary

Reference glossary for labels used by the agentic/autopilot workflow.

## Core ownership labels

- `agent:pm`: planning/orchestration activity.
- `agent:challenger`: design challenge/proposal activity (no implementation).
- `agent:dev`: implementation activity.
- `agent:review`: review-only activity.

## Flow state labels

- `ready`: issue/PR can be picked up immediately.
- `blocked`: waiting on dependency or external resolution.
- `needs:you`: explicit maintainer decision/action required.
- `breakpoint`: checkpoint item that requires explicit validation before continuing.

## Area and priority labels

- `area:*`: functional scope (for example `area:autopilot`, `area:docs`, `area:api`).
- `prio:*`: urgency marker (for example `prio:p0`, `prio:p1`, `prio:p2`).

## Autopilot system labels

- `autopilot`: item is managed by autopilot automation.
- `autopilot:queued`: spec exists but is waiting for available PR capacity.
- `autopilot:retry-pr`: improve issue should reopen implementation as a retry PR.
- `autopilot:waiting-patch`: draft PR is waiting for Codex to land implementation, either by direct PR update or by fallback patch comment.
- `autopilot:patch-applied`: a real implementation landed on the PR branch and autopilot can continue toward merge.

## PR state labels (autopilot usage)

- `pr:draft`: PR is draft and must not be merged.

## Operational notes

- Improve batch creation should label only the first spawned spec issue as `ready`; the rest should be `autopilot:queued`.
- Merge-on-green automation should only merge autopilot PRs when `autopilot:patch-applied` is present, the PR is not draft, and no stub file remains in the PR diff.
- Patch-apply automation should reject stub-only or no-op patch replies, nudge direct PR updates first, and only retry PR creation for true apply conflicts.
