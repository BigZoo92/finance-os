---
name: finance-os-observability-failsoft
description: "Observability and fail-soft patterns — widget health, fallback chains, metrics, logging, health checks, debug conventions. Use when adding features with degraded states, monitoring, or error handling."
---

# Finance-OS Observability & Fail-Soft

## When to use
- Adding a new widget or data-fetching feature
- Implementing error boundaries or fallback states
- Working on health checks, metrics, or alerting
- Debugging production issues with logging
- Reviewing observability coverage of a feature

## When NOT to use
- Pure styling changes
- Documentation-only changes

---

## 1. Fail-Soft Policy

**Principle**: Stale data > missing data. Degraded > broken.

### Fallback Chain

```
live data → cache → demo mock
```

Configurable via env vars:
- `FAILSOFT_POLICY_ENABLED` — master toggle
- `FAILSOFT_SOURCE_ORDER` — default: `live,cache,demo`
- `FAILSOFT_ALERTS_ENABLED` — alert on fallback activation

```typescript
// Pattern: fail-soft data fetching
async function getWithFallback<T>(
  live: () => Promise<T>,
  cache: () => Promise<T | null>,
  demo: () => T,
): Promise<{ data: T; source: 'live' | 'cache' | 'demo' }> {
  try {
    return { data: await live(), source: 'live' };
  } catch {
    const cached = await cache();
    if (cached) return { data: cached, source: 'cache' };
    return { data: demo(), source: 'demo' };
  }
}
```

### Widget Health States

Every widget must handle ALL of these states:

| State | Visual | Behavior |
|---|---|---|
| `loading` | Skeleton / spinner | Show placeholder matching content layout |
| `success` | Full data | Normal render |
| `empty` | Empty state illustration | Contextual message (not just "no data") |
| `degraded` | Data with warning badge | Show stale data + source indicator |
| `error` | Error boundary | Retry button + fallback to demo |
| `offline` | Offline indicator | Show cached data if available |
| `gated` | Lock / upgrade prompt | Admin-only features in demo mode |

**Rule**: Never show a blank white rectangle. Every state is designed.

---

## 2. Logging Conventions

### Format: JSON Structured Only

```typescript
// CORRECT
logger.info({
  requestId: ctx.requestId,
  action: 'sync.complete',
  connectionId,
  duration: 1234,
  transactionCount: 847,
});

// WRONG — no console.log, no string interpolation
console.log(`Sync complete for ${connectionId} in ${duration}ms`);
```

### What to Log

| Level | When | Example |
|---|---|---|
| `error` | Unrecoverable failure | DB connection lost, encryption key invalid |
| `warn` | Recoverable issue, degraded state | Fallback to cache, integrity gap detected |
| `info` | Lifecycle events | Sync started/completed, login, deploy |
| `debug` | Developer diagnostics | Query timing, cache hit/miss |

### What NEVER to Log

- Tokens, passwords, encryption keys
- Full request/response bodies
- PII (email, name, bank details)
- Session cookies or secret values

---

## 3. Request Tracing

`x-request-id` propagated across all services:

```
Browser → Web (SSR) → API → Worker
         x-request-id: abc-123 (same ID across all hops)
```

**Rules**:
- Generate at web edge if not present
- Include in all log entries
- Include in error responses
- Pass to worker via job metadata

---

## 4. Health Checks

| Service | Endpoint / Mechanism | Checks |
|---|---|---|
| Web | `GET /health` | SSR renders, TanStack hydrates |
| API | `GET /health` | DB connected, Redis connected |
| Worker | Heartbeat file | File freshness < 2x `WORKER_HEARTBEAT_MS` |

---

## 5. Metrics (Redis Counters)

Key patterns:
- `metrics:api:requests:{route}` — request count per route
- `metrics:api:errors:{statusCode}` — error count by status
- `metrics:sync:success` / `metrics:sync:failure` — sync outcomes
- `metrics:sync:duration` — sync duration tracking

**Rules**:
- Metrics are descriptive (not execution-critical) — app works without Redis metrics
- Use `INCRBY` for counters, not complex data structures
- Expose via `GET /debug/metrics` (guarded by `DEBUG_METRICS_TOKEN`)

---

## 6. Alerting

Priority levels (from `infra/docker/ops-alerts/`):

| Level | Threshold | Action |
|---|---|---|
| P0 Critical | Security breach, data loss | Immediate page |
| P1 High | API 5xx > threshold, worker dead | Alert within 5min |
| P2 Medium | Degraded performance, high latency | Alert within 30min |

**Rules**:
- Anti-noise: deduplicate, suppress repeats, prefer state-change alerts
- `ALERTS_5XX_THRESHOLD` — consecutive 5xx before alerting (default 3)
- Worker heartbeat alert if file older than 2x heartbeat interval
- Changes to alerting: test with `node --test infra/docker/ops-alerts/monitor.test.mjs`

---

## 7. Debug Conventions

- `APP_DEBUG=true` enables verbose logging
- `LOG_LEVEL` controls minimum log level (default: `info`)
- Debug metrics endpoint: `GET /debug/metrics` (token-protected)
- Never enable debug mode in production permanently

## Common Mistakes

1. **Widget without all 7 states** — blank screen on error
2. **Missing `x-request-id` in logs** — can't trace across services
3. **Using `console.log`** — unstructured, not parsed by log aggregators
4. **Logging PII or tokens** — compliance and security violation
5. **Alerts without deduplication** — alert fatigue, alerts get ignored
6. **Treating metrics as required** — app should work if Redis metrics are down

## References
- [CONVENTIONS.md](docs/context/CONVENTIONS.md) — observability, logging, fail-soft
- [APP-ARCHITECTURES.md](docs/context/APP-ARCHITECTURES.md) — health checks
- [ENV-REFERENCE.md](docs/context/ENV-REFERENCE.md) — failsoft, debug, alerts variables
- [AGENTS.md](AGENTS.md) — ops alert quality rules
