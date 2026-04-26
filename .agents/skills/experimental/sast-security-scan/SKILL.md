<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/experimental/sast-security-scan/SKILL.md
     Hash:   sha256:1d51f93b031a64df
     Sync:   pnpm agent:skills:sync -->

---
name: sast-security-scan
description: "EXPERIMENTAL -- Static Application Security Testing scanner detecting 13 vulnerability classes. Use for periodic security audits, pre-release security reviews, or targeted vulnerability hunting."
---

# SAST Security Scan

> **EXPERIMENTAL** -- Adapted from utkusen/sast-skills (529 stars). Useful for periodic audits but treat findings as leads, not verdicts. Always verify findings manually before acting on them. False positives are expected.

## When to Use

- Pre-release security audit
- Targeted vulnerability hunting after a security concern
- Periodic codebase security review
- When `security-and-hardening` flags something that needs deeper investigation
- After adding new external integrations or auth flows

## When NOT to Use

- Routine code changes (use `code-review` skill instead)
- Performance optimization
- UI/styling changes

## 3-Phase Workflow

### Phase 1: Analyze Codebase

Map the attack surface before scanning:

1. **Entry points**: List all API routes, webhooks, callbacks, SSR loaders
2. **Trust boundaries**: client (browser) --> web (TanStack Start) --> API (Elysia) --> worker --> DB --> external APIs (Powens, news providers)
3. **Data handlers**: user input, API responses, DB queries, file operations, env vars
4. **Auth boundaries**: public routes, admin routes, internal-token routes, demo paths
5. **Sensitive data flows**: tokens, credentials, PII, financial data

### Phase 2: Vulnerability Detection

Scan for these 13 vulnerability classes, each with Finance-OS-specific checks:

#### 1. Injection (SQL, Command, Template)

**What to find:**
- String concatenation in SQL queries
- `sql.raw()` with variable input
- Template literal injection in `db.execute()`
- Command injection via `child_process` or `exec`

**Finance-OS check:**
- All `db.execute(sql\`...\`)` calls use parameterized tagged templates
- No `sql.raw()` with user-controlled input
- CTE bulk updates use `JSON.stringify()` for data, not string interpolation

**Severity:** Critical if user input reaches SQL; High if internal data.

#### 2. Cross-Site Scripting (XSS)

**What to find:**
- `dangerouslySetInnerHTML` without sanitization
- Unescaped output in SSR (TanStack Start loaders)
- URL construction with user input (`javascript:` protocol)
- SVG injection

**Finance-OS check:**
- React auto-escapes by default -- look for explicit bypasses
- SSR-rendered data from external providers (Powens, news) is escaped

**Severity:** High if user-facing; Medium if admin-only.

#### 3. Cross-Site Request Forgery (CSRF)

**What to find:**
- State-changing operations without CSRF tokens
- Missing `SameSite` attribute on cookies
- OAuth/callback flows without state validation

**Finance-OS check:**
- Powens callback validates HMAC state parameter with TTL
- Session cookies use `SameSite=Lax` or `Strict`

**Severity:** High for financial operations; Medium for read-only state changes.

#### 4. Authentication Bypass

**What to find:**
- Missing auth middleware on protected routes
- Role/privilege confusion
- JWT validation gaps (missing expiry check, algorithm confusion)
- Session fixation

**Finance-OS check:**
- All admin routes use `requireAdmin` or `requireAdminOrInternalToken`
- Debug endpoints (`/debug/*`) require admin authentication
- Demo path never reaches real DB or provider calls

**Severity:** Critical if bypasses auth entirely; High if elevates privilege.

#### 5. Insecure Cryptography

**What to find:**
- Weak algorithms (MD5, SHA1 for security, DES, RC4)
- Hardcoded keys, IVs, or salts
- Insufficient key derivation iterations
- ECB mode usage

**Finance-OS check:**
- Token encryption: AES-256-GCM (verify algorithm, not AES-CBC)
- Key derivation: PBKDF2-SHA256 with 210,000 iterations minimum
- No hardcoded encryption keys in source (must come from env)

**Severity:** Critical if protecting credentials; High for other sensitive data.

#### 6. Information Disclosure

**What to find:**
- Stack traces in error responses
- Database column/table names in errors
- Debug endpoints accessible without auth
- Verbose error messages with internal details
- Source maps in production

**Finance-OS check:**
- Error responses use safe error codes/messages, not raw errors
- `/debug/metrics` endpoint requires admin auth
- Logger calls do not include tokens, passwords, or PII
- `safeErrorCode`/`safeErrorMessage` fields used for user-facing errors

**Severity:** Medium for internal details; Low for generic info.

#### 7. Server-Side Request Forgery (SSRF)

**What to find:**
- User-controlled URLs in server-side HTTP requests
- URL construction from external data without validation
- DNS rebinding vectors

**Finance-OS check:**
- Powens API base URL is from env config, not user input
- Callback URLs are validated against allowlist
- No open redirects

**Severity:** High if can reach internal services; Medium if limited to external.

#### 8. Path Traversal

**What to find:**
- File path construction with user input
- `../` sequences not sanitized
- File upload destination based on user input

**Finance-OS check:**
- Minimal file operations -- primarily a data API
- Migration folder path from env, not user input

**Severity:** High if reaches filesystem; Low if no file operations.

#### 9. Race Conditions

**What to find:**
- Time-of-check-to-time-of-use (TOCTOU) patterns
- Concurrent access to shared state without locks
- Double-spend potential in financial operations

**Finance-OS check:**
- Recompute operations use `pg_try_advisory_lock` for singleton coordination
- Redis lock acquisition in worker for sync operations
- Upserts use `onConflictDoUpdate` (atomic, not check-then-insert)

**Severity:** High for financial operations; Medium for operational state.

#### 10. Hardcoded Secrets

**What to find:**
- API keys, tokens, passwords in source code
- Secrets in `VITE_*` env vars (exposed to client bundle)
- Default credentials
- Private keys or certificates in the repo

**Finance-OS check:**
- Scan all `VITE_*` definitions -- none should contain secrets
- Scan for patterns: `password`, `secret`, `apiKey`, `token`, `private_key` in source
- Check `.env.example` for actual secret values (should be placeholders)
- Verify `accessTokenEncrypted` is actually encrypted, not just base64

**Severity:** Critical for production credentials; High for any secret in source.

#### 11. Insecure Deserialization

**What to find:**
- `JSON.parse()` on untrusted input without validation
- `eval()` or `new Function()` with external data
- Prototype pollution via object spread from untrusted sources

**Finance-OS check:**
- Webhook/callback payloads validated with Zod schemas before use
- `JSON.parse()` wrapped in try/catch with typed validation after
- No `eval()` usage

**Severity:** High if leads to code execution; Medium for data corruption.

#### 12. Insufficient Logging

**What to find:**
- Auth events (login, logout, failed attempts) not logged
- Data mutations not logged
- Missing request context (request ID, user ID)
- Sensitive operations without audit trail

**Finance-OS check:**
- Sync events (start, success, failure) are logged with request ID
- Auth failures are logged
- Recompute operations log start/end with row counts
- All API events use structured JSON logging

**Severity:** Medium for missing auth logs; Low for missing operational logs.

#### 13. Broken Access Control

**What to find:**
- Demo path accessing admin resources
- Missing authorization checks after authentication
- Horizontal privilege escalation
- Direct object reference without ownership check

**Finance-OS check:**
- `demoOrReal()` path correctness -- demo never reaches DB or provider
- Admin features not accessible from public app
- Single-user app: verify there are no multi-tenant assumptions

**Severity:** Critical for demo-to-admin crossover; High for missing auth checks.

### Phase 3: Report

For each finding, output in this format:

```
## [SEVERITY] Title

- **Location**: file/path.ts:line
- **Class**: Vulnerability class (from the 13 above)
- **Description**: What the issue is, with the problematic code snippet
- **Impact**: What could go wrong if exploited
- **Fix**: Specific recommendation with code example
- **Finance-OS context**: Why this matters for this particular codebase
```

### Severity Levels

| Level | Definition | Response |
|-------|-----------|----------|
| **CRITICAL** | Exploitable now with known technique | Fix immediately, consider incident response |
| **HIGH** | Likely exploitable, requires specific conditions | Fix before next release |
| **MEDIUM** | Potential risk, defense-in-depth concern | Fix in near-term sprint |
| **LOW** | Theoretical risk, minimal real-world impact | Fix when convenient |

### Report Summary

End every scan with:

```
## Scan Summary

- Scope: N files analyzed, M entry points, K data flows
- Findings: X Critical, Y High, Z Medium, W Low
- False positive estimate: [Low/Medium/High]
- Recommended follow-up: [specific actions]
```

## Finance-OS Priority Scan Order

When time is limited, scan in this order:

1. **VITE_* secrets** -- scan all `VITE_*` env var definitions for secrets
2. **Token encryption** -- verify Powens tokens use AES-256-GCM at rest
3. **Callback validation** -- check HMAC state + TTL on Powens callback
4. **Logging safety** -- scan all logger calls for token/password/PII leaks
5. **Demo/admin boundary** -- verify demo path never reaches DB or provider
6. **Auth middleware** -- verify all protected routes have guards
7. **SQL parameterization** -- scan for `sql.raw()` with variable input
8. **Error exposure** -- verify error responses use safe messages only
9. **Session security** -- HttpOnly, Secure, SameSite flags on cookies
10. **Rate limiting** -- login endpoint rate limited

## Scan Methodology Notes

- This skill turns the agent into a static analyzer. It reads code, not runtime behavior.
- Network-level issues (TLS config, header injection) require dynamic testing.
- Business logic vulnerabilities (privilege escalation via valid operations) require domain knowledge beyond what static analysis provides.
- Dependency vulnerabilities are not covered -- use `npm audit` separately.
- Findings should be triaged by a human before creating issues or PRs.
