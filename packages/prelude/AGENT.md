# AGENT.md - `packages/prelude`

Last updated: 2026-02-22.

This file defines rules for the shared `@finance-os/prelude` package.

## 1) Purpose

`prelude` hosts small shared utilities used by multiple workspaces.

Current focus:

- `errors`: safe error normalization helpers
- `format`: compatibility facade that currently re-exports error helpers

## 2) Package design rules

- Keep modules small, deterministic, and framework-agnostic.
- No dependency on app-level runtime code (`apps/*`).
- Avoid large transitive dependency additions.
- Keep module boundaries clear (`errors`, `format`, future modules as needed).
- Avoid circular dependencies between submodules.

## 3) Export and import conventions

- Maintain explicit exports in `package.json`.
- Preferred imports:
- `@finance-os/prelude/errors`
- `@finance-os/prelude`
- Compatibility import `@finance-os/prelude/format` may remain supported but should not be the default for new code.

## 4) Change policy

- If moving utilities between modules, keep backwards compatibility where feasible.
- If a breaking export change is unavoidable, update all consumers in the same patch.
- Keep naming semantic and stable (`toSafeErrorMessage`, etc.).

## 5) Validation expectations

For prelude changes run:

- `pnpm --filter @finance-os/prelude typecheck`

If consumers were updated, also run typecheck for those workspaces.
