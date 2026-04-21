# Canonical Architecture Guide

> Canonical source for Finance-OS architecture guidance. Keep this page authoritative and move duplicated architecture notes here.

## Document Template (Required)

Use this section order for architecture/flow docs:

1. Purpose and scope
2. Runtime entrypoints and boundaries
3. Data flow and contracts
4. **Demo/Admin dual-path**
5. **Observability & Safety**
6. **UI/UX state matrix** (if user-facing)
7. Verification and smoke checks
8. Rollback / kill-switch

## Purpose and Scope

This guide defines the runtime topology and layering boundaries that every architecture or flow update must preserve.

## Runtime Entrypoints and Boundaries

- Public ingress: `apps/web` only; `/api/*` is proxied internally.
- API runtime: `apps/api/src/index.ts`.
- Web runtime: `apps/web/src/routes/__root.tsx`.
- Worker runtime: `apps/worker/src/index.ts`.
- Desktop wrapper: `apps/desktop/src-tauri/src/main.rs`.

## Data Flow and Contracts

- Route handlers parse HTTP and enforce response contracts.
- Domain modules orchestrate business workflows.
- Repository modules own persistence and read models.
- Service modules integrate providers and external side effects.
- Feature docs must link to the owning contract and canonical testing/release pages.

## Demo/Admin Dual-Path (Required)

Every architecture/flow doc must explicitly capture both paths:

### Demo path

- Deterministic mock-backed behavior only.
- No provider calls.
- No DB writes/reads unless explicitly mocked in-memory.
- UI remains fully usable with safe, static data.

### Admin path

- Enabled only behind authenticated admin state.
- DB/provider interactions are allowed only through established route/domain/repository boundaries.
- Any privileged mutation must include normalized error handling and request tracing.

### Fail-soft fallback

- If provider or DB dependencies degrade, continue serving the last safe response shape with clear fallback messaging.
- Never block core cockpit navigation due to one failing integration.

## Observability & Safety (Required)

Every architecture/flow doc must include:

- **Request ID propagation:** `x-request-id` generated/preserved at entry and threaded through logs.
- **Logging redaction rules:** no Powens tokens/codes, no secrets, structured logs only.
- **Normalized error contract:** public errors must be safe, stable, and include request id.
- **Health/smoke verification expectations:** list exact smoke checks (`/health`, `/auth/me`, `/dashboard/summary`, provider status endpoints when applicable).

## UI/UX State Matrix (Required for user-facing flows)

When a flow drives UI, include all state rows below:

| Mode | Loading | Empty | Error | Degraded | Fallback copy |
| --- | --- | --- | --- | --- | --- |
| Demo | Required | Required | Required | Required | Required |
| Admin | Required | Required | Required | Required | Required |

The matrix must define deterministic demo behavior and a non-blocking admin degraded path.

## Verification and Smoke Checks

- Baseline: `pnpm check:ci`.
- Scope checks: `pnpm lint`, `pnpm typecheck`, `pnpm -r --if-present test`.
- Route-sensitive changes: `node scripts/smoke-api.mjs` and `node scripts/smoke-prod.mjs`.

## Rollback / Kill-Switch

- Revert migration commits if context or links drift.
- Keep redirect/deprecation stubs for at least one release cycle.
- Validate relevant kill-switches before rollout completion.
