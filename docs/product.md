# Product and safety boundaries

Finance-OS is an advisory, read-only personal cockpit. It organizes financial data and analysis for one owner; it is not a bank, broker, robo-advisor, or multi-tenant platform.

## Main surfaces

| Area | Current role |
|---|---|
| Cockpit | Net worth, expense structure, alerts, commitments, and high-level status |
| Expenses | Transaction exploration, categorization, enrichment, recurring costs, budgets |
| Assets | Asset/position views, valuation, external investment snapshots |
| Goals | Personal financial goals and progress |
| Radar | Monitored markets, deterministic market signals, dated events, and freshness around the D3 Signal Field. Radar observes and never recommends |
| Social Intelligence | Source library: who Finance-OS listens to (identity, tags, light status). Source management and manual import are Admin-only |
| Integrations | Powens connection lifecycle plus read-only IBKR/Binance status and sync |
| Advisor | Monthly investment plan, allocation guidance, risk framing, and investment profile |
| Chat | Focused financial conversation with evidence, assumptions, caveats, and hypothetical simulations |
| Mémoire | Immersive temporal memory map for concepts, evidence, and relationships |
| Orchestration/health | Manual refresh, provider diagnostics, data quality, operation progress |
| Trading Lab | Research scenarios and backtests only |

The route tree under `apps/web/src/routes/` is the routing source of truth; `apps/web/src/components/shell/nav-items.ts` defines visible navigation.

Primary navigation follows the canonical Command Pixel route map: Cockpit, Argent (Dépenses, Patrimoine, Investissements, Objectifs), IA (Advisor, Chat, Mémoire), Radar, and Ops (Orchestration, Coûts, Intégrations, Santé, Admin mode only). Mobile uses Cockpit, Dépenses, Patrimoine, Advisor, and Plus (secondary destinations and Admin Ops entries). Nav visibility is not a security boundary; pages keep their own demo/admin handling.

Radar lives at `/radar` and Social Intelligence at `/social-intelligence`, a separate canonical screen of the Radar product area reached from Radar, the command palette, and the mobile Plus drawer; both are normal product destinations available in demo and admin. The legacy `/signaux`, `/signaux/marches`, `/marches`, and `/actualites` routes redirect permanently to `/radar`; `/signaux/social` and `/signaux/x-twitter` redirect to `/social-intelligence`.

## Sources of truth

| Domain | Admin source | Demo source |
|---|---|---|
| Bank accounts/transactions | Powens-normalized PostgreSQL rows | deterministic dashboard fixtures |
| External investments | IBKR Flex and Binance read-only snapshot tables | deterministic external-investment fixtures |
| Markets/news/signals | provider cache/state and normalized tables | deterministic market/news fixtures |
| Goals/budgets/commitments | PostgreSQL domain tables | deterministic domain fixtures |
| Financial calculations | `packages/finance-engine` over normalized input | same engine or versioned expected fixtures |
| Advisor narrative | audited provider run over deterministic bundle | deterministic Advisor fixtures |
| Knowledge graph | internal derived service | deterministic graph fixtures |

## Never allowed

- order placement, trading, withdrawal, transfer, convert, margin/futures, staking/earn mutation;
- automatic rebalancing or a hidden execution-ready path;
- browser forms or APIs for IBKR/Binance credentials;
- model/GraphRAG output treated as a transaction or numeric source of truth;
- provider, database, Redis, or model calls in demo mode;
- silent presentation of stale, partial, estimated, or contradictory data as complete.

## Degraded data

Surfaces state freshness and provenance. A delayed provider may use cached or partial values with clear copy; it must not block unrelated product areas. Currency/FX date, valuation timestamp, coverage gaps, and null/default rules are part of each contract.

## Changes to behavior

Update the relevant deterministic fixtures, contract tests, and one of the focused guides: [Integrations](integrations.md), [Advisor](advisor.md), or [Operations](operations.md). UI work follows [DESIGN.md](../DESIGN.md).
