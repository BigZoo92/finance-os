# Autopilot Troubleshooting

## Corrupt patch

- Ensure the Codex reply has exactly one comment.
- Ensure line 1 is `AUTOPILOT_PATCH_V1`.
- Ensure there is exactly one fenced code block and no other code fences.
- Prefer a fenced `diff` block, but a plain fenced block is accepted if the first meaningful line inside it is `diff --git`.
- If the connector strips the fence tag entirely, the raw patch body may still be accepted when it appears between `AUTOPILOT_PATCH_V1` and the first footer line.
- Ensure the patch starts with `diff --git`.
- Ensure `AUTOPILOT_PATCH_V1` stays outside the diff fence.
- Ensure the first implementation patch deletes the stub file and also changes at least one non-stub path.

## Codex reviewed the PR but did not implement anything

- GitHub Codex on this repo may prefer PR review/update mode over raw patch-comment mode.
- The source failure pattern is: Codex reviews the stub PR, but autopilot never gets a real implementation change on the branch.
- Autopilot now treats direct PR updates as the primary path and keeps `AUTOPILOT_PATCH_V1` comments only as fallback.
- If CI reports the PR is still stub-only, autopilot should post an `@codex address that feedback` follow-up on the PR instead of opening another broken PR immediately.
- A PR is only promoted out of draft when CI succeeds and the PR diff contains real non-stub changes with no `.github/agent-stubs/**` files left.

## Patch retry flow

- Patch failures now normalize to `format`, `apply`, `stub-only`, or `pr-lookup`.
- `format`, `stub-only`, and no-op patch replies now trigger a direct-update nudge on the same PR before any retry logic.
- Only true `git apply` conflicts should schedule a fresh retry PR from the parent `improve:` issue.
- Direct-update nudges are capped, and hard failures still stop with `needs:you` instead of looping indefinitely.
- A closed failed PR is expected when autopilot is retrying; the active lane should move to the newest retry PR.

## PR stays draft

- `Autopilot - Apply Codex diff to PR branch` can still call GraphQL `markPullRequestReadyForReview` for fallback patch comments.
- `Autopilot - Merge on green CI` must also promote a draft PR when Codex updated the PR branch directly and CI is green.
- Check that `GH_AUTOPILOT_TOKEN` can write pull requests and issues.
- Check that the workflow fetched the PR `node_id` before attempting the mutation.

## Apply runs on my own comment

- The guard must require `issue.pull_request`.
- The guard must require a Codex-like author login containing `codex` or equal to `chatgpt-codex-connector`.
- Human instruction comments should never satisfy that author check.

## Too many PRs from one batch

- Batch intake is now strict: one requested spec per raw bullet, same order, no extras.
- Only the first spawned spec should auto-start as `ready`; the rest should be labeled `autopilot:queued`.
- If you still see multiple similar implementation PRs start at once, inspect the source batch issue for duplicate raw bullets or repeated `ready` labeling.
