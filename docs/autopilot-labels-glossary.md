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
- `autopilot:queued-pr`: improve issue is ready in principle but must wait for the single active implementation PR slot.
- `autopilot:waiting-codex`: draft PR exists and is waiting for a human to extract the task in Codex and push commits on that branch.
- `autopilot:ready-to-merge`: a real non-stub implementation landed on the PR branch and autopilot can continue toward merge.

## PR state labels (autopilot usage)

- `pr:draft`: PR is draft and must not be merged.
- `pr:created`: an improve issue already has its implementation PR.

## Operational notes

- Improve batch creation should label only the first spawned spec issue as `ready`; the rest should be `autopilot:queued`.
- Improve-to-PR automation should open at most one agent implementation PR at a time; additional improve issues move to `autopilot:queued-pr`.
- Creating the implementation PR closes the linked `spec:` and `improve:` issues as completed. If that PR is later closed without merge, autopilot reopens and requeues the linked work.
- Merge-on-green automation should only merge autopilot PRs when real non-stub files landed on the branch, the PR is no longer draft, and no stub file remains in the PR diff.
- The implementation step is now a manual Codex handoff on the PR branch. GitHub comments can surface the handoff in Codex, but autopilot no longer depends on patch-comment apply.
- Manual Codex extraction should start only from `implement:` draft PRs on `agent/impl-*` branches. Extracting `improve:` issue tasks can create out-of-band docs PRs that autopilot will ignore.
- A failed CI run on an autopilot implementation PR should move the PR back into `autopilot:waiting-codex` and add a comment with the real runner failure excerpt.
