# AGENTS.md - packages/prelude

Scope: `packages/prelude/**`

## Local Rules

- Keep helpers here low-level, side-effect light, and reusable across apps and packages.
- Do not move app-specific finance rules, Powens knowledge, or UI concerns into this package.
- Favor small, predictable utilities such as [src/errors/index.ts](src/errors/index.ts) and [src/format/index.ts](src/format/index.ts).

## Verify

- `pnpm --filter @finance-os/prelude typecheck`

## Pitfalls

- Changes here can have broad blast radius because API, worker, and web code may all consume these helpers.
