# Security Context Pack — Finance-OS

> Auto-generated. Source: AGENTS.md invariants
> Do not edit directly — regenerate with `pnpm agent:context:pack`

## Non-Negotiable Rules

- Never put secrets in VITE_* (client-exposed)
- Never log Powens codes, tokens, cookies, or PII
- Encrypt sensitive tokens at rest
- exactOptionalPropertyTypes enabled
- x-request-id propagation end-to-end
- Error payloads must be normalized and safe to expose
- Public traffic terminates on apps/web only

## Review Priorities

- P0: secret leak, token exposure, data loss, broken demo/admin split
- P1: contract regression, missing demo path, unsafe logging
- P2: style/cleanup
