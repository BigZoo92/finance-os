---
name: repositories
description: "Skill for the Repositories area of finance-os. 38 symbols across 13 files."
---

# Repositories

38 symbols | 13 files | Cohesion: 96%

## When to Use

- Working with code in `apps/`
- Understanding how createRunDashboardDerivedRecomputeUseCase, exchangeCodeForToken, createHandlePowensCallbackUseCase work
- Modifying repositories-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/dashboard/repositories/dashboard-read-repository.ts` | toCursorPredicate, listTransactions, listTransactionSyncMetadata, listNewsArticles, upsertNewsArticles (+5) |
| `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | buildFallbackTransactionKey, sameInstant, createRun, updateRunProgress, markRunFailed (+3) |
| `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | toSnapshotVersion, DashboardDerivedRecomputeDisabledError, DashboardDerivedRecomputeAlreadyRunningError, DashboardDerivedRecomputeFailedError, createRunDashboardDerivedRecomputeUseCase |
| `apps/api/src/routes/integrations/powens/repositories/powens-connection-repository.ts` | upsertConnectedConnection, syncRunKey, isPowensSyncRun, listSyncRuns |
| `packages/powens/src/client.ts` | PowensApiError, exchangeCodeForToken |
| `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts` | toMoney, createGetDashboardTransactionsUseCase |
| `apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts` | createHandlePowensCallbackUseCase |
| `apps/api/src/routes/integrations/powens/repositories/powens-job-queue-repository.ts` | enqueueConnectionSync |
| `apps/api/src/routes/dashboard/domain/dashboard-news.ts` | createDashboardNewsUseCases |
| `apps/api/src/routes/dashboard/routes/transaction-classification.ts` | createTransactionClassificationRoute |

## Entry Points

Start here when exploring this area:

- **`createRunDashboardDerivedRecomputeUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/derived-recompute.ts:130`
- **`exchangeCodeForToken`** (Function) — `packages/powens/src/client.ts:232`
- **`createHandlePowensCallbackUseCase`** (Function) — `apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts:15`
- **`createGetDashboardTransactionsUseCase`** (Function) — `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts:56`
- **`createDashboardNewsUseCases`** (Function) — `apps/api/src/routes/dashboard/domain/dashboard-news.ts:9`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `DashboardDerivedRecomputeDisabledError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 82 |
| `DashboardDerivedRecomputeAlreadyRunningError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 93 |
| `DashboardDerivedRecomputeFailedError` | Class | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 104 |
| `PowensApiError` | Class | `packages/powens/src/client.ts` | 127 |
| `createRunDashboardDerivedRecomputeUseCase` | Function | `apps/api/src/routes/dashboard/domain/derived-recompute.ts` | 130 |
| `exchangeCodeForToken` | Function | `packages/powens/src/client.ts` | 232 |
| `createHandlePowensCallbackUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-handle-callback-use-case.ts` | 15 |
| `createGetDashboardTransactionsUseCase` | Function | `apps/api/src/routes/dashboard/domain/create-get-dashboard-transactions-use-case.ts` | 56 |
| `createDashboardNewsUseCases` | Function | `apps/api/src/routes/dashboard/domain/dashboard-news.ts` | 9 |
| `createTransactionClassificationRoute` | Function | `apps/api/src/routes/dashboard/routes/transaction-classification.ts` | 10 |
| `createUpdateTransactionClassificationUseCase` | Function | `apps/api/src/routes/dashboard/domain/create-update-transaction-classification-use-case.ts` | 33 |
| `createSyncRunsRoute` | Function | `apps/api/src/routes/integrations/powens/routes/sync-runs.ts` | 9 |
| `createGetDashboardGoalsUseCase` | Function | `apps/api/src/routes/dashboard/domain/dashboard-goals.ts` | 107 |
| `createRun` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 72 |
| `updateRunProgress` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 91 |
| `markRunFailed` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 101 |
| `acquireRunLock` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 117 |
| `releaseRunLock` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 125 |
| `recomputeFromSourceOfTruth` | Method | `apps/api/src/routes/dashboard/repositories/dashboard-derived-recompute-repository.ts` | 131 |
| `enqueueConnectionSync` | Method | `apps/api/src/routes/integrations/powens/repositories/powens-job-queue-repository.ts` | 7 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
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
