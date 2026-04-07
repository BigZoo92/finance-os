---
name: features
description: "Skill for the Features area of finance-os. 30 symbols across 5 files."
---

# Features

30 symbols | 5 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how getDemoDashboardSummary, adaptDashboardSummaryLegacy, getDemoDashboardTransactions work
- Modifying features-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/features/demo-data.ts` | toMoney, toDateOnly, getRangeStartDate, listDatesInRange, buildDailyWealthSnapshots (+6) |
| `apps/web/src/features/dashboard-api.ts` | toSearchParams, fetchDashboardNews, fetchDashboardSummary, fetchDashboardTransactions, fetchDashboardAdvisor (+4) |
| `apps/web/src/features/dashboard-legacy-adapter.ts` | createDiagnostics, getMigrationStage, toArrayWithFallback, toTotalsWithFallback, logDashboardAdapterEvent (+1) |
| `apps/web/src/features/auth-ssr.ts` | getRequestAuthContext, fetchAuthMeFromSsr |
| `apps/web/src/features/ai-advisor-config.ts` | toBooleanFlag, getAiAdvisorUiFlags |

## Entry Points

Start here when exploring this area:

- **`getDemoDashboardSummary`** (Function) — `apps/web/src/features/demo-data.ts:81`
- **`adaptDashboardSummaryLegacy`** (Function) — `apps/web/src/features/dashboard-legacy-adapter.ts:125`
- **`getDemoDashboardTransactions`** (Function) — `apps/web/src/features/demo-data.ts:630`
- **`fetchDashboardNews`** (Function) — `apps/web/src/features/dashboard-api.ts:26`
- **`fetchDashboardSummary`** (Function) — `apps/web/src/features/dashboard-api.ts:58`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getDemoDashboardSummary` | Function | `apps/web/src/features/demo-data.ts` | 81 |
| `adaptDashboardSummaryLegacy` | Function | `apps/web/src/features/dashboard-legacy-adapter.ts` | 125 |
| `getDemoDashboardTransactions` | Function | `apps/web/src/features/demo-data.ts` | 630 |
| `fetchDashboardNews` | Function | `apps/web/src/features/dashboard-api.ts` | 26 |
| `fetchDashboardSummary` | Function | `apps/web/src/features/dashboard-api.ts` | 58 |
| `fetchDashboardTransactions` | Function | `apps/web/src/features/dashboard-api.ts` | 80 |
| `fetchDashboardAdvisor` | Function | `apps/web/src/features/dashboard-api.ts` | 244 |
| `normalizeDashboardDerivedRecomputeActionError` | Function | `apps/web/src/features/dashboard-api.ts` | 286 |
| `postDashboardDerivedRecompute` | Function | `apps/web/src/features/dashboard-api.ts` | 331 |
| `fetchAuthMeFromSsr` | Function | `apps/web/src/features/auth-ssr.ts` | 30 |
| `getAiAdvisorUiFlags` | Function | `apps/web/src/features/ai-advisor-config.ts` | 17 |
| `toMoney` | Function | `apps/web/src/features/demo-data.ts` | 39 |
| `toDateOnly` | Function | `apps/web/src/features/demo-data.ts` | 41 |
| `getRangeStartDate` | Function | `apps/web/src/features/demo-data.ts` | 43 |
| `listDatesInRange` | Function | `apps/web/src/features/demo-data.ts` | 49 |
| `buildDailyWealthSnapshots` | Function | `apps/web/src/features/demo-data.ts` | 62 |
| `createDiagnostics` | Function | `apps/web/src/features/dashboard-legacy-adapter.ts` | 40 |
| `getMigrationStage` | Function | `apps/web/src/features/dashboard-legacy-adapter.ts` | 55 |
| `toArrayWithFallback` | Function | `apps/web/src/features/dashboard-legacy-adapter.ts` | 71 |
| `toTotalsWithFallback` | Function | `apps/web/src/features/dashboard-legacy-adapter.ts` | 80 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildDailyWealthSnapshots → ToDateOnly` | intra_community | 4 |

## How to Explore

1. `gitnexus_context({name: "getDemoDashboardSummary"})` — see callers and callees
2. `gitnexus_query({query: "features"})` — find related execution flows
3. Read key files listed above for implementation details
