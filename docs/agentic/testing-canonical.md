# Canonical Testing Guide

> Canonical source for verification strategy, test layering, and required evidence.

## Document Template (Required)

1. Test layers and ownership
2. Scope-based command ladder
3. **Demo/Admin dual-path**
4. **Observability & Safety**
5. **UI/UX state matrix**
6. Evidence requirements
7. Rollback / kill-switch

## Test Layers and Ownership

- Unit and module checks near changed packages/apps.
- Contract checks for API route behavior.
- Smoke checks for deploy/runtime topology.
- Manual UX checks for user-visible state transitions.

## Scope-Based Command Ladder

Start small, then widen:

1. Focused tests for changed area.
2. Python service checks when `apps/knowledge-service` changes: isolated venv install, `python -m pytest apps/knowledge-service/tests`, and compile/import checks.
3. `pnpm lint` and `pnpm typecheck`.
4. `pnpm -r --if-present test`.
5. `pnpm check:ci`.
6. `scripts/smoke-api.mjs` / `scripts/smoke-prod.mjs` for route and release-sensitive work.

## Demo/Admin Dual-Path (Required)

- Explicitly assert demo short-circuits and deterministic fixtures.
- Explicitly assert admin authenticated reads/writes and safe degraded behavior.
- Include one fail-soft assertion when upstream/provider data is unavailable.

## Observability & Safety (Required)

- **Request ID propagation:** tests/checks should validate request id continuity in failures.
- **Logging redaction rules:** verify no sensitive fields are emitted.
- **Normalized error contract:** verify safe, stable error payload shape.
- **Health/smoke verification expectations:** document which smoke command proves route health.

## UI/UX State Matrix (Required for UI-facing features)

| Mode | Loading | Empty | Error | Degraded | Fallback copy |
| --- | --- | --- | --- | --- | --- |
| Demo | Required | Required | Required | Required | Required |
| Admin | Required | Required | Required | Required | Required |

## Evidence Requirements

- Capture exact command outputs in PR notes.
- Mark environment limitations clearly when a command cannot run.
- Tie manual checks to the touched feature state matrix.

## Rollback / Kill-Switch

- Revert migration commits if test/docs drift causes ambiguity.
- Keep deprecation stubs active through one release cycle.
