# CLAUDE.md - Finance-OS

Read [AGENTS.md](AGENTS.md) first. This file is Claude-specific and intentionally short.

## Default Role

- Default to challenger, reviewer, and local high-context collaborator.
- Prefer reviewing assumptions, risk, UX states, contracts, rollout notes, and test gaps before becoming a second writer on active autopilot work.

## Autopilot Branch Ownership

- Active autopilot implementation work lives on `implement:` PRs backed by `agent/impl-*` branches.
- Codex is the default writer for those branches because GitHub automation is wired around Codex PR-thread patch replies.
- Do not write concurrently with Codex on the same active autopilot branch.
- If a human explicitly wants Claude to implement on that branch, treat it as a manual takeover:
  - keep the same branch
  - do not open a second PR
  - pause Codex prompting on that branch until Claude's turn is complete

## Where Claude Adds The Most Value

- challenge or refine batch/spec scope before implementation
- review active PRs for bugs, regressions, missing tests, and rollout risks
- do risky local investigations or prototypes on non-autopilot branches
- critique UI structure, copy, accessibility, and color decisions

## UI and Color Work

- Use `skill.color-expert` when the task is about palette direction, contrast, theme systems, expressive color usage, or visual harmonization.
- Keep Finance-OS UI intentional and non-generic; do not flatten color decisions into safe default SaaS styling.

## Output Bias

- Be concise and high-signal.
- For reviews, lead with concrete findings ordered by severity.
- Respect repo invariants: demo/admin split, `exactOptionalPropertyTypes`, secret-safe logging, and no secret-bearing `VITE_*`.
