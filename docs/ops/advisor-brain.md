# Advisor Brain Ops

Last updated: 2026-05-24

This runbook covers the Investment Strategy Engine and Advisor Brain.

## What It Does

The system answers: "What should I do with each investment account today?"

It generates a persisted action plan with:

- one highlighted top action;
- a "what to do now" action list even when no buy is safe;
- account-scoped items for PEA Trade Republic, IBKR, and Binance;
- a user watchlist / asset-interest layer;
- separate "Idees audacieuses" and watchlist items that do not override the main action;
- separate trade amounts and contribution amounts;
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
- `GET /dashboard/advisor/assets/search?q=`
- `GET /dashboard/advisor/assets/:assetId`
- `GET /dashboard/advisor/assets/watchlist`

Admin or valid internal token is required for mutations:

- `PUT /dashboard/advisor/investment-strategy`
- `POST /dashboard/advisor/assets/watchlist`
- `PATCH /dashboard/advisor/assets/watchlist/:id`
- `DELETE /dashboard/advisor/assets/watchlist/:id`
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
- no priceable candidate: add/provider-map an asset or wait for a fresh snapshot;
- stale/missing price: buys are blocked by design;
- PEA unknown eligibility: PEA buy is blocked by design;
- graph write failure: non-blocking; Postgres memory event is canonical.

## Asset Universe Model

`approved` is no longer a recommendation gate. It remains historical metadata only.

An asset can enter recommendations when all of these are true:

- price is available, fresh enough, and confidence is acceptable;
- the target account can hold the asset;
- PEA eligibility is known and positive for PEA buys;
- risk policy and strategy caps pass;
- the item explains risk, uncertainty, sizing, price source, and freshness.

Statuses such as `approved`, `candidate_needs_review`, `approved_by_default_policy`,
`candidate_auto_suggested`, and `watch_only` can remain in the universe. They do not block by
themselves. `rejected` or user intent `exclude` blocks recommendation.

Calculated model fields:

- `priceability`: `priceable`, `stale`, `missing`, `unsupported`;
- `eligibilityByAccount`: `eligible`, `ineligible`, `unknown`, `not_applicable`;
- `recommendabilityStatus`: `recommendable`, price/account/PEA/risk/cap blockers, or `rejected_by_user`;
- `userInterestLevel`: `none`, `watching`, `interested`, `high_interest`;
- `userIntent`: `watch`, `analyze`, `compare`, `consider_buy`, `exclude`;
- `recommendationTier`: core/growth/asymmetric/speculative/user-watchlist/avoid;
- `recommendationMode`: `action_now`, `prepare_contribution`, `watch`, `research_more`, `avoid`.

User-added assets are interest signals, not instructions. A high-interest asset gets a ranking
boost, but risk, concentration, price, account compatibility, and PEA eligibility still dominate.

## Actionability When No Buy Is Safe

No-buy is a valid output, but it must still be actionable.

The plan separates:

- `recommendedTradeAmount`: actual order amount. It stays `null` unless all buy guardrails pass.
- `recommendedContributionAmount`: amount to reserve/orient toward an underweight bucket, even when the current candidate is not buyable.
- `actionableSteps`: explicit next steps such as no trade today, reserve Core/Growth contribution, do not reinforce an overweight bucket, resolve PEA eligibility, or connect a price source.

For the current 60 / 30 / 10 setup, a degraded but useful plan may say:

- do not place any order today;
- reserve/orient 200 EUR toward Core;
- reserve/orient 100 EUR toward Growth;
- do not reinforce Binance when Asymmetric is above the 10% cap;
- resolve PEA eligibility for `CORE_ETF_REVIEW` and `GROWTH_REVIEW`;
- connect provider symbols/prices before any buy can become eligible.

This preserves the guardrails: no auto-trading, no buy with missing/stale prices, no buy on an
incompatible account, no PEA buy with unknown/negative eligibility, and no Binance/asymmetric
reinforcement above the 10% global cap.

## Asset Search And Watchlist

The strategy UI exposes an "Univers & Watchlist" section. Search is local-first and enriches
known assets from:

- seeded asset universe candidates;
- user watchlist rows in `user_asset_interest`;
- curated free metadata for common user searches such as NVIDIA, Bitcoin, MSCI World PEA, Amundi PEA, Air Liquide;
- persisted `asset_price_snapshot` rows when available.

No paid provider or mandatory env var is required. Missing logos use ticker badges. The UI copy
states that adding an asset means "surveille/analyse", not "achete".

## BTC / BTCEUR Price Wiring

BTC identity must normalize to the Binance Spot provider symbol `BTCEUR`. The action-plan builder
looks up both candidate symbols and provider symbols, and aliases fetched snapshots by symbol,
uppercase symbol, instrument id, and asset id. If `BTCEUR` has a fresh snapshot, the BTC candidate
uses that price and `priceSnapshotId`. If it is absent, the blocker must say:

- `Aucun snapshot de prix pour BTCEUR: achat interdit.`

It must not collapse this case to a vague missing-price message.

## Graph Ingest Status

The UI/API distinguish the latest plan run from historical memory counters.

- `plan.graph.lastRun` is the current status shown in the hero/quality cards.
- `plan.graph.historical` remains available for diagnostics.
- If the latest run has `failed=0`, stale errors such as `knowledge_service_status_500` are not shown as active warnings.
- Older failures can be shown as "anciens echecs resolus".

Graph warnings are fail-soft and non-blocking. A graph write failure must not invalidate the deterministic investment plan or weaken trade guardrails.

Known structured graph errors:

- `knowledge_ingest_permission_denied_storage`: `/data/knowledge-graph` is not writable by the knowledge-service app user.
- `knowledge_service_status_500`: knowledge service unavailable or failed; non-blocking for the plan.

## Knowledge Graph Storage Permissions

Production uses `KNOWLEDGE_GRAPH_STORAGE_PATH=/data/knowledge-graph`.

The knowledge-service process runs as the non-root `app` user. Docker volumes can be created or restored as `root:root 755`; in that state the local graph snapshot write fails with `PermissionError` during `/knowledge/ingest/advisor`.

Durable repo fix:

- the knowledge-service image pre-creates `/data/knowledge-graph` owned by `app:app`;
- the production and dev Compose files run a one-shot `knowledge-service-storage-init` step as root to repair existing named volumes with `chown app:app` and `chmod u+rwX,g+rwX`;
- the app logs startup storage diagnostics: path, current uid/gid, writability, and owner uid/gid;
- advisor ingest catches `PermissionError` and returns `knowledge_ingest_permission_denied_storage` with safe diagnostics instead of a vague internal error.

The manual hotfix worked because it changed the mounted directory from root-owned non-writable state to uid/gid writable state:

```bash
docker exec --user root finance-os-app-bm30nn-knowledge-service-1 sh -lc '
mkdir -p /data/knowledge-graph
chown -R 100:101 /data/knowledge-graph
chmod -R u+rwX,g+rwX /data/knowledge-graph
'
```

The Compose init step keeps that same permission shape durable across redeploys without using `chmod 777`.

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

1. Apply migrations through `0035_user_asset_interest.sql`.
2. Run `POST /ops/refresh/all` with `dryRun:true`.
3. Run `GET /dashboard/advisor/investment-strategy`; confirm strategy `bigzoo_growth_60_30_10_v1`.
4. Run `POST /dashboard/advisor/investment-plan/generate` with `dryRun:true`; confirm no writes.
5. Run the same endpoint without `dryRun` as admin/internal.
6. Open `/ia/strategie-investissement`.
7. Confirm every item shows `a valider manuellement` and `auto-trade: non`.
8. Run `POST /dashboard/advisor/investment-hypotheses/review-due` after due dates.
9. Check `GET /dashboard/advisor/investment-learning/scorecard`.
10. If graph ingest is enabled, check memory counters and knowledge-service logs.

Graph storage validation after deploy:

```bash
docker exec finance-os-app-bm30nn-knowledge-service-1 sh -lc '
id
touch /data/knowledge-graph/.write-test &&
rm /data/knowledge-graph/.write-test &&
echo OK
'
```

Then generate a non-dry-run plan and confirm `/knowledge/ingest/advisor` returns 200 in recent logs with no `PermissionError`.

## Safety Guarantees

- No broker order route was added.
- No buy/sell/execute endpoint or button was added.
- No Binance futures/margin/withdrawal/transfer/convert/staking mutation was added.
- IBKR remains Flex/reporting-read-only.
- Missing/stale/low-confidence price blocks buys.
- Unknown PEA eligibility blocks buys.
- Incompatible account eligibility blocks buys.
- `approved` is not required for recommendation.
- User watchlist interest does not force a recommendation.
- Demo mode stays deterministic and write-free.

## Future Pass: Metadata Coverage

Next work should improve metadata coverage without changing execution safety:

- record PEA eligibility for Core/Growth candidates;
- map provider symbols to price snapshots;
- expand free/local metadata for obscure assets and thematic ETFs;
- keep BTC/Binance candidate identity on `BTCEUR` when a fresh snapshot exists.

This remains read-only research/planning. It must not add order, buy, sell, execute, withdrawal, transfer, margin, futures, staking, or hidden execution paths.
