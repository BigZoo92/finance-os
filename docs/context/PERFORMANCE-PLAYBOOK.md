# PERFORMANCE PLAYBOOK

Last updated: 2026-04-21

This playbook defines a repeatable end-to-end performance investigation and remediation loop for Finance-OS.

## Scope

The procedure covers:

- Web UX responsiveness (`apps/web`)
- API request latency (`apps/api`)
- Worker sync throughput (`apps/worker`)
- End-to-end local verification in both `demo` and `admin` paths

## Investigation Workflow

### 1) Reproduce and classify

Classify the symptom before changing code:

- **Perceived UI lag**: delayed interaction, animation jank, long route transition
- **API latency**: slow `/api/*` responses, spikes under repeated calls
- **Data freshness lag**: stale dashboard data after sync or background jobs
- **Build/runtime overhead**: cold start slowness, repeated expensive setup

Always log a concrete baseline (time range, route, payload shape, mode, machine context).

### 2) Capture baselines

Use deterministic reproduction first:

1. Start in `demo` mode to isolate frontend and rendering costs.
2. Switch to `admin` mode to include DB/provider paths.
3. Capture before numbers with the same scenario:
   - p95 API latency
   - UI interaction timing (route load + key interactions)
   - Worker batch duration for sync paths

### 3) Trace bottleneck location

Use a top-down pass:

1. Browser timeline and network waterfall (web)
2. API logs + request-id correlation (api)
3. Worker loop timing around queue processing (worker)
4. DB query shape/index usage when admin path is involved

Keep `x-request-id` as the correlation key from request through downstream operations.

### 4) Select lowest-risk remediation

Prioritize fixes with bounded blast radius:

1. Query/index optimization
2. Cache and memoization adjustments
3. Payload reduction and lazy loading
4. Rendering optimization (avoid unnecessary rerenders)
5. Background batching and backpressure tuning

Do not couple core behavior to analytics delivery. If telemetry is missing, fail soft and keep features usable.

### 5) Verify regressions and dual-path safety

For every fix:

- Validate `demo` still stays deterministic and provider-free.
- Validate `admin` path behavior is unchanged except expected performance improvements.
- Confirm logs remain structured and secret-safe.

## Remediation Checklist

Use this checklist in PR notes when performance changes are shipped:

- [ ] Baseline documented (before)
- [ ] Bottleneck location identified with evidence
- [ ] Fix strategy justified (why this over alternatives)
- [ ] After metrics documented (same scenario as baseline)
- [ ] Demo/admin split explicitly validated
- [ ] No secrets added to logs or client-exposed env
- [ ] `pnpm check:ci` run locally when environment setup allows

## Minimal Evidence Format

When reporting results, include:

- **Scenario**: route/feature, mode (`demo` or `admin`), dataset shape
- **Before**: numeric metrics
- **After**: numeric metrics
- **Delta**: absolute and percentage improvement
- **Risk notes**: regressions checked, fallback behavior

## Commands

Primary validation command from repo root:

```bash
pnpm check:ci
```

Optional targeted checks after focused edits:

```bash
pnpm lint
pnpm typecheck
pnpm -r --if-present test
pnpm -r --if-present build
```
