# Autopilot Troubleshooting

## Where is the patch?

- In the current autopilot flow, no GitHub patch comment is required for the happy path.
- `Autopilot - Improve ready to draft PR` now creates a draft PR handoff and labels it `autopilot:waiting-codex`.
- The maintainer must open that branch/task manually in Codex, extract the implementation there, and push commits on the same PR branch.
- If a PR still shows only `.github/agent-stubs/**` in `Files changed`, no real implementation reached the branch yet.

## Legacy patch comment mode

- `AUTOPILOT_PATCH_V1` is no longer part of the supported happy path.
- Keep this format in mind only when you are reading old PR threads created before the manual Codex handoff workflow landed.
- Current automation does not wait for a GitHub patch comment to move a PR forward; it waits for real commits on the PR branch.

## Codex reviewed the PR but did not implement anything

- GitHub comments from `chatgpt-codex-connector` are not enough on their own. Autopilot only advances once real commits land on the PR branch.
- The expected manual flow is: PR created -> you open/extract it in Codex -> Codex writes on the same branch -> CI runs -> merge-on-green continues.
- If CI reports the PR is still stub-only, autopilot should leave the PR open and post a manual Codex handoff reminder instead of opening retry PRs.
- A PR is only promoted out of draft when CI succeeds and the PR diff contains real non-stub changes with no `.github/agent-stubs/**` files left.

## Why do I see two Codex tasks?

- A challenger `improve:` task and an implementation `implement:` PR task are different stages. Seeing one of each is expected.
- The only valid manual extraction entrypoint is the `implement:` draft PR on an `agent/impl-*` branch.
- Do not extract `batch:`, `spec:`, `improve:`, or reminder comments on the PR thread.
- Stub-only reminder comments on the PR are informational only; they should not be treated as a second extraction request.

## Improve issue did not become ready

- An `improve:` issue becomes `ready` only when Codex replies directly on the issue with a comment ending in `Status: READY`.
- If neither happened, no `implement:` draft PR will be created yet.
- Do not extract `improve:` issues manually in Codex. They are challenger prompts, not implementation entrypoints.
- If you extract an `improve:` issue manually, Codex may open a docs-only `codex/...` PR that is outside the autopilot implementation flow.

## PR stays draft

- `Autopilot - Merge on green CI` is now the workflow that promotes a draft PR once it detects real non-stub files on the branch and green CI.
- A PR that remains draft with `autopilot:waiting-codex` usually means the branch still contains only the bootstrap stub or Codex only replied in comments without pushing commits.
- Check that `GH_AUTOPILOT_TOKEN` can write pull requests and issues.
- Check that the workflow fetched the PR `node_id` before attempting the mutation.

## PR is green but did not merge

- `Autopilot - Merge on green CI` now rebases the PR branch onto the latest base branch before merging when needed.
- If the rebase succeeds and pushes a new commit, the workflow intentionally stops and waits for the new CI run on the rebased branch.
- If automatic rebase hits a conflict, the PR gets `needs:you` and an `AUTOPILOT_REBASE_CONFLICT_V1` comment.
- If branch protection or stale status still blocks the merge, autopilot comments `AUTOPILOT_AUTO_MERGE_BLOCKED_V1` and stops.

## CI failed but Codex summary was misleading

- Local Codex summaries can be incomplete when the execution environment misses workspace dependencies or runner-only context.
- `Autopilot - CI failure to Codex` now comments the failing job names and a log excerpt back onto the implementation PR thread.
- Treat that CI comment as the source of truth, not the optimistic local summary inside Codex.
- The common failure pattern is TypeScript passing locally in a narrow scope while repo CI fails under `pnpm -r --if-present typecheck`.
- A recurring Finance-OS-specific failure pattern is `exactOptionalPropertyTypes`: optional fields must be omitted when absent, not passed as `undefined`.

## Codex says `missing bun-types` or `install state prevented full typecheck`

- If repo CI fails with real TypeScript errors while local `pnpm api:typecheck` or `pnpm worker:typecheck` pass on your machine, the repo is usually fine and the Codex environment is the weak link.
- The common causes are a stale post-configuration cache, a workspace install that did not complete in the Codex environment, or disabled agent internet on a cold cache.
- `apps/api` legitimately depends on `bun-types`; that package is already present in the workspace lockfile and local installs should resolve it.
- Reset the Codex environment cache when lockfiles or workspace dependencies changed.
- If possible, allow agent internet during environment setup so `pnpm -w install --frozen-lockfile` can refill a cold cache.
- Prefer using the repo script [../scripts/codex-env-setup.sh](../scripts/codex-env-setup.sh) as the Codex environment setup command so install semantics match CI and missing workspace dependencies are caught early.
- The setup now runs [../scripts/verify-workspace-install.mjs](../scripts/verify-workspace-install.mjs), which resolves declared dependencies across the repo generically instead of maintaining a hand-written package allowlist.
- The install command itself is not the real problem. From the repo root, `pnpm install --frozen-lockfile` is the canonical form; `pnpm -w install --frozen-lockfile` is redundant but not harmful.

## Issue-comment workflow runs on my own comment

- PR-thread handlers must require `issue.pull_request`.
- The guard must require a Codex-like author login containing `codex` or equal to `chatgpt-codex-connector`.
- Human instruction comments should never satisfy that author check.

## Too many PRs from one batch

- Batch intake is now strict: one requested spec per raw bullet, same order, no extras.
- Only the first spawned spec should auto-start as `ready`; the rest should be labeled `autopilot:queued`.
- Only one implementation PR lane should stay open at a time. Extra improve issues are expected to wait under `autopilot:queued-pr`.
- If you still see multiple implementation PRs open from one batch, inspect for simultaneous `ready` labeling or stale old PRs created before the manual handoff workflow landed.
