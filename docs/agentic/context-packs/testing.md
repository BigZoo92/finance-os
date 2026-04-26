# Testing Context Pack — Finance-OS

> Auto-generated. Source: docs/agentic/testing-canonical.md
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Verification Commands

- `pnpm check:ci` — auto-scoped CI checks
- `pnpm lint` — Biome linter
- `pnpm typecheck` — TypeScript checking across all packages
- `pnpm -r --if-present test` — run all tests
- `pnpm -r --if-present build` — build all packages
- `pnpm smoke:api` / `pnpm smoke:prod` — smoke tests

## Key Rules

- Behavior changes require test evidence
- Demo and admin paths both need test coverage
- UI changes require screenshot notes
- Worker tests must cover idempotency and fail-soft
