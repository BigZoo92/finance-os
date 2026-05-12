# FINANCE-OS-CONTEXT — archive marker

This file is an intentional placeholder for the legacy "monolithic external-chat
context pack". It is registered in `scripts/agent-context/lib.mjs` under the
`archive` tier and **must never be auto-loaded** by any agent runtime.

If you need the full project context for an external chat tool, regenerate it
manually from `docs/context/*.md`. Do not commit large generated dumps here —
this entry exists only so the agent-context registry stays self-consistent with
the file tree (see `scripts/agent-context/agent-context.test.mjs`).
