# Autopilot Troubleshooting

## Where is the patch?

- The happy path is now a GitHub patch comment again.
- `Autopilot - Improve ready to draft PR` creates the draft `implement:` PR and posts an implementation request on that PR thread.
- Codex should reply on that PR thread with `AUTOPILOT_PATCH_V1` plus exactly one fenced unified diff.
- The safest reply is a Git-generated diff from the current PR branch; do not hand-edit hunk headers or counts.
- `Autopilot - Apply Codex diff to PR branch` applies that patch onto the same PR branch.
- If a PR still shows only `.github/agent-stubs/**` in `Files changed`, no real implementation reached the branch yet.

## Codex reviewed the PR but did not implement anything

- A generic review comment is not enough. The implementation reply must contain `AUTOPILOT_PATCH_V1` and exactly one fenced diff block.
- The expected flow is: PR created -> Codex replies on PR thread with patch -> autopilot applies patch -> CI runs -> merge-on-green continues.
- Before posting the reply, validate the exact fenced patch with `git apply --check` on the current PR branch.
- The apply workflow now validates the comment structure itself: the marker must be the only text before the fence, the footer must stay after the fence, and the diff body may legitimately contain the same marker string inside added or removed file content.
- If CI reports the PR is still stub-only, autopilot should leave the PR open and request another cleanup patch on the same PR thread instead of opening retry PRs.
- A PR is only promoted out of draft when CI succeeds and the PR diff contains real non-stub changes with no `.github/agent-stubs/**` files left.

## Legacy waiting-codex PRs

- Older stuck PRs may still carry `autopilot:waiting-codex`.
- The queue pump should migrate that legacy label to `autopilot:waiting-patch` and backfill the new implementation request comment.
- If that did not happen yet, relabeling or closing/reopening the PR lane may be needed once to retrigger the sweep.

## Improve issue did not become ready

- An `improve:` issue becomes `ready` only when Codex replies directly on the issue with a comment ending in `Status: READY`.
- If that did not happen, no `implement:` draft PR will be created yet.
- Do not implement directly from `improve:` issues. They are challenger prompts, not implementation entrypoints.
- If you implement directly from an `improve:` issue, Codex may open an out-of-band PR that autopilot will ignore.

## My spec or improve issue disappeared

- Once autopilot creates the `implement:` PR, it closes the linked `spec:` and `improve:` issues as completed.
- That is expected: implementation work has moved onto the PR branch.
- If the implementation PR is closed without merge, autopilot reopens and requeues the linked work automatically.

## PR stays draft

- `Autopilot - Merge on green CI` promotes a draft PR once it detects real non-stub files on the branch and green CI.
- A PR that remains draft with `autopilot:waiting-patch` usually means the branch still contains only the bootstrap stub or the Codex reply was malformed and could not be applied.
- The patch-apply workflow now uses `git apply --recount` to recover minor hunk-count mismatches, but it still expects a real Git diff and will reject malformed fences or non-applying patches.
- Parser changes for the PR-thread patch format should keep `node --test scripts/agentic/parse-autopilot-patch-comment.test.mjs` green so regressions are caught before push.
- If patch apply fails with `corrupt patch`, regenerate the reply from `git diff`, then validate it with `git apply --check` before posting a new PR-thread comment.
- Check that `GH_AUTOPILOT_TOKEN` can write pull requests and issues.
- Check that the PR thread contains the implementation request comment and that Codex replied with `AUTOPILOT_PATCH_V1`.

## PR is green but did not merge

- `Autopilot - Merge on green CI` rebases the PR branch onto the latest base branch before merging when needed.
- If the rebase succeeds and pushes a new commit, the workflow intentionally stops and waits for the new CI run on the rebased branch.
- If automatic rebase hits a conflict, the PR gets `needs:you` and an `AUTOPILOT_REBASE_CONFLICT_V1` comment.
- If branch protection or stale status still blocks the merge, autopilot comments `AUTOPILOT_AUTO_MERGE_BLOCKED_V1` and stops.

## CI failed but Codex summary was misleading

- Local Codex summaries can be incomplete when the execution environment misses workspace dependencies or runner-only context.
- `Autopilot - CI failure to Codex` comments the failing job names and a log excerpt back onto the implementation PR thread.
- Treat that CI comment as the source of truth, not the optimistic local summary inside Codex.
- Ask Codex to rerun `pnpm check:ci` before replying with the next fix patch whenever the environment setup completed successfully.
- The common failure pattern is TypeScript passing locally in a narrow scope while repo CI fails under `pnpm -r --if-present typecheck`.
- A recurring Finance-OS-specific failure pattern is `exactOptionalPropertyTypes`: optional fields must be omitted when absent, not passed as `undefined`.

## Local fallback / env parity

- If repo CI fails with real TypeScript errors while local `pnpm api:typecheck` or `pnpm worker:typecheck` pass on your machine, the repo is usually fine and the Codex environment is the weak link.
- The common causes are a stale post-configuration cache, a workspace install that did not complete in the Codex environment, or disabled agent internet on a cold cache.
- `apps/api` legitimately depends on `bun-types`; that package is already present in the workspace lockfile and local installs should resolve it.
- Reset the Codex environment cache when lockfiles or workspace dependencies changed.
- If possible, allow agent internet during environment setup so `pnpm install --frozen-lockfile` can refill a cold cache.
- Prefer using the repo script [../scripts/codex-env-setup.sh](../scripts/codex-env-setup.sh) as the Codex environment setup command so install semantics match CI and missing workspace dependencies are caught early.
- That setup script also forces `ONNXRUNTIME_NODE_INSTALL=skip` and `ONNXRUNTIME_NODE_INSTALL_CUDA=skip` so `gitnexus` skips optional Linux CUDA downloads that often fail in restricted Codex containers.
- It now also installs Bun, Rust, the Tauri CLI, Linux desktop deps when `apt-get` is available, and runs `pnpm desktop:doctor` before you trust desktop parity.
- The setup now runs [../scripts/verify-workspace-install.mjs](../scripts/verify-workspace-install.mjs), which resolves declared dependencies across the repo generically instead of maintaining a hand-written package allowlist.

## Issue-comment workflow runs on my own comment

- PR-thread handlers must require `issue.pull_request`.
- The guard must require a Codex-like author login containing `codex` or equal to `chatgpt-codex-connector`.
- Human instruction comments should never satisfy that author check.

## Too many PRs from one batch

- Batch intake is strict: one requested spec per raw bullet, same order, no extras.
- Only the first spawned spec should auto-start as `ready`; the rest should be labeled `autopilot:queued`.
- Only one implementation PR lane should stay open at a time. Extra improve issues are expected to wait under `autopilot:queued-pr`.
- If you still see multiple implementation PRs open from one batch, inspect for simultaneous `ready` labeling or stale old PRs created before the single-lane rules landed.
