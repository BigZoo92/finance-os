# Powens package instructions

Scope: `packages/powens/**`.

- Keep the package server-only: auditable client behavior, crypto helpers, and typed job payloads.
- Never log codes, tokens, client secrets, decrypted values, or raw payloads.
- Preserve encryption compatibility unless a coordinated data migration covers API, worker, DB, tests, and operations.
- Keep timeouts/retries explicit and bounded; parse provider payloads and job JSON defensively.
- Queue names and types are shared contracts—update producers and consumers together.

Verify package typecheck and focused client/crypto/job tests; review `docs/integrations.md` for operator-visible changes.
