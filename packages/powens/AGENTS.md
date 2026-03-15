# AGENTS.md - packages/powens

Scope: `packages/powens/**`

## Local Rules

- Keep this package server-only. It owns the Powens client, crypto helpers, and queue payload types used by API and worker code.
- Never add logging of Powens auth codes, access tokens, client secrets, or decrypted payloads.
- Preserve encryption compatibility in [src/crypto.ts](src/crypto.ts) unless a coordinated migration is implemented across API, worker, DB data, and docs.
- Keep client behavior deterministic and explicit: retries, timeouts, and payload parsing should remain easy to audit.

## Verify

- `pnpm --filter @finance-os/powens typecheck`

## Pitfalls

- Changes here usually require review against [../../docs/powens-mvp.md](../../docs/powens-mvp.md), [../../docs/agentic/contracts-map.md](../../docs/agentic/contracts-map.md), and [../../apps/api/AGENTS.md](../../apps/api/AGENTS.md).
