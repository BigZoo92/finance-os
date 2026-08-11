# Claude and Codex

Finance-OS maintains the smallest useful repository-local agent system: one canonical skill source and two generated projections.

```text
.agentic/source/skills/<name>/
              |
      scripts/sync-skills.mjs
         /                 \
.claude/skills/<name>/   .agents/skills/<name>/
```

Claude consumes `.claude/skills/<name>/SKILL.md`; Codex consumes `.agents/skills/<name>/SKILL.md`. Both projections are physical, byte-identical copies so they work on Windows and in Git without symlink behavior. They are generated outputs, never editing surfaces.

## Commands

```text
pnpm agent:skills:list    derive the current inventory and descriptions
pnpm agent:skills:sync    reconcile both owned projections
pnpm agent:skills:check   fail on missing, drifted, or extra entries
```

The synchronizer owns the complete `.claude/skills` and `.agents/skills` roots. It validates all canonical skills before writing, requires YAML frontmatter at byte zero, rejects links in the source and linked destination roots, refuses any target outside the two allowlisted paths, unlinks extras without following them, and does not use a manifest.

There are no Qwen/root projections, overlays, renames, exclusions, generated domain clusters, context packs, model router, skill vendor lock, or community collections.

## Adding or removing a skill

1. Create or remove one flat directory under `.agentic/source/skills`.
2. Keep `SKILL.md` concise with a kebab-case `name` equal to the directory and a discriminating `description`.
3. Include only Finance-OS-specific knowledge/workflow that materially improves Claude or Codex.
4. Put any essential resource inside that skill directory; do not duplicate repository docs.
5. Run sync, list, tests, and check.

Do not install collections "just in case." Native coding, research, and review abilities do not need generic reminder skills.

## Instructions

`AGENTS.md` contains only permanent global invariants and points to nearest local guides. `CLAUDE.md` delegates shared rules to `AGENTS.md` and contains only Claude-specific bootstrap behavior. Task-specific detail belongs in a matching skill or one of the maintained docs.

## GitNexus

GitNexus remains dynamic code intelligence. Use query/context for discovery, impact before editing symbols, graph-aware rename for refactors, and change detection before handoff.

Always refresh with `pnpm gitnexus:analyze`. The wrapper pre-syncs the canonical skill projections, accepts only the allowlisted analysis arguments, invokes GitNexus against the explicit repository root, and adds `--force` when the worktree is dirty or a missing embedding index is explicitly requested. It snapshots `AGENTS.md` and `CLAUDE.md` byte-for-byte; its `finally` path restores both and post-syncs the projections even when analysis fails. Existing embeddings are preserved automatically; `--skills` and other unsupported arguments are rejected. Static generated domain/cluster skills are not supported.

The ignored `.gitnexus/` index is derived state. It is not documentation or a canonical skill source.

## CI

Root tests exercise projection drift/extra detection, byte-zero frontmatter, safe ownership, GitNexus cleanup, and CI scope/error handling. CI runs:

```text
pnpm test
pnpm agent:skills:check
pnpm docs:check
```

These precede lint, typecheck, workspace tests, Python checks, and builds.
