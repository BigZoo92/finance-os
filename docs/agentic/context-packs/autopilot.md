# Autopilot Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md autopilot section
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Autopilot Workflow

- batch: issues are first-class product briefs
- Spec expansion: 1:1 with raw bullet list, no extra specs
- One implementation lane auto-starts at a time
- Implementation PRs: draft agent/impl-* branches
- Patch contract: AUTOPILOT_PATCH_V1, exactly one diff fence
- PR-thread patches must pass git apply --check
- Merge-on-green: requires real non-stub files, no agent stubs, green CI
- CI failures summarized back to PR thread
- One writer per active branch (Codex or human/Claude, not both)

## Context Budget (new)

- Every batch/spec/improve prompt should declare a context budget tier
- Use context packs instead of copying full docs
- Available tiers: small (8K), medium (16K), large (32K), xlarge (64K), autonomous (128K)
