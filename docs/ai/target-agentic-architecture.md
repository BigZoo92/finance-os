# Target Agentic Architecture

Date: 2026-04-04

## Design goals

- Keep the existing GitHub-first workflow model.
- Preserve one orchestrator and one source of truth.
- Restore automatic implementation progress after PR creation.
- Improve throughput by reducing ambiguity, not by adding orchestration sprawl.
- Stay workable for one maintainer with ChatGPT Pro + Codex and Claude Max only.

## Source of truth

GitHub remains the orchestrator.

- Issues hold product intent and stage transitions.
- Labels hold queue and ownership state.
- The `implement:` PR is the only implementation execution artifact.
- CI and PR thread comments are the operational truth for implementation progress.

No second scheduler, paid agent coordinator, or external queue is required.

## Lane model

- One implementation lane stays open by default.
- Batch intake may expand into multiple `spec:` issues, but only one spawned spec auto-starts immediately.
- `improve:` issues queue behind the single implementation lane as needed.
- The queue pump remains the only promotion mechanism.

This keeps state understandable and avoids same-issue same-branch collisions.

## Codex role

Codex is the remote GitHub-native automation actor.

Codex should:

- expand `batch:` issues into strict JSON for 1:1 `spec:` spawning
- act as challenger on `improve:` issues
- implement on `implement:` PRs by replying on the PR thread with `AUTOPILOT_PATCH_V1`
- respond to CI-failure comments on the same PR thread with follow-up fix patches

Codex should not:

- open a separate PR from an autopilot `implement:` task
- implement directly from `batch:` / `spec:` / `improve:` issue threads
- create a second ownership lane for the same task

## Claude role

Claude is the local high-context partner, not the default remote orchestrator.

Recommended default use:

- architecture challenger for risky changes
- code reviewer / adversarial reviewer before merge
- prompt refiner for batch/spec quality
- UI/UX and design critic, including color work
- local implementation help on manually owned branches outside the active autopilot lane

Recommended default non-use:

- do not have Claude and Codex both writing concurrently to the same active autopilot PR branch

## Recommended Codex + Claude split

Default split:

- Codex owns the active autopilot `implement:` PR branch
- Claude challenges and reviews

Escalation split for risky work:

- Codex still owns the autopilot branch
- Claude is asked to attack assumptions, review the patch, or prototype locally on a separate non-autopilot branch

Manual takeover split:

- if you intentionally want Claude to implement an active autopilot item, treat that as a human takeover
- keep the same PR branch
- stop asking Codex to write on that PR until Claude’s turn is done

One writer at a time on the active autopilot branch is the key rule.

## Batch artifact handling

The batch issue format should stay a first-class product brief.

The target flow is:

1. Rich `batch:` issue captures area, context, objectives, principles, non-negotiables, expected end result, raw bullets, cost bias, decision rules, and explicit out-of-scope.
2. Batch-to-Codex prompt forwards both the raw bullets and the richer batch brief.
3. Spawned `spec:` issues keep the per-bullet scope but also embed the parent batch product context.
4. `improve:` remains a focused challenger stage, not an implementation stage.
5. `implement:` PR is the execution stage with explicit branch ownership.

This preserves the spirit of the current model while making the product brief materially more useful downstream.

## Recommended operating model changes

Recommended:

- keep the current batch -> spec -> improve -> implement PR -> merge loop
- restore automatic implementation from the `implement:` PR thread
- keep one implementation lane by default
- keep `improve:` as challenger-only
- keep CI failure summaries on the PR thread
- use Claude primarily as reviewer/challenger unless you explicitly take over implementation locally

Not recommended:

- flattening batches into generic TODO lists
- letting both Codex and Claude write to the same autopilot branch concurrently
- creating parallel implementation PR lanes by default
- adding external paid orchestration layers

## High-impact, low-risk improvements

- Restore the PR-thread patch-apply workflow so stub PRs do not become terminal queue blockers.
- Backfill implementation-request comments onto legacy stuck PRs via the queue pump.
- Feed richer batch brief sections into batch expansion and spec bodies.
- Add explicit root guidance for Claude instead of relying on implicit behavior.
- Add project-visible guidance for color/design work instead of leaving it tribal.

## Optional future improvements

Disabled by default:

- A configurable second implementation lane via repo variable or workflow input.
- Separate Claude-driven review automation on PR threads.
- Additional GitHub Apps or paid orchestration products.

These may help later, but they are not needed to fix the current system and would increase coordination cost today.
