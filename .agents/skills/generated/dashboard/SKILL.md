---
name: dashboard
description: "Skill for the Dashboard area of finance-os. 93 symbols across 12 files."
---

# Dashboard

93 symbols | 12 files | Cohesion: 98%

## When to Use

- Working with code in `apps/`
- Understanding how DashboardAppShell, handleBlockedSyncClick, logDigest work
- Modifying dashboard-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/components/dashboard/dashboard-health.ts` | toTimestamp, hasPartialImportSignal, pickLatestTimestamp, getLatestSyncRun, isOlderThanThreshold (+11) |
| `apps/web/src/components/dashboard/app-shell.tsx` | toErrorMessage, formatDateTime, formatDuration, formatDiagnosticMetadata, formatRelativeDateTime (+10) |
| `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | formatMoney, formatDate, formatSnapshotDate, clampProgress, clampProgressFromInput (+9) |
| `apps/web/src/components/dashboard/wealth-history.tsx` | formatMoney, formatCompactMoney, formatDay, buildWealthHistoryExplanation, getSnapshotCoordinates (+4) |
| `apps/web/src/components/dashboard/month-end-projection-card.tsx` | asUtcDate, normalizeRecurringLabel, estimateMonthGap, hasStableAmount, calculateMonthlyRecurringOverview (+3) |
| `apps/web/src/components/dashboard/expense-structure-card.tsx` | formatMoney, formatPercent, buildExpenseStructureExplanation, ExpenseStructureCard, formatMonthLabel (+3) |
| `apps/web/src/components/dashboard/monthly-category-budgets-card.tsx` | formatMoney, readBudgets, writeBudgets, getDemoBudgetsForVisibleMonths, MonthlyCategoryBudgetsCard (+2) |
| `apps/web/src/components/dashboard/relevance-scoring.ts` | clamp, tokenize, rankNewsByRelevance, rankPersonalSignalsByRelevance |
| `apps/web/src/components/dashboard/powens-connections-card.tsx` | formatDateTime, toErrorMessage, formatSyncMetadata, PowensConnectionsCard |
| `apps/web/src/components/dashboard/latest-sync-status.ts` | toTimestamp, formatDateTime, getLatestSyncStatus |

## Entry Points

Start here when exploring this area:

- **`DashboardAppShell`** (Function) — `apps/web/src/components/dashboard/app-shell.tsx:518`
- **`handleBlockedSyncClick`** (Function) — `apps/web/src/components/dashboard/app-shell.tsx:1139`
- **`logDigest`** (Function) — `apps/web/src/components/dashboard/app-shell.tsx:1315`
- **`PersonalFinancialGoalsCard`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:271`
- **`invalidateGoals`** (Function) — `apps/web/src/components/dashboard/personal-financial-goals-card.tsx:290`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DashboardAppShell` | Function | `apps/web/src/components/dashboard/app-shell.tsx` | 518 |
| `handleBlockedSyncClick` | Function | `apps/web/src/components/dashboard/app-shell.tsx` | 1139 |
| `logDigest` | Function | `apps/web/src/components/dashboard/app-shell.tsx` | 1315 |
| `PersonalFinancialGoalsCard` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 271 |
| `invalidateGoals` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 290 |
| `openEditDrawer` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 381 |
| `submitCurrentForm` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 399 |
| `retryLastAction` | Function | `apps/web/src/components/dashboard/personal-financial-goals-card.tsx` | 421 |
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
| `buildExpenseStructureExplanation` | Function | `apps/web/src/components/dashboard/expense-structure-card.tsx` | 109 |

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

1. `gitnexus_context({name: "DashboardAppShell"})` — see callers and callees
2. `gitnexus_query({query: "dashboard"})` — find related execution flows
3. Read key files listed above for implementation details
