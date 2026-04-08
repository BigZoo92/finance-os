---
name: dashboard
description: "Skill for the Dashboard area of finance-os. 75 symbols across 11 files."
---

# Dashboard

75 symbols | 11 files | Cohesion: 97%

## When to Use

- Working with code in `apps/`
- Understanding how PersonalFinancialGoalsCard, invalidateGoals, openEditDrawer work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/dashboard/dashboard-health.ts` | toTimestamp, hasPartialImportSignal, pickLatestTimestamp, getLatestSyncRun, isOlderThanThreshold (+11) |
| `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | formatMoney, formatDate, clampProgress, clampProgressFromInput, getGoalStatus (+8) |
| `apps/web/src/components/dashboard/wealth-history.tsx` | formatMoney, formatCompactMoney, formatDay, buildWealthHistoryExplanation, getSnapshotCoordinates (+4) |
| `apps/web/src/components/dashboard/month-end-projection-card.tsx` | asUtcDate, normalizeRecurringLabel, estimateMonthGap, hasStableAmount, calculateMonthlyRecurringOverview (+3) |
| `apps/web/src/components/dashboard/monthly-category-budgets-card.tsx` | formatMoney, readBudgets, writeBudgets, getDemoBudgetsForVisibleMonths, MonthlyCategoryBudgetsCard (+2) |
| `apps/web/src/components/dashboard/expense-structure-card.tsx` | fmtMoney, fmtPct, buildExpenseStructureExplanation, ExpenseStructureCard, fmtMonth (+1) |
| `apps/web/src/components/dashboard/relevance-scoring.ts` | clamp, tokenize, rankNewsByRelevance, rankPersonalSignalsByRelevance |
| `apps/web/src/components/dashboard/powens-connections-card.tsx` | formatDateTime, toErrorMessage, formatSyncMetadata, PowensConnectionsCard |
| `apps/web/src/components/dashboard/latest-sync-status.ts` | toTimestamp, formatDateTime, getLatestSyncStatus |
| `apps/web/src/components/dashboard/api-status-card.tsx` | toErrorMessage, toApiStatus, ApiStatusCard |

## Entry Points

Start here when exploring this area:

- **`PersonalFinancialGoalsCard`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:269`
- **`invalidateGoals`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:288`
- **`openEditDrawer`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:379`
- **`submitCurrentForm`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:397`
- **`retryLastAction`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:419`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PersonalFinancialGoalsCard` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 269 |
| `invalidateGoals` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 288 |
| `openEditDrawer` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 379 |
| `submitCurrentForm` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 397 |
| `retryLastAction` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 419 |
| `buildWealthHistoryExplanation` | Function | `apps/web/src/components/dashboard/wealth-history.tsx` | 89 |
| `WealthHistory` | Function | `apps/web/src/components/dashboard/wealth-history.tsx` | 243 |
| `MonthlyCategoryBudgetsCard` | Function | `apps/web/src/components/dashboard/monthly-category-budgets-card.tsx` | 141 |
| `handleAddBudget` | Function | `apps/web/src/components/dashboard/monthly-category-budgets-card.tsx` | 195 |
| `handleDeleteBudget` | Function | `apps/web/src/components/dashboard/monthly-category-budgets-card.tsx` | 218 |
| `calculateMonthlyRecurringOverview` | Function | `apps/web/src/components/dashboard/month-end-projection-card.tsx` | 94 |
| `calculateMonthEndProjection` | Function | `apps/web/src/components/dashboard/month-end-projection-card.tsx` | 184 |
| `buildDashboardHealthModel` | Function | `apps/web/src/components/dashboard/dashboard-health.ts` | 568 |
| `rankNewsByRelevance` | Function | `apps/web/src/components/dashboard/relevance-scoring.ts` | 32 |
| `rankPersonalSignalsByRelevance` | Function | `apps/web/src/components/dashboard/relevance-scoring.ts` | 97 |
| `PowensConnectionsCard` | Function | `apps/web/src/components/dashboard/powens-connections-card.tsx` | 52 |
| `buildExpenseStructureExplanation` | Function | `apps/web/src/components/dashboard/expense-structure-card.tsx` | 45 |
| `ExpenseStructureCard` | Function | `apps/web/src/components/dashboard/expense-structure-card.tsx` | 53 |
| `getLatestSyncStatus` | Function | `apps/web/src/components/dashboard/latest-sync-status.ts` | 39 |
| `ApiStatusCard` | Function | `apps/web/src/components/dashboard/api-status-card.tsx` | 40 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `BuildDashboardHealthModel → DedupeReasons` | intra_community | 4 |
| `BuildDashboardHealthModel → ToTimestamp` | cross_community | 4 |
| `BuildDashboardHealthModel → IsOlderThanThreshold` | cross_community | 3 |
| `BuildDashboardHealthModel → HasPartialImportSignal` | cross_community | 3 |
| `MonthlyCategoryBudgetsCard → WriteBudgets` | intra_community | 3 |
| `CalculateMonthlyRecurringOverview → AsUtcDate` | intra_community | 3 |
| `ApiStatusCard → ToErrorMessage` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "PersonalFinancialGoalsCard"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
