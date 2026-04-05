# Audit: Current Agentic System

Date: 2026-04-04

## Scope audited

- GitHub workflows under `.github/workflows/`
- Issue templates under `.github/ISSUE_TEMPLATE/`
- Root and local agent guidance
- `docs/agentic/*`
- Existing autopilot troubleshooting/docs

## Current workflow architecture

The current system is GitHub-first and label-driven.

1. A `batch:` issue with labels `batch:spec` and `autopilot` is labeled `ready`.
2. `.github/workflows/autopilot-batch-to-codex.yml` posts an `@codex` comment asking for strict JSON derived from the batch raw bullets.
3. `.github/workflows/autopilot-batch-create-specs.yml` parses the Codex JSON reply and creates `spec:` issues 1:1 from the raw bullet list. Only the first spawned spec is auto-labeled `ready`; the rest are queued under `autopilot:queued`.
4. `.github/workflows/autopilot-spec-to-improve.yml` converts a ready `spec:` into an `improve:` issue and pings Codex in challenger mode.
5. `.github/workflows/autopilot-improve-comment-to-ready.yml` watches for a Codex reply ending with `Status: READY` and labels the `improve:` issue `ready`.
6. `.github/workflows/autopilot-improve-to-draft-pr.yml` creates an `agent/impl-*` branch, adds a `.github/agent-stubs/**` bootstrap file, opens a draft `implement:` PR, comments `@codex`, labels the PR `autopilot:waiting-codex`, and closes the linked `improve:` and `spec:` issues.
7. `.github/workflows/autopilot-ci-failure-to-codex.yml` comments CI failures back onto the PR thread.
8. `.github/workflows/autopilot-merge-on-green.yml` promotes the draft PR once it sees real non-stub changes plus green CI, rebases if needed, and merges automatically.
9. `.github/workflows/autopilot-queue-pump.yml` keeps only one implementation PR lane open and promotes queued work when the lane frees up.

## Current strengths

- GitHub is the real source of truth for orchestration, ownership, labels, PRs, and CI state.
- Batch expansion is strict 1:1 with the raw bullet list. That protects the user’s batch intent from speculative scope growth.
- The pipeline already enforces one active implementation PR lane, which is a good default for a solo maintainer.
- Stub bootstrap plus `.github/workflows/no-agent-stubs.yml` protects merge quality by preventing stub-only PRs from landing.
- CI failure feedback is looped back onto the implementation PR, which is materially better than relying on partial local summaries.
- Closed-without-merge PRs reopen and requeue the linked `improve:` / `spec:` work, so the queue does not silently lose state.

## Current bottlenecks

- The implement-stage handoff is broken in production: PRs are created and linked issues are closed, but implementation does not start automatically.
- The repo currently depends on an out-of-band manual Codex extraction step after PR creation. That breaks the otherwise GitHub-native state machine.
- Batch-to-spec conversion currently uses only the raw bullet list. Rich batch product context is mostly ignored.
- There is no `CLAUDE.md`, so Claude-specific usage, role boundaries, and collision avoidance are undocumented.
- There is no documented or installed `skill.color-expert` integration.

## Current risks and ambiguity

- The most serious risk is a terminal stub PR state: the queue considers the implementation lane occupied even though no implementation is progressing.
- The current docs explicitly describe a manual Codex handoff. That means the broken behavior is codified, not merely accidental drift.
- Because `autopilot-improve-to-draft-pr.yml` closes the `improve:` and `spec:` issues when the PR is created, the manual gap is easy to miss until the queue is already blocked.
- The current PR handoff comment says no GitHub reply is required. That is incompatible with a zero-click GitHub-based implementation stage.
- Claude compatibility is weak: there is no repo-native guidance for when Claude should challenge, review, or implement, and no shared ownership model between Codex and Claude.

## Fit for Codex today

Good:

- Batch expansion and improve/challenger prompts are already Codex-addressed from GitHub comments.
- CI failure summaries are fed back to the PR thread.

Weak:

- The implementation stage no longer has an automated GitHub consumer.
- The current implement prompt is optimized for a human opening the PR task manually in Codex, not for a fully GitHub-native autopilot loop.
- The implementation PR body/comment carries too little structured product context forward from the batch/spec artifacts.

## Fit for Claude today

- There is no root `CLAUDE.md`.
- There is no documented role split between Codex and Claude.
- There is no branch ownership rule tailored to a mixed Codex + Claude workflow.
- Claude can still be effective locally because the repo has good `AGENTS.md` coverage, but the repo is not explicitly optimized for Claude workflows yet.

## Batch issue format effectiveness

The user’s batch format is a strong product artifact, but the current workflow underuses it.

- The existing batch issue template captures only `Area`, `Context`, `Raw specs list`, and `Cost bias`.
- The automation prompt in `autopilot-batch-to-codex.yml` forwards only the raw bullet list.
- Objectives, design principles, non-negotiable constraints, fail-soft requirements, dual-path rules, decision rules, and pivots are not preserved as first-class inputs to spec generation.

Net: the repo respects the existence of batch issues, but it is not yet consuming them as rich product briefs.

## Where the setup currently loses time

- Waiting for a human to manually extract the `implement:` PR into Codex.
- Re-reading product intent because rich batch context is not carried into generated specs and implementation prompts.
- Recovering blocked queue state after stub PRs remain open.
- Missing Claude guidance causes avoidable local coordination overhead.

## Likely location of the blocked handoff

The break is between:

- `autopilot-improve-to-draft-pr.yml`
- and any workflow that should consume an implementation response on the PR thread.

Evidence:

- The PR creation workflow now says `Autopilot mode: manual Codex handoff.`
- The PR comment says manual extraction is required and that no GitHub reply is required.
- There is no current workflow left that applies a Codex implementation reply from a PR thread.
- Git history shows commit `dba4661` deleted `.github/workflows/autopilot-apply-codex-diff.yml`, which was previously the automated implement-stage consumer.

## Audit conclusion

The repo still has a solid GitHub-centered orchestration skeleton. The current P0 is not a minor label bug. The implementation stage was deliberately converted from a GitHub-native automated handoff into a manual extraction pause, while the rest of the pipeline still assumes progress will continue after PR creation. That mismatch is the primary production breakage and the first thing to repair.
