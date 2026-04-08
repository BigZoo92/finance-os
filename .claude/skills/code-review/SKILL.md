---
name: code-review
description: "Structured code review with severity labels and 4-phase process. Use when reviewing PRs, auditing code quality, performing pre-merge checks, or when asked to review code changes."
---

# Code Review

Systematic 4-phase code review process with calibrated severity labels. Produces actionable, prioritized feedback that respects the author's intent while catching real issues.

## When to Use

- Reviewing pull requests or diffs
- Pre-merge quality gates
- Auditing existing code for issues
- Requested code review on specific files or changes

## Phase 1: Understand

Before writing any feedback, answer these questions:

1. **What is the change trying to do?** Read the PR description, linked issues, commit messages.
2. **What is the scope?** Count files changed, lines added/removed, new dependencies.
3. **What is the risk profile?** Auth changes > data mutations > API contracts > UI > docs.
4. **What is the test coverage?** Are there new tests? Do existing tests still pass?
5. **What does the blast radius look like?** Use `gitnexus_impact` on modified symbols.

Do not start writing comments until you can explain the change in one sentence.

## Phase 2: Analyze

Review in this order (highest risk first):

### 2a. Correctness

- Does the logic match the stated intent?
- Are edge cases handled (null, empty, concurrent, error)?
- Are types correct and complete?
- Do mutations have proper rollback/cleanup on failure?
- Non-exhaustive switch/if chains on discriminated unions?

### 2b. Security

- Input validation at system boundaries (Zod schemas on API routes)
- SQL parameterization (no string concatenation in queries)
- Auth checks on all protected routes (`requireAdmin`, `requireAdminOrInternalToken`)
- No secrets in logs, responses, or `VITE_*` env vars
- Token/credential handling (encrypted at rest via AES-256-GCM, not logged)
- CSRF/XSS vectors in any new endpoints or UI
- Callback validation (HMAC state + TTL on external callbacks)

### 2c. Performance

- N+1 query patterns
- Unbounded result sets (missing `.limit()`)
- Unnecessary re-renders in React components
- Large payloads over the wire
- Missing indexes for new query patterns
- Batch size compliance (800 rows max for inserts)
- Missing memoization on expensive computations

### 2d. Reliability

- Error handling: are errors caught, logged safely, and surfaced appropriately?
- Timeout/retry behavior for external calls
- Graceful degradation when dependencies fail
- Race conditions in concurrent operations
- Advisory lock usage for singleton operations

### 2e. Observability

- Structured logging at entry/exit of new endpoints
- `x-request-id` propagated through the call chain
- Error paths log with sufficient context for debugging
- Long-running operations have timing instrumentation
- No tokens, passwords, or PII in log output

### 2f. Maintainability

- Naming clarity and consistency
- Unnecessary complexity
- Code duplication that should be extracted
- Missing or misleading comments
- Compliance with repo conventions (`exactOptionalPropertyTypes`, logging safety)

## Phase 3: Feedback

### Severity Labels

Every comment MUST have exactly one label:

| Label | Meaning | Action Required |
|-------|---------|-----------------|
| **blocking** | Will cause a bug, security issue, data loss, or outage | Must fix before merge |
| **important** | Likely issue, significant code quality problem, or missing test | Should fix before merge |
| **nit** | Style, naming, minor inconsistency | Fix if convenient, skip if not |
| **suggestion** | Alternative approach that may be better | Author decides |
| **learning** | Explanation of a pattern or context for the author | No action needed |
| **praise** | Something done well worth calling out | No action needed |

### Finance-OS Severity Mapping

| Finance-OS severity | Review label |
|---------------------|--------------|
| P0 (security, demo/admin leak, data loss) | **blocking** |
| P1 (contracts, SSR, logging, observability) | **important** |
| P2 (style, cleanup, minor inconsistency) | **nit** |

### Feedback Format

```
[blocking] path/to/file.ts:42 -- SQL injection via string concatenation

The query uses template literals instead of parameterized queries:
  `SELECT * FROM users WHERE id = '${userId}'`

Fix: use the sql tagged template from drizzle-orm which parameterizes automatically.
```

### Rules

1. **Lead with blockers**. Always surface blocking issues first.
2. **One issue per comment**. Do not bundle unrelated issues.
3. **Be specific**. Include file path, line number, and the problematic code.
4. **Suggest a fix**. Do not just point out problems -- propose solutions.
5. **Limit nits**. Max 3 nits per review. More than that is noise.
6. **Include at least one praise** per review when warranted. Good work should be acknowledged.
7. **Do not rewrite the PR**. Review what was submitted, not what you would have written.
8. **Context before criticism**. If the code is confusing, ask a clarifying question before flagging.

## Phase 4: Verify

Before submitting the review:

1. Re-read all blocking comments. Are they truly blocking?
2. Check that every comment has a severity label.
3. Verify you have not duplicated the same issue across comments.
4. Confirm the review covers the full diff, not just the first file.
5. Write a summary of the review outcome.

### Summary Format

```
## Summary

[APPROVE / REQUEST CHANGES / COMMENT]

<1-2 sentence overview>

- N blocking, N important, N nit, N suggestion
```

## TypeScript Patterns to Watch

- **`any` type** -- should be `unknown` with narrowing
- **`exactOptionalPropertyTypes` violations** -- using `undefined` where `null` is required
- **Type assertions (`as`)** hiding real type errors -- prefer type guards
- **Non-exhaustive switch/if** on discriminated unions -- add exhaustiveness check
- **`!` non-null assertions** without justification
- **Missing `as const`** on selection objects (loses literal types in Drizzle)
- **`undefined` in optional fields** -- must omit the key or use `null` explicitly

## React Patterns to Watch

- Missing dependency arrays in `useEffect`/`useMemo`/`useCallback`
- State updates in render path
- Missing error boundaries around fallible components
- Prop drilling that should use context or composition
- Inline object/array/function creation in JSX causing re-renders
- Missing `key` props or using array index as key on dynamic lists
- Side effects outside `useEffect`

## Security Review Checklist

```
[ ] All user input validated at the boundary (Zod schemas on API routes)
[ ] SQL queries use parameterized templates, not string concatenation
[ ] No secrets in VITE_* env vars
[ ] No secrets, tokens, or PII in log output
[ ] Auth middleware applied to all protected routes
[ ] CORS configuration is intentional, not permissive
[ ] External API callbacks validated (HMAC signature, state, TTL)
[ ] Tokens encrypted at rest (AES-256-GCM, PBKDF2-SHA256 210k iterations)
[ ] Error responses do not leak internal details or stack traces
[ ] Cache-Control: no-store on sensitive routes
[ ] Session cookies: HttpOnly, Secure, SameSite
```

## Performance Review Checklist

```
[ ] No N+1 query patterns
[ ] All list queries have .limit()
[ ] Batch inserts chunked at 800 rows
[ ] New query patterns have supporting indexes
[ ] No unbounded in-memory collections
[ ] React components do not re-render unnecessarily
[ ] Large lists use virtualization or pagination
[ ] API responses are reasonably sized
[ ] Cursor pagination for large datasets (not offset)
```

## Finance-OS Specific Checks

### Dual-Path Compliance

- Demo mode and live mode must both handle the same UI states
- Admin-only features must not leak into the public app
- `demoOrReal()` path correctness -- demo path never reaches DB or provider calls

### Widget States

All UI components should handle these states:
- loading / empty / success / degraded / error / offline / gated

### VITE_* Safety

`VITE_*` env vars are exposed to the client bundle. NEVER put secrets in them:
- API keys, tokens, database URLs, encryption keys must NOT use `VITE_` prefix

### Logging Safety

- No secrets, tokens, passwords, or PII in log output
- Use structured logging with safe field names
- User-facing error messages must not contain stack traces or internal details

### Database

- Upserts use `onConflictDoUpdate` with explicit `target` and `set`
- Batch operations respect the 800-row limit
- Migrations are backward-compatible
- New queries have appropriate indexes
- Transactions are short and use `tx`, not `db`
- Selection objects use `as const`

### Quick Reference Checklist

```
[ ] Change intent is clear and scoped
[ ] Types are correct (no any, no unsafe assertions)
[ ] Error paths are handled
[ ] No secrets in logs or VITE_* vars
[ ] Input validation at boundaries
[ ] SQL is parameterized
[ ] Queries have limits and indexes
[ ] Batch sizes within bounds
[ ] Tests cover happy path and at least one error path
[ ] No N+1 queries
[ ] React hooks follow rules of hooks
[ ] exactOptionalPropertyTypes compliance
[ ] Backward-compatible migration (if applicable)
[ ] Widget states: loading/empty/success/degraded/error
[ ] GitNexus impact analysis run for modified symbols
```
