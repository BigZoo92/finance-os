---
name: finance-os-powens
description: Change the Powens bank-aggregation boundary safely. Use for connect/callback flows, signed state, callback codes, encrypted provider tokens, connection lifecycle, Powens routes, client calls, or Powens sync jobs.
---

# Powens integration

Read `apps/api/AGENTS.md` and `packages/powens/AGENTS.md`.

## Trust boundary

- `createPowensClient` requests run through the shared provider policy (`@finance-os/provider-runtime/policy`): `timeoutMs` per attempt, `maxRetries` transient retries (408/429/5xx and network errors) with exponential jittered backoff, and an optional `signal` for cancellation. Do not reintroduce manual retry loops.
- Demo never calls Powens, Redis, or the database.
- Connect and callback are admin-only except for a valid short-lived signed callback state.
- The state implementation is `apps/api/src/auth/powens-state.ts`: it is signed with `AUTH_SESSION_SECRET`, contains `admin` and `exp`, and uses timing-safe verification. Do not invent nonce/user fields without changing the contract and tests.
- Callback codes are exchanged in memory and never persisted. Provider tokens are encrypted before persistence. Never log callback query values or return codes or tokens to the browser.
- Respect `EXTERNAL_INTEGRATIONS_SAFE_MODE` and existing audit events.

## Workflow

1. Trace the route through `apps/api/src/routes/integrations/powens/` and `packages/powens/`.
2. Run impact analysis on the route/service/client symbols.
3. Preserve the real connection status vocabulary from schemas and repositories; do not copy historical status names.
4. Enqueue typed jobs through `POWENS_JOB_QUEUE_KEY` (`powens:jobs`) and the existing serializer.
5. Propagate the request ID into provider calls and jobs; sanitize provider errors.

## Verification

Test expired/tampered state, demo blocking, safe-mode blocking, authenticated and signed-state callback paths, redacted logs, encryption round-trips, and provider failure fallback. Start with `apps/api/src/auth/powens-state.test.ts` and integration route tests.
