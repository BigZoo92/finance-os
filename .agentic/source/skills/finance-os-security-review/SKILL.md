---
name: finance-os-security-review
description: Perform a Finance-OS threat-focused review of auth, secrets, providers, logs, storage, SSR, or dependencies. Use when trust boundaries or sensitive financial data change, or when the user requests a security review.
---

# Security review

## Threat model first

Map browser, web SSR, API, worker, database, Redis, internal services, and each provider. Mark credentials, signed state, cookies, encrypted tokens, raw payloads, and trust transitions.

## Mandatory checks

- Demo cannot reach DB, Redis, providers, or mutations through alternate branches.
- Admin/internal guards match the caller; callback state is signed, scoped, short-lived, and timing-safe.
- Secrets never enter `VITE_*`, client bundles, browser forms, URLs, logs, fixtures, errors, prompts, or analytics.
- Sensitive tokens are encrypted at rest with the existing envelope and keys are validated server-side.
- Logs and normalized errors redact query parameters, headers, bodies, provider payloads, SQL, and stacks.
- Fetch destinations, redirects, file paths, and provider allowlists resist injection/SSRF/traversal.
- External investment adapters remain GET/read-only and expose no order, transfer, withdrawal, convert, margin, or staking mutation.
- Dependency or static-analysis findings are verified against reachable code before severity is assigned.

## Output

Lead with exploitable P0/P1 findings, each with evidence, attack path, impact, and smallest remediation. Note checked areas with no finding. Never paste live secret values into the report.

Use targeted tests for guard bypass, tampered state, redaction, allowlists, and demo isolation; then run the relevant package checks.
