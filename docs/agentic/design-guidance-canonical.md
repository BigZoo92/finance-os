# Canonical Design Guidance

> Canonical source for UI quality expectations, state coverage, and frontend review standards.

## Document Template (Required)

1. Feature intent and UX scope
2. Design-system and accessibility constraints
3. **Demo/Admin dual-path**
4. **Observability & Safety**
5. **State matrix (required)**
6. Verification evidence (screenshots + checks)
7. Rollback / kill-switch

## Feature Intent and UX Scope

- Define the user-facing objective and primary decision moments.
- Link to owning route/component modules.

## Design-System and Accessibility Constraints

- Use Aurora Pink tokens and canonical components.
- Preserve keyboard access, semantic landmarks, and reduced-motion behavior.
- Keep financial figures in `.font-financial`.

## Demo/Admin Dual-Path (Required)

### Demo path

- Deterministic mock state only.
- Sensitive actions disabled or clearly labeled read-only.

### Admin path

- Auth-gated actions and live data states.
- Recoverable error paths with explicit request-id support copy where relevant.

### Fail-soft fallback

- Feature stays readable and actionable even when provider/API segments degrade.

## Observability & Safety (Required)

- **Request ID propagation:** failed UI actions should surface request-id-friendly support affordances.
- **Logging redaction rules:** no sensitive payloads in client or server logs.
- **Normalized error contract:** UI renders safe, normalized errors.
- **Health/smoke verification expectations:** include relevant UI smoke/manual checks tied to route health.

## State Matrix (Required)

| Mode | Loading | Empty | Error | Degraded | Fallback copy expectation |
| --- | --- | --- | --- | --- | --- |
| Demo | Required | Required | Required | Required | Required |
| Admin | Required | Required | Required | Required | Required |

Every UI feature document must fill all cells with explicit behavior notes.

## Verification Evidence (Screenshots + Checks)

- Include screenshot notes for success, degraded, and error/retry states.
- Run smallest-scope checks first, then escalate to `pnpm check:ci` when needed.

## Rollback / Kill-Switch

- Revert UI doc migration commits if state detail is lost.
- Keep moved-link stubs during one release cycle to avoid broken references.
