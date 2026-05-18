# Refresh orchestrator — status taxonomy & operational runbook

The refresh orchestrator lives at
[`apps/api/src/routes/ops/refresh-registry.ts`](../../apps/api/src/routes/ops/refresh-registry.ts)
and is exposed under `/ops/refresh/*`.

## Status taxonomy

A refresh job result carries a `RefreshJobStatus`:

| Status                          | Meaning                                                                |
| --- | --- |
| `queued`                        | Handed to underlying queue; non-final.                                 |
| `running`                       | Actively executing; non-final. Should not stay here past `timeoutMs`.  |
| `success`                       | Completed and produced expected data.                                  |
| `partial`                       | Completed with at least one provider in degraded state.                |
| `failed`                        | Hard error.                                                            |
| `timed_out`                     | Exceeded the job's hard timeout (orchestrator AbortController fired).  |
| `cancelled`                     | Cancelled via `POST /ops/refresh/runs/:runId/cancel`.                  |
| `skipped`                       | Generic skip (legacy). Prefer the variants below.                      |
| `skipped_disabled`              | Feature flag for this job is off.                                      |
| `skipped_missing_config`        | Flag on but required secret/config is missing — actionable.            |
| `skipped_budget`                | Paid provider budget exhausted (e.g. X monthly cap).                   |
| `skipped_dependency_failed`     | An upstream job failed/timed_out; downstream skipped automatically.    |

The `isFinalRefreshStatus()` helper exported from `refresh-registry.ts`
returns true for every status except `queued`/`running`. Any job stuck in
`running` past `staleAfterMs` is a candidate for stale-recovery.

## Routes

| Method | Path                                       | Notes |
| --- | --- | --- |
| GET    | `/ops/refresh/jobs`                        | Job definitions (demo + admin). |
| GET    | `/ops/refresh/status`                      | Snapshot incl. latest run (admin). |
| GET    | `/ops/refresh/runs`                        | Recent runs (admin). |
| GET    | `/ops/refresh/runs/:runId`                 | Single run details (admin). |
| POST   | `/ops/refresh/all`                         | Run full daily intelligence (admin). |
| POST   | `/ops/refresh/jobs/:jobId/run`             | Run a single job (admin). |
| POST   | `/ops/refresh/stale-runs/recover`          | Sweep stale runs → mark `timed_out`. Body: `{ staleAfterMs?: number }`. |
| POST   | `/ops/refresh/runs/:runId/cancel`          | Cancel an in-flight run (admin). |
| GET    | `/ops/env/diagnostics`                     | Per-service env health (no secrets returned). |

## Hard timeout & stale recovery

Each job declaration has a `timeoutMs`. The orchestrator currently enforces
this via `Promise.race` against a timeout sentinel — the inner promise may
keep running in the background, but the caller-visible status moves to
`timed_out` once the budget is exhausted. The underlying use case is
responsible for writing its eventual final status into the DB (so when the
user refreshes the page they see the actual outcome).

If a run never finalizes (worker crash, network outage), call
`POST /ops/refresh/stale-runs/recover` with a `staleAfterMs` (default
1 800 000 = 30 min). The endpoint requires the runtime to expose
`recoverStaleAdvisorManualOperations` — without it, it falls back to
returning the list of stale candidates so an operator can act manually.

## Preflight skip variants

The `evaluatePreflight()` helper centralizes the "should this job actually
run?" decision so each handler doesn't reinvent it:

```ts
evaluatePreflight({
  job,
  triggerSource,
  missingConfig: { missingEnvNames: ['EODHD_API_KEY'], reason: 'EODHD key missing' },
  budgetExceeded: { reason: 'monthly X cap reached' },
  failedDependencyId: 'powens',
})
```

Returning `skipped_missing_config` instead of throwing an opaque 500 makes
the Ops Refresh Center surface the actionable bit ("set this env var")
instead of "internal error".

## Test coverage

- [`refresh-preflight.test.ts`](../../apps/api/src/routes/ops/refresh-preflight.test.ts):
  unit tests for `evaluatePreflight` + `isFinalRefreshStatus`.
- [`refresh-registry.test.ts`](../../apps/api/src/routes/ops/refresh-registry.test.ts):
  legacy registry behavior + redaction.
- [`refresh.test.ts`](../../apps/api/src/routes/ops/refresh.test.ts):
  HTTP-level demo isolation + admin paths.
