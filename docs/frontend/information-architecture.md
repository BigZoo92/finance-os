# Information Architecture - Finance-OS

Last updated: 2026-08-07 (RESET-AUDIT-CLEANUP-0)

Finance-OS keeps everyday use separate from expert/admin operations. Demo
navigation must stay small and deterministic; admin can access Ops surfaces
behind the admin session.

## Everyday Cockpit

| Route | Role | Nav |
|---|---|---|
| `/` | Daily overview, KPIs, connections | Mobile tab 1 |
| `/depenses` | Transactions, income, spending, budgets | Mobile tab 2 |
| `/patrimoine` | Assets, balances, wealth trajectory | Mobile tab 3 |
| `/investissements` | Read-only investment portfolio view | More |
| `/objectifs` | Personal goals | More |

## Advisor

| Route | Role | Nav |
|---|---|---|
| `/ia` | Advisor hub, recommendations, assumptions | Mobile tab 4 |
| `/ia/strategie-investissement` | Investment action plan, advisory-only | More |
| `/ia/chat` | Advisor questions | More |
| `/ia/memoire` | Derived memory inspection | More |
| `/ia/memoire/graph` | 3D derived memory view | More |

Advisor memory is derived context only. It is not a source of truth and never
enables trading or execution.

## Ops / Admin

These routes are hidden outside admin navigation and command palette results.
The routes still keep their own guards/fail-soft behavior.

| Route | Role |
|---|---|
| `/signaux` | Signals hub (temporary; future merged Radar page) |
| `/signaux/marches` | Market/macro signals |
| `/signaux/social` | Followed social accounts (X/Bluesky) |
| `/ia/trading-lab` | Paper research and backtests, no execution |
| `/ia/couts` | Advisor, X, and provider subscription costs |
| `/integrations` | Provider connections |
| `/sante` | Admin health/status |
| `/orchestration` | Daily Intelligence and stale-run recovery |

## Removed pages (RESET-AUDIT-CLEANUP-0)

| Route | Decision |
|---|---|
| `/fiscalite` | Feature removed from the product (frontend-only; no backend existed). URL now 404s. |
| `/signaux/sources` | Page removed; ingestion/provider pipelines untouched. Technical info will resurface in Ops later. |
| `/signaux/free-firehose` | Standalone page removed; backend endpoints/jobs kept. Future home: Orchestration. |
| `/ops-env-diagnostics` | Page removed; env validation, guards and the `/ops/env/diagnostics` API endpoint kept. |
| `/parametres` | Page removed (placeholders + movable admin actions). Recompute -> Orchestration later; push notifications UI only if made functional; exports live on Dépenses. |

Removed URLs intentionally 404 (routes deleted, no redirects added).

## Redirects

| Old route | New route | Status |
|---|---|---|
| `/transactions` | `/depenses` | 301 |
| `/_app/actualites` | `/signaux` | 301 |
| `/_app/marches` | `/signaux/marches` | 301 |
| `/_app/memoire` | `/ia/memoire` | 301 |
| `/_app/signaux/x-twitter` | `/signaux/social` | replace |

## Mobile Navigation

Bottom nav is intentionally short:

1. Vue d'ensemble
2. Depenses & revenus
3. Patrimoine
4. Vue IA
5. More

The More drawer uses the same `NAV_ITEMS` source as desktop and applies the
same admin filtering.

## Source Of Truth

Navigation items live in `apps/web/src/components/shell/nav-items.ts`.
Command palette pages derive from the same list, so `adminOnly` controls both
sidebar/mobile nav and command palette visibility.
