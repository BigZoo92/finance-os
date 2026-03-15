# AGENTS.md - packages/redis

Scope: `packages/redis/**`

## Local Rules

- Keep this package as a thin Redis client factory with explicit lifecycle methods.
- Avoid hidden globals, background behavior, or retry loops that change the semantics of API or worker callers.
- Preserve connection open/close behavior expected by [../../apps/api/src/index.ts](../../apps/api/src/index.ts) and [../../apps/worker/src/index.ts](../../apps/worker/src/index.ts).

## Verify

- `pnpm --filter @finance-os/redis typecheck`

## Pitfalls

- Connection semantics here directly affect request handling, worker shutdown, locks, and rate limits.
