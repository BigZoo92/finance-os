# Data Quality and Provider Diagnostics — Operator Guide

> **Status**: shipped with Macro Prompt 5 (2026-05-10).
> **Audience**: operators (the human, the autopilot agents) reading the cockpit.
> **Related**: [`docs/adr/provider-abstraction-v2.md`](../adr/provider-abstraction-v2.md),
> [`docs/context/EXTERNAL-INVESTMENTS.md`](../context/EXTERNAL-INVESTMENTS.md),
> [`docs/context/EXTERNAL-SERVICES.md`](../context/EXTERNAL-SERVICES.md).

This guide documents how to read the two reliability-focused endpoints exposed by
the dashboard API:

- `GET /dashboard/providers/diagnostics` — provider health snapshot.
- `GET /dashboard/data-quality` — data quality + Advisor readiness scoring.

Both are **read-only**, **admin/internal-token only**, and **never trigger live
provider probes, sync jobs, LLM calls, or graph ingest**. They derive their
output from local DB rows and in-memory provider health snapshots that are
populated by the existing sync pipeline. Demo callers receive deterministic
fixtures.

## What does NOT happen

The whole point of this layer is to give an **honest, conservative** read of
local state without side effects. Specifically:

- **No provider live probes.** Neither endpoint calls Powens, IBKR, Binance,
  EODHD, Twelve Data, FRED, or the news adapters. Health snapshots come from
  the local `powensConnection` / `externalInvestmentProviderHealth` /
  `marketCacheState` / `newsCacheState` rows already updated by the sync
  pipeline.
- **No sync trigger.** Reading these endpoints does NOT enqueue Powens jobs,
  IBKR/Binance fetches, market refreshes, or news ingestion.
- **No LLM call.** No Anthropic, no OpenAI, no eval run.
- **No graph call.** The `knowledge-service` provider is read at the health
  level only (its already-cached `getHealth()` snapshot). No
  `knowledge.context_bundle.read` is invoked.
- **No raw provider payload exposure.** Responses contain closed-vocab status
  enums, counts, and timestamps. Tokens, secrets, account ids, raw XML/JSON,
  and upstream error message bodies are explicitly excluded by the route +
  the wrappers that build the snapshots.
- **No trading execution.** No order, withdrawal, transfer, convert, margin,
  futures, staking, or earn mutation can ever originate from these endpoints.

## Endpoint 1 — `GET /dashboard/providers/diagnostics`

### Response shape (admin)

```jsonc
{
  "generatedAt": "2026-05-10T12:00:00.000Z",
  "mode": "admin",
  "providers": [
    {
      "providerId": "binance",
      "status": "ok",
      "capabilities": ["crypto.wallet.read"],
      "lastCheckedAt": "2026-05-10T11:59:00.000Z",
      "degraded": false,
      "freshnessMinutes": null,
      "errorCode": null,
      "caveats": []
    }
    // ...
  ],
  "summary": {
    "total": 6,
    "healthy": 4,    // count of providers with status === "ok"
    "degraded": 1,
    "down": 1,
    "unknown": 0,
    "disabled": 0
  },
  "caveats": [
    "provider registry is foundation-only until provider migrations land"
  ]
}
```

Provider entries are sorted alphabetically by `providerId` for stable diffing.

### Provider statuses

| Status | Meaning | Action |
|---|---|---|
| `ok` | Last health check succeeded. Provider is healthy locally. | Treat the provider's local data as usable within its stated caveats. |
| `degraded` | Provider is reachable but reporting partial failures, rate-limited responses, transient errors, OR is **unconfigured / disabled by flag**. | Inspect `errorCode` and `caveats` before trusting freshness. |
| `down` | Provider is configured + clearly failing locally (e.g. all connections in error state with no recorded success). | Investigate; do not rely on this provider's data. |
| `unknown` | Health is not yet determined. | Wait for the next health refresh. |
| `disabled` | Provider was registered but is fully disabled by configuration. | Expected; no action. |

Important rule: **`down` is reserved for clearly configured + failing local
state.** "Provider unconfigured" and "feature flag off" are reported as
`degraded` with explicit caveats — never as `down`. This avoids false alarms
when an integration simply has not been set up.

### Common `errorCode` values

| `errorCode` | Meaning |
|---|---|
| `unconfigured` | No credential / connection record exists for this provider. |
| `disabled_by_flag` | Provider is registered but the corresponding feature flag is off. |
| `auth_failed` | Connection requires reconnect (e.g. Powens reconnect_required). |
| `transient` | One or more recent calls failed; retried successfully later. |
| `rate_limited` | Upstream rate limit hit. |
| `provider_unavailable` | Upstream cannot be reached. |

## Endpoint 2 — `GET /dashboard/data-quality`

This endpoint summarizes whether the local data is **reliable enough to trust**.
It does NOT measure financial performance; a low score means "the picture is
incomplete or stale", not "your investments are bad".

### Response shape (admin)

```jsonc
{
  "generatedAt": "2026-05-10T12:00:00.000Z",
  "mode": "admin",
  "overall": {
    "score": 82,
    "grade": "good",
    "stale": false,
    "degraded": false
  },
  "dimensions": [
    {
      "key": "banking",
      "score": 95,
      "grade": "excellent",
      "freshnessMinutes": 30,
      "stale": false,
      "degraded": false,
      "missing": false,
      "reasons": [],
      "providers": ["powens"]
    }
    // ...one entry per canonical dimension key
  ],
  "advisorReadiness": {
    "ready": true,
    "level": "ready",
    "reasons": [],
    "missingInputs": [],
    "staleInputs": [],
    "caveats": []
  },
  "blockingIssues": [],
  "caveats": [
    "scores reflect local data reliability only — not investment performance"
  ]
}
```

Dimensions are emitted in canonical order: `banking`, `investments`, `crypto`,
`market_data`, `news`, `advisor_memory`, `evals`, `post_mortems`.

### Dimension grades

| Grade | Score range | Meaning |
|---|---|---|
| `excellent` | 90 – 100 | Local data is fresh and complete. |
| `good` | 75 – 89 | Fresh with minor caveats. |
| `usable` | 55 – 74 | Workable but stale or partial. |
| `degraded` | 30 – 54 | Real reliability issues; treat outputs with care. |
| `insufficient` | 0 – 29 | Data is too unreliable to trust on its own. |
| `unknown` | (score = `null`) | Not enough local data to score this dimension. |

**Vocabulary boundary.** `DataQualityGrade` (used for `overall.grade` and each `dimension.grade`) is a **different enum** from `AdvisorReadinessLevel` (used for `advisorReadiness.level`). They are not aliases. `overall.grade = degraded` does **not** mean `advisorReadiness.level = limited` or `not_ready` — the readiness logic looks at required-dimension presence + freshness, not at a numeric score.

The `unknown` grade always ships with `score: null`, never `0`. Missing /
unconfigured / disabled-by-flag data is reported as `unknown` — not as a
failure.

### What each dimension looks at

| Dimension | Source(s) | What `ok` means |
|---|---|---|
| `banking` | `powensConnection` rows | At least one Powens connection has a recorded successful sync, no connections in error or reconnect_required. |
| `investments` | `externalInvestmentProviderHealth` for IBKR + IBKR connection record | IBKR enabled by flag, credentials configured, provider diagnostics status `ok`. |
| `crypto` | Same tables, Binance row | Binance enabled by flag, credentials configured, provider diagnostics status `ok`. |
| `market_data` | `marketCacheState` | Last refresh succeeded and is not older than the configured staleness threshold. |
| `news` | `newsCacheState` | Live news ingestion enabled, last successful aggregation is fresh. |
| `advisor_memory` | `knowledge-service` provider health from the registry (no live call) | Knowledge service is enabled, last health check passed. |
| `evals` | `aiEvalRun` latest row | Latest eval run completed with no failed cases. |
| `post_mortems` | `advisorPostMortem` latest row | Post-mortem feature enabled and the latest run completed. |

For each dimension:

- **`stale`** → last successful refresh is older than the configured threshold.
- **`degraded`** → upstream reported partial/transient failures, OR the
  dimension is stale.
- **`missing`** → no local row exists yet (e.g. user has never connected a
  bank, never run a post-mortem). Score stays `null`.

### Default staleness thresholds

| Dimension | Default threshold |
|---|---|
| `banking` | 24 h |
| `investments` | 24 h |
| `crypto` | 24 h |
| `market_data` | 60 min |
| `news` | 6 h |
| `advisor_memory` | 7 d |
| `evals` | 30 d |
| `post_mortems` | 60 d |

### Advisor readiness

The `advisorReadiness` block tells you whether the AI Advisor has enough
reliable inputs. Three required dimensions: `banking`, `investments`,
`market_data`. Three supporting dimensions: `news`, `advisor_memory`, `evals`.

| Level | When | Implication |
|---|---|---|
| `ready` | All required dimensions are fresh and `ok`. | Read recommendations as usable within their stated caveats. They remain advisory-only. |
| `usable_with_caveats` | All required dimensions present but at least one is stale. | Read the staleness caveat first; recommendations remain usable within their stated caveats and advisory-only. |
| `limited` | One required dimension is missing or `down` locally. | Treat advisor output as exploratory only. |
| `not_ready` | Two or more required dimensions are missing or `down`. | Do not act on advisor output. |

Consider acting on a recommendation only when `advisorReadiness.level` is `ready` or `usable_with_caveats`, and even then treat the output as advisory-only — Finance-OS never executes financial actions.

The Advisor route (`/dashboard/advisor/*`) is **not** changed by this scoring.
Advisor readiness is exposed only through `/dashboard/data-quality`. The
existing Advisor recommendation generation is unchanged; readiness is
informational, not a gate.

## Before reading Advisor output

The minimum checklist before considering an Advisor recommendation:

1. `GET /dashboard/data-quality` returns `advisorReadiness.level === "ready"` or
   `"usable_with_caveats"`.
2. The `advisorReadiness.staleInputs` and `advisorReadiness.caveats` lists are
   reviewed and are tolerable for the decision at hand.
3. `GET /dashboard/providers/diagnostics` does not list `down` providers among
   the inputs for that decision.
4. The most recent eval run is at least `usable` (i.e. the `evals` dimension's
   `grade` is `usable`, `good`, or `excellent`).

Recommendations remain **advisory-only** in every case. Consider them only if the four conditions above hold, and treat the output as input to your own decision — never as instructions.

## Why this layer exists

Real daily usage of Finance-OS depends on reading the cockpit and trusting
that:

- The numbers are local — they were computed deterministically from local
  rows, not from an LLM hallucination or a stale cache silently fronted as
  fresh.
- The reliability state is honest — missing data is shown as missing, not
  hidden behind a default zero.
- Failures are visible — a `down` provider is shown explicitly instead of
  silently degrading the dashboard.
- Reading the cockpit never reaches out to a third party — auditing the
  endpoints in this guide should never produce outbound traffic.

These two endpoints are the canonical surface for those four properties.
