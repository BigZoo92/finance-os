# Autopilot Troubleshooting

## Corrupt patch

- Ensure the Codex reply has exactly one comment.
- Ensure line 1 is `AUTOPILOT_PATCH_V1`.
- Ensure there is exactly one fenced `diff` block and no other code fences.
- Ensure the diff block starts with `diff --git`.
- Ensure `AUTOPILOT_PATCH_V1` stays outside the diff fence.

## PR stays draft

- `Autopilot - Apply Codex diff to PR branch` must call GraphQL `markPullRequestReadyForReview`.
- Check that `GH_AUTOPILOT_TOKEN` can write pull requests and issues.
- Check that the workflow fetched the PR `node_id` before attempting the mutation.

## Apply runs on my own comment

- The guard must require `issue.pull_request`.
- The guard must require a Codex-like author login containing `codex` or equal to `chatgpt-codex-connector`.
- Human instruction comments should never satisfy that author check.
