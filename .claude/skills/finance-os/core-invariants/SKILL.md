<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/finance-os/core-invariants/SKILL.md
     Hash:   sha256:4e57c12583ca187d
     Sync:   pnpm agent:skills:sync -->

---
name: finance-os-core-invariants
description: "Finance-OS foundational invariants — dual-path demo/admin, security, privacy, logging, observability. MUST be loaded before any code change touching auth, routes, env vars, or data access."
---

# Finance-OS Core Invariants

## When to use
- Before ANY code change that touches auth, routes, middleware, env vars, data access, or logging
- When reviewing PRs for security, privacy, or architectural compliance
- When onboarding to the codebase

## When NOT to use
- Pure UI/styling changes with no data or auth implications
- Documentation-only changes

---

## 1. Dual-Path Demo / Admin

Every feature MUST work in both modes. No exceptions.

| | Demo | Admin |
|---|---|---|
| Data source | Deterministic mocks only | Real DB + providers |
| DB access | NEVER | Full |
| Provider calls | NEVER | Full |
| Auth | Cookie absent or invalid | Valid session cookie |
| Writes | Disabled / no-op | Full CRUD |

**Pattern**: Use `demoOrReal()` to branch. Demo path returns mock data; admin path hits repositories.

```typescript
// Correct
const data = demoOrReal(
  () => mockDashboardSummary(range),    // demo
  () => dashboardRepository.summary(range) // admin
);

// WRONG — never do this
if (isDemo) return mockData;
return db.query(...); // demo path could reach here on edge cases
```

**Checklist**:
- [ ] Every new route/endpoint has both demo and admin paths
- [ ] Demo path never imports from `packages/db` or `packages/powens`
- [ ] Mock data is deterministic (same input = same output)
- [ ] UI shows no flash when transitioning between modes

---

## 2. Privacy by Design

### Secrets
- **NEVER** put secrets in `VITE_*` env vars (exposed to client bundle)
- Tokens encrypted AES-256-GCM at rest (format: `v1:base64(iv):base64(authTag):base64(encrypted)`)
- `APP_ENCRYPTION_KEY` must be exactly 32 bytes (raw, hex, or base64)
- `AUTH_SESSION_SECRET` minimum 32 bytes

### Logging
- JSON structured logging only — no `console.log`
- **NEVER** log: tokens, passwords, session secrets, encryption keys, PII, full request/response payloads
- Safe payload pattern: log IDs, status codes, durations, error messages — not values

```typescript
// CORRECT
logger.info({ userId: user.id, action: 'sync', duration: 342 });

// WRONG
logger.info({ user, token: accessToken, body: req.body });
```

### Cache Control
- `Cache-Control: no-store` on all sensitive routes (auth, tokens, account data)
- Never cache admin-only responses in shared caches

---

## 3. Fail-Soft

Widgets and features fail independently. The app degrades gracefully, never crashes entirely.

**Fallback chain**: `live → cache → demo` (configurable via `FAILSOFT_SOURCE_ORDER`)

- Stale data is preferred over missing data
- Each widget declares its own error boundary
- Degraded state is visually distinct (not hidden)
- Policy is toggleable via `FAILSOFT_POLICY_ENABLED`

---

## 4. Observability

- `x-request-id` propagated end-to-end (client → web → API → worker)
- All logs are JSON structured with request context
- Metrics tracked in Redis counters
- Health endpoints for each runtime
- Worker heartbeat file for external monitoring

---

## 5. TypeScript Strictness

- `exactOptionalPropertyTypes: true` — omit absent keys, never pass `undefined`
- `strict: true` across all packages

```typescript
// CORRECT
const opts: Options = hasFilter ? { filter: value } : {};

// WRONG — violates exactOptionalPropertyTypes
const opts: Options = { filter: undefined };
```

---

## 6. Auth Guards

Three guard levels, use the correct one:

| Guard | Who passes | Use for |
|---|---|---|
| `requireAdmin` | Valid admin session | User-facing admin routes |
| `requireAdminOrInternalToken` | Admin OR `PRIVATE_ACCESS_TOKEN` | Routes called by worker + admin UI |
| `requireInternalToken` | `PRIVATE_ACCESS_TOKEN` only | Worker-only internal routes |

---

## 7. Security Checklist

- [ ] No secrets in `VITE_*`
- [ ] Tokens encrypted at rest (AES-256-GCM)
- [ ] Session cookies: HttpOnly, Secure, SameSite=Lax
- [ ] Login rate limit: 5 attempts/min (`AUTH_LOGIN_RATE_LIMIT_PER_MIN`)
- [ ] Password hashing: PBKDF2-SHA256 (210k iterations) or Argon2
- [ ] `x-request-id` present on every response
- [ ] No `console.log` in production code
- [ ] `Cache-Control: no-store` on sensitive routes

## Common Mistakes

1. **Forgetting demo path** on a new endpoint → breaks demo mode entirely
2. **Logging request body** with tokens inside → secret leak
3. **Using `VITE_` prefix** for a value that should stay server-side
4. **Passing `undefined` to optional fields** → TypeScript compile error with `exactOptionalPropertyTypes`
5. **Missing `x-request-id`** → breaks request tracing across services

## References
- [CONVENTIONS.md](docs/context/CONVENTIONS.md)
- [ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md)
- [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md)
- [AGENTS.md](AGENTS.md)
