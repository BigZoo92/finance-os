---
name: gitnexus-workflow
description: Use the Finance-OS GitNexus graph for discovery, impact analysis, debugging, refactoring, and final scope verification. Use before editing code symbols or when tracing unfamiliar cross-file behavior.
---

# GitNexus workflow

GitNexus is dynamic code intelligence, not a second documentation or skill generator.

## Choose the operation

- Explore a concept: query for the behavior or symptom, then inspect the returned execution flows.
- Understand one symbol: request its context for callers, callees, modules, and process participation.
- Before editing: run upstream impact for every function, class, or method. Review all depth-1 dependents.
- Debug: query the symptom, inspect suspect context, then read the relevant process trace.
- Rename: use graph-aware rename in dry-run mode, review text-search edits, then apply.
- Before handoff: detect all working-tree changes and confirm the affected flows match the intended scope.

Warn before editing when risk is HIGH or CRITICAL. If a script or configuration symbol is not indexed, report that and perform a manual reference/CI blast-radius search.

## Index lifecycle

- Use `pnpm gitnexus:analyze`; do not run raw `gitnexus analyze` because upstream GitNexus writes competing agent files.
- The wrapper preserves existing embeddings, removes GitNexus-owned instruction blocks, and restores the canonical Claude/Codex skill projections.
- Never use `--skills`; static generated domain skills are intentionally unsupported.
- The index lives in ignored `.gitnexus/` and is derived state, never a source of truth.

Do not replace code reading or tests with graph confidence. The graph narrows the search and makes blast radius explicit.
