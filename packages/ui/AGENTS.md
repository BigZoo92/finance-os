# AGENTS.md - packages/ui

Scope: `packages/ui/**`

## Local Rules

- Keep this package focused on reusable presentational primitives, utility exports, and shared styles.
- Maintain accessible semantics, keyboard support, and SSR-safe components.
- Do not move app-specific queries, auth logic, or Finance-OS business rules into shared UI primitives.
- Shadcn is the baseline, not the finish line. Shared primitives should stay clean enough for the premium dashboard bar set in [../../docs/agentic/ui-quality-map.md](../../docs/agentic/ui-quality-map.md).

## Verify

- `pnpm --filter @finance-os/ui typecheck`
- `pnpm web:build` when shared UI changes affect app rendering

## Pitfalls

- Keep exported component names stable unless all call sites are updated in the same change.
