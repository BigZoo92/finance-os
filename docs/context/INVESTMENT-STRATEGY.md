# Investment Strategy Brain

Last updated: 2026-05-23

Finance-OS now has an account-aware Investment Research Copilot. It is a research and decision-support surface only: it never places orders, never exposes an execution button, and marks every recommendation with `humanValidationRequired=true` and `noAutoTrade=true`.

## Strategy

Default seeded strategy: `bigzoo_growth_60_30_10_v1`.

Target buckets:

| Bucket | Target | Role | Default stance |
|---|---:|---|---|
| `core` | 60% | Long-term base, diversified, liquid, lower-to-medium risk | Prefer PEA when eligibility is known and approved |
| `growth` | 30% | Higher expected growth, controlled concentration | PEA or IBKR depending on eligibility/data quality |
| `asymmetric` | 10% | High-risk/high-upside exposure, mostly crypto | Binance/IBKR only, capped at 10% global |

The model follows an IPS-style approach: objectives, time horizon, constraints, allocation, monitoring, and review cadence are explicit before recommendations. This is aligned with CFA Institute guidance on written investment policy statements and suitability constraints, and with Investor.gov/FINRA guidance that allocation, diversification, and rebalancing are risk controls, not return guarantees.

Reference sources used for the policy model:

- CFA Institute, [Basics of Portfolio Planning and Construction](https://www.cfainstitute.org/insights/professional-learning/refresher-readings/2026/basics-of-portfolio-planning-and-construction)
- CFA Institute, [Standard III(C) Suitability](https://www.cfainstitute.org/standards/professionals/code-ethics-standards/standards-of-practice-iii-c)
- Investor.gov, [Asset Allocation and Diversification](https://www.investor.gov/introduction-investing/getting-started/asset-allocation)
- FINRA, [Asset Allocation and Diversification](https://www.finra.org/investors/investing/investing-basics/asset-allocation-diversification)

## Account Policies

| Account | Type | Allowed buckets | Hard guards |
|---|---|---|---|
| PEA Trade Republic | `pea` | `core`, `growth` | No crypto. Unknown PEA eligibility blocks buys. Candidate assets must be manually approved. |
| IBKR | `brokerage` | `core`, `growth`, limited `asymmetric` | No margin/leverage by default. Currency and concentration risk reduce confidence. |
| Binance | `crypto` | `asymmetric` | Crypto max 10% global. No futures, no margin, no staking/earn mutation, no high-frequency trading. |

PEA rules are deliberately conservative. AMF and Service-Public describe PEA as a long-term equity wrapper with eligibility constraints. Finance-OS therefore treats unknown PEA eligibility as `watch` or `insufficient_data`, never `buy`.

Reference sources:

- AMF, [PEA: tout savoir sur le plan d'epargne en actions](https://www.amf-france.org/fr/espace-epargnants/comprendre-les-produits-financiers/supports-dinvestissement/pea-tout-savoir-sur-le-plan-depargne-en-actions)
- Service-Public, [Plan d'epargne en actions](https://www.service-public.gouv.fr/particuliers/vosdroits/F2385)

## Data Freshness

Every action-plan item carries price metadata:

- `provider`
- `sourceType`: `realtime`, `delayed`, `eod`, `broker`, `computed`, or `fallback`
- `marketTimestamp`
- `fetchedAt`
- `delaySeconds`
- `ageSeconds`
- `isStale`
- `confidence`
- `currency`
- `providerHealth`
- `fallbackReason`

Strict rule: missing, stale, fallback-low-confidence, or low-confidence price data blocks `buy`. Allowed fallback actions are `hold`, `watch`, `avoid`, or `insufficient_data`.

Crypto price metadata can use Binance Spot public market data already present in the valuation foundation. Binance's official Spot REST docs expose public market-data endpoints such as `GET /api/v3/ticker/price` for latest symbol prices. Finance-OS still records freshness and never labels data real-time unless the source contract supports it.

Reference sources:

- Binance Developers, [Spot Market Data endpoints](https://developers.binance.com/docs/binance-spot-api-docs/rest-api/market-data-endpoints)
- IBKR Campus, [Flex Web Service](https://www.interactivebrokers.com/campus/ibkr-api-page/flex-web-service/)
- Twelve Data, [API documentation](https://twelvedata.com/docs)

## Candidate Universe

The default universe is intentionally seeded as `candidate_needs_review`, not approved. This prevents fake strong-buy output on unverified instruments.

Valid statuses:

- `approved`: may be considered for buy if price, account, concentration, and confidence checks pass.
- `candidate_needs_review`: may produce watch/configuration tasks, not buy.
- `rejected`: should produce avoid/watch only.
- `unknown`: insufficient data.

PEA-specific eligibility statuses:

- `eligible`
- `ineligible`
- `unknown`
- `not_applicable`

Unknown PEA eligibility blocks buys.

## Allocation And Contributions

`portfolio_allocation_snapshot` persists the current split and data quality. `strategy_drift_snapshot` persists bucket drift versus target.

Rebalancing is threshold-based:

- daily monitoring;
- alert when a bucket drifts by more than the strategy threshold, default 5 points;
- prefer contribution-based rebalancing before selling;
- avoid sells when amount is small or fees/data quality dominate.

Monthly contributions use `monthlyContributionTarget` and are allocated first to underweight buckets that pass policy checks.

## Learning Loop

Important action-plan items create hypotheses with J+1, J+7, and J+30 review rows. Reviews compute:

- realized performance;
- performance versus benchmark when available;
- direction hit/miss;
- skipped outcomes for stale/missing price;
- Brier score when enough probabilistic outcomes exist;
- calibration buckets: 50-60, 60-70, 70-80, 80-90, 90-100.

Brier score is not used alone. The scorecard also exposes hit rate, average confidence, sample size, and breakdown placeholders by horizon/account/bucket/asset class.

Post-mortems are deterministic by default when LLM budget/runtime is unavailable. They cite persisted hypothesis/outcome data and can create `strategy_lesson` candidates. Lessons are `candidate` with `requiresHumanReview=true`; the active strategy is not mutated automatically.

## Knowledge Memory

Advisor memory events are written for action plans, recommendations, hypotheses, outcomes, post-mortems, lessons, data-quality issues, stale providers, and risk-limit triggers.

Graph ingest is fail-soft and only attempts network writes when both are true:

- `KNOWLEDGE_SERVICE_ENABLED=true`
- `ADVISOR_GRAPH_INGEST_ENABLED=true`

Postgres remains canonical. The graph receives compact advisory-only payloads, never provider credentials or raw signed payloads.

## AI Guardrails

The ESMA AI/investment-services statement emphasizes transparency, client best interest, governance, data quality, record keeping, and clear/not misleading AI disclosures. Finance-OS implements these as product constraints:

- no order placement or execution paths;
- explicit uncertainty and confidence;
- visible data freshness;
- persistent records of recommendations and outcomes;
- reviewable lessons, no automatic strategy mutation;
- degraded/insufficient-data states instead of fabricated conclusions.

Reference source:

- ESMA, [Public Statement on AI and investment services](https://www.esma.europa.eu/sites/default/files/2024-05/ESMA35-335435667-5924__Public_Statement_on_AI_and_investment_services.pdf)
