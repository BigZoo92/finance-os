---
name: domain
description: "Skill for the Domain area of finance-os. 96 symbols across 16 files."
---

# Domain

96 symbols | 16 files | Cohesion: 92%

## When to Use

- Working with code in `apps/`
- Understanding how createGoalsRoute, createCreateDashboardGoalUseCase, createUpdateDashboardGoalUseCase work
- Modifying domain-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/dashboard/domain/news-enrichment.ts` | collectRules, inferRiskFlags, inferOpportunityFlags, buildMacroLinks, buildPolicyLinks (+14) |
| `apps/api/src/routes/dashboard/repositories/dashboard-read-repository.ts` | getGoalRowById, getGoalById, createGoal, updateGoal, archiveGoal (+7) |
| `apps/api/src/routes/dashboard/domain/dashboard-goals.ts` | toRoundedAmount, toIsoString, normalizeSnapshotHistory, buildSnapshotHistory, normalizeWriteInput (+5) |
| `apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.ts` | toNumber, toMoney, toIsoString, toDateOnly, makeGroupLabel (+3) |
| `apps/api/src/routes/dashboard/domain/analytics-contract.ts` | toState, getDisabledWidgets, normalizeLabel, asUtcDate, estimateMonthGap (+3) |
| `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | normalizeText, amountDirection, isUnknownCategory, matchesRule, selectBestRule (+2) |
| `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | normalizeLabel, getPeriodicityFromAverageGap, toEpochDay, hasStableAmount, groupByRecurringSignal (+1) |
| `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | toIsoString, mapRunResponse, buildStatusResponse, createGetDashboardDerivedRecomputeStatusUseCase |
| `apps/api/src/routes/dashboard/domain/news-dedupe.ts` | tokenizeTitle, jaccardSimilarity, sharedEntityNames, resolveNewsDuplicate |
| `apps/api/src/routes/dashboard/domain/news-context-bundle.ts` | takeTop, buildNewsClusters, buildNewsContextBundle, sortMapEntries |

## Entry Points

Start here when exploring this area:

- **`createGoalsRoute`** (Function) — `apps/api/src/routes/dashboard/routes/goals.ts:10`
- **`createCreateDashboardGoalUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/dashboard-goals.ts:121`
- **`createUpdateDashboardGoalUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/dashboard-goals.ts:139`
- **`createArchiveDashboardGoalUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/dashboard-goals.ts:168`
- **`createGetDashboardSummaryUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.ts:182`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createGoalsRoute` | Function | `apps/api/src/routes/dashboard/routes/goals.ts` | 10 |
| `createCreateDashboardGoalUseCase` | Function | `apps/api/src/routes/dashboard/domain/dashboard-goals.ts` | 121 |
| `createUpdateDashboardGoalUseCase` | Function | `apps/api/src/routes/dashboard/domain/dashboard-goals.ts` | 139 |
| `createArchiveDashboardGoalUseCase` | Function | `apps/api/src/routes/dashboard/domain/dashboard-goals.ts` | 168 |
| `createGetDashboardSummaryUseCase` | Function | `apps/api/src/routes/dashboard/domain/create-get-dashboard-summary-use-case.ts` | 182 |
| `createNormalizedNewsSignal` | Function | `apps/api/src/routes/dashboard/domain/news-enrichment.ts` | 890 |
| `mapSummaryToAnalyticsContract` | Function | `apps/api/src/routes/dashboard/domain/analytics-contract.ts` | 168 |
| `normalizeText` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 135 |
| `amountDirection` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 143 |
| `isUnknownCategory` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 145 |
| `matchesRule` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 147 |
| `selectBestRule` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 184 |
| `withTraceStep` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 193 |
| `applyTransactionAutoCategorization` | Function | `apps/api/src/routes/dashboard/domain/transaction-auto-categorization.ts` | 206 |
| `normalizeLabel` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 41 |
| `getPeriodicityFromAverageGap` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 50 |
| `toEpochDay` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 67 |
| `hasStableAmount` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 76 |
| `groupByRecurringSignal` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 90 |
| `detectRecurringCommitmentSuggestions` | Function | `apps/api/src/routes/dashboard/domain/detect-recurring-commitments.ts` | 125 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateUpdateDashboardGoalUseCase → ToRoundedAmount` | intra_community | 5 |
| `CreateCreateDashboardGoalUseCase → ToRoundedAmount` | intra_community | 5 |
| `CreateArchiveDashboardGoalUseCase → ToRoundedAmount` | intra_community | 4 |
| `CreateGetDashboardDerivedRecomputeStatusUseCase → ToIsoString` | intra_community | 4 |
| `CreateNormalizedNewsSignal → MatchesAny` | cross_community | 3 |
| `CreateNormalizedNewsSignal → AddUnique` | cross_community | 3 |
| `CreateUpdateDashboardGoalUseCase → GetGoalRowById` | intra_community | 3 |
| `DetectRecurringCommitmentSuggestions → NormalizeLabel` | intra_community | 3 |
| `CreateGoalsRoute → GetGoalRowById` | intra_community | 3 |
| `CreateCreateDashboardGoalUseCase → GetGoalRowById` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "createGoalsRoute"})` — see callers and callees
2. `gitnexus_query({query: "domain"})` — find related execution flows
3. Read key files listed above for implementation details
