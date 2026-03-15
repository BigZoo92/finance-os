# AGENTS.md - packages/db

Scope: `packages/db/**`

## Local Rules

- Keep this package as the source of truth for schema and DB client exports.
- Add new migrations for shipped schema changes; do not rewrite existing migrations casually.
- Preserve Powens uniqueness and indexing guarantees in [src/schema/powens.ts](src/schema/powens.ts); these are part of sync idempotence and dashboard performance.
- Keep exported schema names stable unless the whole call chain is updated in the same change.

## Verify

- `pnpm --filter @finance-os/db typecheck`
- `pnpm db:generate` when schema changes
- `pnpm db:migrate` when verifying new migrations locally

## Pitfalls

- Schema changes often require matching updates in [../env/AGENTS.md](../env/AGENTS.md), [../../docs/agentic/contracts-map.md](../../docs/agentic/contracts-map.md), and [../../docs/agentic/testing-map.md](../../docs/agentic/testing-map.md).
