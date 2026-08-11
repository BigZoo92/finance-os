# Claude Code

Read `AGENTS.md` and the nearest nested `AGENTS.md` before acting. Shared product rules are not duplicated here.

- Claude project skills are generated under `.claude/skills`; select the matching Finance-OS skill by its frontmatter description.
- Edit skills only in `.agentic/source/skills`, then run `pnpm agent:skills:sync` and `pnpm agent:skills:check`.
- Use GitNexus for execution-flow discovery, impact before symbol edits, and final change detection. Refresh only with `pnpm gitnexus:analyze`.
- Keep changes scoped, preserve existing working-tree edits, and report validation evidence plus any unrun checks.
- Do not install or vendor community skill collections. The repository intentionally supports Claude and Codex only.
