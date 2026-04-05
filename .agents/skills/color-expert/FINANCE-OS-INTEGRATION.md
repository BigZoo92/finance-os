# Finance-OS integration

Canonical upstream source: `https://github.com/meodai/skill.color-expert`

Vendored from upstream commit:

- `b9aa298a7dafcedd651cb3338a444d28aa39e924`

Installer attempt status:

- `npx skills add meodai/skill.color-expert` was attempted on 2026-04-04.
- In this environment it entered an interactive agent-selection flow and did not complete a deterministic repo install.
- Finance-OS therefore vendors the skill directly under `.agents/skills/color-expert/` so the project keeps a stable canonical copy.

Local policy:

- Keep `.agents/skills/color-expert/` as the canonical repo-managed copy.
- The Claude Code wrapper under `.claude/skills/color-expert/` should point back to this canonical copy instead of maintaining a second full mirror.
- When updating, refresh this folder from upstream first, then verify the Claude wrapper still points at the correct paths.

Recommended update flow:

1. Re-run `npx skills add meodai/skill.color-expert` if the CLI becomes usable in non-interactive mode for your setup.
   Expected result: the canonical skill files under `.agents/skills/color-expert/` are refreshed without needing a second mirror elsewhere in the repo.
2. Or re-clone/pull the upstream repo and sync its contents into `.agents/skills/color-expert/`.
3. Re-check `CLAUDE.md`, `SKILL.md`, and `references/INDEX.md` for any path or trigger changes.
