# AGENTS.md - packages/env

Scope: `packages/env/**`

## Local Rules

- Keep [src/index.ts](src/index.ts) as the single source of truth for env parsing and validation across API, web SSR, and worker.
- Secrets stay server-only unless they are explicitly safe for browser exposure. Never move secrets into `VITE_*`.
- Keep server-side Powens control flags such as `SYNC_STATUS_PERSISTENCE_ENABLED` out of the public runtime path; kill-switches that affect DB/worker writes must remain API/worker env only unless the task explicitly adds a safe browser-facing mirror.
- Make production-only requirements explicit in validation instead of relying on deploy folklore.
- When env contracts change, update `.env.prod.example`, deploy docs, and the relevant `docs/agentic/*.md` entry points in the same change.

## Verify

- `pnpm --filter @finance-os/env typecheck`

## Pitfalls

- Keep auth and Powens key validation aligned with the actual runtime consumers in `apps/api`, `apps/web`, and `apps/worker`.
- Avoid duplicate env parsing logic outside this package unless there is a strong runtime reason.
