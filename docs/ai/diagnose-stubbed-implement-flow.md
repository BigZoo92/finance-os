# Diagnosis: Stubbed Implement Flow

Date: 2026-04-04

## Flow inspected

1. `improve:` issue created from a `spec:`
2. Codex challenger reply adds `Status: READY`
3. `ready` label triggers implementation PR creation
4. Stub branch and draft PR are created
5. Linked `improve:` and parent `spec:` issues are closed
6. Implementation is expected to begin
7. Instead, the PR remains stub-only and the queue blocks

## Files inspected

- `.github/workflows/autopilot-spec-to-improve.yml`
- `.github/workflows/autopilot-improve-comment-to-ready.yml`
- `.github/workflows/autopilot-improve-to-draft-pr.yml`
- `.github/workflows/autopilot-ci-failure-to-codex.yml`
- `.github/workflows/autopilot-merge-on-green.yml`
- `.github/workflows/autopilot-queue-pump.yml`
- `docs/agentic/release-map.md`
- `docs/autopilot-troubleshooting.md`
- `docs/autopilot-labels-glossary.md`
- Git history around commit `dba4661`

## What is actually happening

`autopilot-improve-to-draft-pr.yml` currently does all of the following correctly:

- creates the `agent/impl-*` branch
- creates the stub file under `.github/agent-stubs/`
- opens the draft `implement:` PR
- labels the PR `autopilot:waiting-codex`
- comments `@codex` on the PR
- closes the linked `improve:` issue
- closes the linked parent `spec:` issue

The break happens immediately after that.

## Root cause

The repo no longer has an automated implementation consumer for PR-thread Codex output.

Concrete evidence:

- Git history shows commit `dba4661` deleted `.github/workflows/autopilot-apply-codex-diff.yml`.
- That same commit rewrote `autopilot-improve-to-draft-pr.yml` from patch-driven implementation to a manual PR extraction model.
- The current PR body says:
  - `Autopilot mode: manual Codex handoff.`
  - `Open this PR task in Codex and extract the implementation manually onto this branch.`
- The current PR handoff comment says:
  - `MANUAL CODEX HANDOFF ONLY.`
  - `No GitHub reply is required.`
- No remaining workflow listens for Codex implementation comments on PR threads and applies them to the PR branch.

Result:

- the implementation lane becomes dependent on a human manual step that is invisible to GitHub automation
- the linked issues are already closed
- the queue still sees an open `agent/` PR and therefore does not promote the next item
- the stub PR becomes a terminal blocking state

## Why this is a P0

- It blocks the only active implementation lane.
- It closes upstream work items before real implementation exists.
- It breaks the intended zero-click or near-zero-click GitHub orchestration model.
- It creates the illusion that autopilot progressed when it actually paused indefinitely.

## Secondary contributing problems

- The current docs normalize the broken behavior by describing manual extraction as the intended happy path.
- The PR handoff comment is weak as an implementation brief. It links the improve issue but carries little structured execution context.
- The current system removed the old automatic apply path without replacing it with another automated Codex execution mechanism.

## Most robust fix supported by the evidence

Restore an automated GitHub-native implement handoff instead of keeping the PR in manual limbo.

The safest repair in this repo is:

1. Reinstate a PR-thread implementation consumer workflow that accepts Codex patch replies and applies them to the PR branch.
2. Change the `implement:` PR handoff comment back to an automatic patch-request format instead of a manual extraction instruction.
3. Keep the current single-lane queue, stub guard, CI failure feedback, reopen-on-close behavior, and merge-on-green logic.
4. Keep manual branch work as an optional human fallback, not the required happy path.

Why this repair is the best fit here:

- It preserves GitHub as the orchestrator.
- It uses only currently available subscriptions and GitHub Actions.
- It does not require extra paid services.
- It matches the repo’s prior working model more closely than inventing a new dispatcher.
- It keeps implementation ownership attached to the existing `implement:` PR branch.

## Residual uncertainty

I cannot prove from local repo state alone whether the manual-handoff conversion in `dba4661` was intentional for product reasons or an attempted workaround for flaky Codex behavior. I can prove, however, that it removed the only automated implement-stage consumer and that this directly explains the current blocked stub PRs.

Because the production symptom exactly matches that missing consumer, restoring an automated PR-thread implementation path is the correct repair.
