---
name: repositories
description: "Skill for the Repositories area of finance-os. 50 symbols across 15 files."
---

# Repositories

50 symbols | 15 files | Cohesion: 97%

## When to Use

- Working with code in `apps/`
- Understanding how createRunDashboardDerivedRecomputeUseCase, createDashboardNewsUseCases, listSourceRefsByArticleIds work
- Modifying repositories-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/dashboard/repositories/dashboard-news-repository.ts` | jsonbArrayContains, listSourceRefsByArticleIds, listNewsArticles, countNewsArticles, getNewsCacheState (+8) |
| `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | buildFallbackTransactionKey, sameInstant, createRun, updateRunProgress, markRunFailed (+3) |
| `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | toSnapshotVersion, DashboardDerivedRecomputeDisabledError, DashboardDerivedRecomputeAlreadyRunningError, DashboardDerivedRecomputeFailedError, createRunDashboardDerivedRecomputeUseCase |
| `apps/api/src/routes/integrations/powens/repositories/powens-connection-repository.ts` | upsertConnectedConnection, syncRunKey, isPowensSyncRun, listSyncRuns, listConnectionStatuses |
| `apps/api/src/routes/dashboard/repositories/dashboard-read-repository.ts` | toCursorPredicate, listTransactions, listTransactionSyncMetadata, normalizeMerchantOverride, updateTransactionClassification |
| `apps/api/src/routes/dashboard/domain/dashboard-news.ts` | toRangeWindowStart, createDashboardNewsUseCases |
| `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | buildPersistableSignal, run |
| `packages/powens/src/client.ts` | PowensApiError, exchangeCodeForToken |
| `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts` | toMoney, createGetDashboardTransactionsUseCase |
| `apps/api/src/routes/integrations/powens/repositories/powens-job-queue-repository.ts` | enqueueConnectionSync |

## Entry Points

Start here when exploring this area:

- **`createRunDashboardDerivedRecomputeUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/derived-recompute.ts:130`
- **`createDashboardNewsUseCases`** (Function) — `apps/api/src/routes/dashboard/domain/dashboard-news.ts:18`
- **`listSourceRefsByArticleIds`** (Function) — `apps/api/src/routes/dashboard/repositories/dashboard-news-repository.ts:56`
- **`exchangeCodeForToken`** (Function) — `packages/powens/src/client.ts:234`
- **`createHandlePowensCallbackUseCase`** (Function) — `apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DashboardDerivedRecomputeDisabledError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 82 |
| `DashboardDerivedRecomputeAlreadyRunningError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 93 |
| `DashboardDerivedRecomputeFailedError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 104 |
| `PowensApiError` | Class | `packages/powens/src/client.ts` | 129 |
| `createRunDashboardDerivedRecomputeUseCase` | Function | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 130 |
| `createDashboardNewsUseCases` | Function | `apps/api/src/routes/dashboard/domain/dashboard-news.ts` | 18 |
| `listSourceRefsByArticleIds` | Function | `apps/api/src/routes/dashboard/repositories/dashboard-news-repository.ts` | 56 |
| `exchangeCodeForToken` | Function | `packages/powens/src/client.ts` | 234 |
| `createHandlePowensCallbackUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts` | 15 |
| `createGetDashboardTransactionsUseCase` | Function | `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts` | 56 |
| `createTransactionClassificationRoute` | Function | `apps/api/src/routes/dashboard/routes/transaction-classification.ts` | 10 |
| `createUpdateTransactionClassificationUseCase` | Function | `apps/api/src/routes/dashboard/domain/create-update-transaction-classification-use-case.ts` | 33 |
| `createSyncRunsRoute` | Function | `apps/api/src/routes/integrations/powens/routes/sync-runs.ts` | 9 |
| `createListStatusesUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-list-statuses-use-case.ts` | 6 |
| `createRun` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 71 |
| `updateRunProgress` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 90 |
| `markRunFailed` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 100 |
| `acquireRunLock` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 116 |
| `releaseRunLock` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 124 |
| `recomputeFromSourceOfTruth` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 130 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `Run → SourcePriority` | intra_community | 3 |
| `Run → MergeUniqueByJson` | intra_community | 3 |
| `CreateDashboardNewsUseCases → JsonbArrayContains` | intra_community | 3 |
| `CreateDashboardNewsUseCases → ListSourceRefsByArticleIds` | intra_community | 3 |
| `CreateGetDashboardTransactionsUseCase → ToCursorPredicate` | intra_community | 3 |
| `CreateHandlePowensCallbackUseCase → PowensApiError` | intra_community | 3 |
| `CreateTransactionClassificationRoute → NormalizeMerchantOverride` | intra_community | 3 |
| `CreateUpdateTransactionClassificationUseCase → NormalizeMerchantOverride` | intra_community | 3 |
| `CreateSyncRunsRoute → SyncRunKey` | intra_community | 3 |
| `CreateSyncRunsRoute → IsPowensSyncRun` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Domain | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createRunDashboardDerivedRecomputeUseCase"})` — see callers and callees
2. `gitnexus_query({query: "repositories"})` — find related execution flows
3. Read key files listed above for implementation details
