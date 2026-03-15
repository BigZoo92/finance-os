---
name: powens-safety-review
description: Review Powens, auth-state, token, callback, encryption, and logging changes for Finance-OS. Use when API, worker, env, DB, or shared Powens package changes can affect provider security or callback correctness.
---

# Powens Safety Review

## Trigger

- Use for Powens callback, connect, sync, token storage, worker sync, or encryption changes.
- Use when env or schema changes affect Powens secrets, redirect URIs, or encrypted token persistence.

## Inputs

- Changed Powens-related files
- Expected callback and sync flow
- Logging and storage surfaces touched

## Output

- Produce a security review note with:
- findings by severity
- token and code exposure check
- storage and encryption check
- callback auth-state check
- manual verification notes

## Workflow

1. Read [../../../packages/powens/AGENTS.md](../../../packages/powens/AGENTS.md), [../../../apps/api/AGENTS.md](../../../apps/api/AGENTS.md), and [../../../apps/worker/AGENTS.md](../../../apps/worker/AGENTS.md).
2. Verify Powens codes and tokens are never logged, echoed, or exposed in browser-facing payloads.
3. Verify encrypted token handling still uses [../../../packages/powens/src/crypto.ts](../../../packages/powens/src/crypto.ts) and storage in [../../../packages/db/src/schema/powens.ts](../../../packages/db/src/schema/powens.ts).
4. Verify callback auth remains admin session or valid signed state, and worker sync stays isolated and idempotent.

## Trigger Examples

- "Review this Powens callback patch for token leakage, signed-state mistakes, and encryption drift."
- "Check whether this worker sync change still isolates failures per connection and avoids unsafe logs."

## Verification

- Use [../../../docs/powens-mvp.md](../../../docs/powens-mvp.md) and [../../../docs/agentic/contracts-map.md](../../../docs/agentic/contracts-map.md) for flow expectations.
- Use [../../../docs/agentic/testing-map.md](../../../docs/agentic/testing-map.md) to call out missing automated coverage.
