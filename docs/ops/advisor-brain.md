# Advisor Brain Ops

Last updated: 2026-05-23

This runbook covers the Investment Strategy Engine and Advisor Brain.

## What It Does

The system answers: "What should I do with each investment account today?"

It generates a persisted action plan with:

- one highlighted top action;
- account-scoped items for PEA Trade Republic, IBKR, and Binance;
- amount and asset when safely calculable;
- bucket impact against 60 / 30 / 10;
- price source, timestamp, staleness, confidence, and provider health;
- arguments for/against and invalidation criteria;
- J+1/J+7/J+30 review dates;
- explicit `humanValidationRequired=true` and `noAutoTrade=true`.

## API Checks

Read endpoints follow dashboard auth mode and keep demo deterministic:

- `GET /dashboard/advisor/investment-strategy`
- `GET /dashboard/advisor/investment-plan/latest`
- `GET /dashboard/advisor/investment-hypotheses`
- `GET /dashboard/advisor/investment-hypotheses/due`
- `GET /dashboard/advisor/investment-learning/scorecard`
- `GET /dashboard/advisor/investment-learning/lessons`
- `GET /dashboard/advisor/investment-status`

Admin or valid internal token is required for mutations:

- `PUT /dashboard/advisor/investment-strategy`
- `POST /dashboard/advisor/investment-plan/generate`
- `POST /dashboard/advisor/investment-hypotheses/review-due`
- `POST /dashboard/advisor/investment-learning/lessons/:lessonId/approve`
- `POST /dashboard/advisor/investment-learning/lessons/:lessonId/reject`

Manual dry-run:

```bash
curl -X POST "$API_INTERNAL_URL/ops/refresh/all" \
  -H "x-internal-token: $PRIVATE_ACCESS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"trigger":"scheduled","runKind":"night","dryRun":true}'
```

Generate investment plan without side effects:

```bash
curl -X POST "$API_INTERNAL_URL/dashboard/advisor/investment-plan/generate" \
  -H "x-internal-token: $PRIVATE_ACCESS_TOKEN" \
  -H "content-type: application/json" \
  -d '{"trigger":"internal","dryRun":true}'
```

## Daily Intelligence Integration

The refresh registry owns execution. There is no parallel scheduler.

New jobs:

| Job | Depends on | Purpose |
|---|---|---|
| `investment-learning-review` | `market-data`, `external-investments` | Reviews due hypotheses, writes outcomes, post-mortems, lessons, calibration. |
| `investment-action-plan` | `investment-learning-review`, `market-data`, `external-investments` | Computes allocation, drift, account-aware plan, recommendations, hypotheses, context bundle. |
| `advisor-context` | also depends on `investment-action-plan` | Runs the broader daily Advisor after the investment context is ready. |

Night and morning triggers both use `/ops/refresh/all`; the plan is idempotent. The learning job no-ops when nothing is due, and action-plan generation supersedes the previous active plan.

## Debugging Missing Data

Use `GET /dashboard/advisor/investment-status`.

Check:

- `latestActionPlan`
- `latestAllocationSnapshot`
- `learning`
- `memory.memoryEventsCreated`
- `memory.graphWritesFailed`
- `staleProviders`
- action-plan item `dataFreshness`

Common degraded states:

- no active strategy: seed did not run or DB migration missing;
- no approved candidates: expected on first run; approve assets later before buys can appear;
- stale/missing price: buys are blocked by design;
- PEA unknown eligibility: PEA buy is blocked by design;
- graph write failure: non-blocking; Postgres memory event is canonical.

## Lesson Approval

Lessons are never applied automatically.

Approve:

```bash
curl -X POST "$API_INTERNAL_URL/dashboard/advisor/investment-learning/lessons/123/approve" \
  -H "x-internal-token: $PRIVATE_ACCESS_TOKEN"
```

Reject:

```bash
curl -X POST "$API_INTERNAL_URL/dashboard/advisor/investment-learning/lessons/123/reject" \
  -H "x-internal-token: $PRIVATE_ACCESS_TOKEN"
```

Approved lessons are context signals for future recommendations. They do not mutate the active strategy rules in this implementation pass.

## Production Validation

1. Apply migration `0034_investment_strategy_brain.sql`.
2. Run `POST /ops/refresh/all` with `dryRun:true`.
3. Run `GET /dashboard/advisor/investment-strategy`; confirm strategy `bigzoo_growth_60_30_10_v1`.
4. Run `POST /dashboard/advisor/investment-plan/generate` with `dryRun:true`; confirm no writes.
5. Run the same endpoint without `dryRun` as admin/internal.
6. Open `/ia/strategie-investissement`.
7. Confirm every item shows `a valider manuellement` and `auto-trade: non`.
8. Run `POST /dashboard/advisor/investment-hypotheses/review-due` after due dates.
9. Check `GET /dashboard/advisor/investment-learning/scorecard`.
10. If graph ingest is enabled, check memory counters and knowledge-service logs.

## Safety Guarantees

- No broker order route was added.
- No Binance futures/margin/withdrawal/transfer/convert/staking mutation was added.
- IBKR remains Flex/reporting-read-only.
- Missing/stale/low-confidence price blocks buys.
- Unknown PEA eligibility blocks buys.
- Unknown candidate universe blocks buys.
- Demo mode stays deterministic and write-free.
