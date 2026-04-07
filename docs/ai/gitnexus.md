# GitNexus — Agent Context Layer

Locally-installed knowledge graph over the finance-os codebase.
Version pinned: `gitnexus@1.4.10` (devDependency).

## Daily Commands

| Command | Purpose |
|---|---|
| `pnpm gitnexus:analyze` | Quick re-index with skills |
| `pnpm gitnexus:analyze:full` | Full re-index with embeddings |
| `pnpm gitnexus:analyze:force` | Force full rebuild |
| `pnpm gitnexus:status` | Check index freshness |
| `pnpm gitnexus:list` | List indexed repos |
| `pnpm gitnexus:mcp` | Start MCP server (stdio) |
| `pnpm gitnexus:serve` | Start web UI server |
| `pnpm gitnexus:wiki` | Generate repo wiki |
| `pnpm gitnexus:clean` | Delete local index |
| `pnpm gitnexus:sync-generated-skills` | Sync `.claude/skills/generated` → `.agents/skills/generated` |

## Refresh Index

After structural changes (new modules, renamed files, major refactors):
```sh
pnpm gitnexus:analyze
pnpm gitnexus:sync-generated-skills
```

After re-index, GitNexus auto-overwrites `AGENTS.md` and `CLAUDE.md`.
**Always restore them** or use `git checkout -- AGENTS.md CLAUDE.md` after analysis.

## Generated Skills

GitNexus produces repo-specific skills under `.claude/skills/generated/` (domain clusters like `dashboard`, `auth`, `routes`, `domain`, etc.) and `.claude/skills/gitnexus/` (usage guides).

Run `pnpm gitnexus:sync-generated-skills` to mirror both into `.agents/skills/`.

## MCP Integration

### Codex
Config: `.codex/config.toml` — `gitnexus` server using `npx gitnexus@1.4.10 mcp`.

### Claude Code
Config: `.mcp.json` — project-scoped `gitnexus` MCP server.

### Available MCP Tools

| Tool | When to Use |
|---|---|
| `query` | Search execution flows for a concept |
| `context` | 360-degree view of a symbol (callers, callees, processes) |
| `impact` | Blast radius before changing a symbol |
| `augment` | Enrich a search pattern with graph context |

### MCP Resources

| Resource | Content |
|---|---|
| `gitnexus://repos` | All indexed repos |
| `gitnexus://repo/{name}/context` | Repo overview + key symbols |
| `gitnexus://repo/{name}/clusters` | Community/domain map |
| `gitnexus://repo/{name}/processes` | Detected execution flows |

### MCP Prompts

| Prompt | Purpose |
|---|---|
| `detect_impact` | Impact analysis before refactor |
| `generate_map` | Architecture map generation |

## Agent Workflow

1. **Explore first** — use `context` tool or `gitnexus://repo/finance-os/clusters` to understand the area
2. **Impact analysis before big changes** — `impact <symbol>` or `detect_impact` prompt
3. **Architecture maps** — `generate_map` prompt for visual overview
4. **Search by concept** — `query "payment reconciliation"` to find relevant flows
5. **Refresh after structural changes** — `pnpm gitnexus:analyze && pnpm gitnexus:sync-generated-skills`
6. **Use generated skills** — domain skills in `.claude/skills/generated/` provide per-zone context
