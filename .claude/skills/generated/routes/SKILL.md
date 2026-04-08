---
name: routes
description: "Skill for the Routes area of finance-os. 54 symbols across 22 files."
---

# Routes

54 symbols | 22 files | Cohesion: 99%

## When to Use

- Working with code in `apps/`
- Understanding how createAdvisorRoute, createEnrichmentNotesRoute, createEnrichmentBulkTriageRoute work
- Modifying routes-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/routes/transactions.tsx` | resolveRange, formatCurrency, formatDate, toErrorMessage, filterTransactions (+1) |
| `apps/api/src/routes/dashboard/routes/advisor.ts` | clampImpactEstimate, buildLocalInsights, buildActionTracking, buildDecisionWorkflow, buildLocalActions (+1) |
| `apps/api/src/routes/integrations/powens/routes/status.test.ts` | createConnectionStatus, createLatestCallback, createPowensRuntime, createStatusTestApp |
| `apps/api/src/routes/dashboard/routes/news.test.ts` | createNewsPayload, createDashboardRuntime, createNewsTestApp |
| `apps/api/src/routes/dashboard/routes/goals.test.ts` | createGoalPayload, createDashboardRuntime, createGoalsTestApp |
| `apps/api/src/routes/dashboard/routes/derived-recompute.test.ts` | createDerivedRecomputePayload, createDashboardRuntime, createDerivedRecomputeTestApp |
| `apps/api/src/routes/dashboard/routes/analytics.test.ts` | buildSummary, createDashboardRuntime, createAnalyticsTestApp |
| `apps/api/src/routes/enrichment/routes/notes.ts` | normalizeItemKeys, createEnrichmentNotesRoute |
| `apps/api/src/routes/enrichment/repositories/enrichment-notes-repository.ts` | listByItemKeys, upsertOne |
| `apps/api/src/routes/dashboard/routes/transactions.ts` | createTransactionsRoute, logResolutionStats |

## Entry Points

Start here when exploring this area:

- **`createAdvisorRoute`** (Function) — `apps/api/src/routes/dashboard/routes/advisor.ts:206`
- **`createEnrichmentNotesRoute`** (Function) — `apps/api/src/routes/enrichment/routes/notes.ts:15`
- **`createEnrichmentBulkTriageRoute`** (Function) — `apps/api/src/routes/enrichment/routes/bulk-triage.ts:10`
- **`requestTransactionsBackgroundRefresh`** (Function) — `apps/api/src/routes/dashboard/runtime.ts:61`
- **`createTransactionsRoute`** (Function) — `apps/api/src/routes/dashboard/routes/transactions.ts:15`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `createAdvisorRoute` | Function | `apps/api/src/routes/dashboard/routes/advisor.ts` | 206 |
| `createEnrichmentNotesRoute` | Function | `apps/api/src/routes/enrichment/routes/notes.ts` | 15 |
| `createEnrichmentBulkTriageRoute` | Function | `apps/api/src/routes/enrichment/routes/bulk-triage.ts` | 10 |
| `requestTransactionsBackgroundRefresh` | Function | `apps/api/src/routes/dashboard/runtime.ts` | 61 |
| `createTransactionsRoute` | Function | `apps/api/src/routes/dashboard/routes/transactions.ts` | 15 |
| `logResolutionStats` | Function | `apps/api/src/routes/dashboard/routes/transactions.ts` | 27 |
| `createBacklogRoute` | Function | `apps/api/src/routes/integrations/powens/routes/backlog.ts` | 4 |
| `createGetSyncBacklogCountUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-get-sync-backlog-count-use-case.ts` | 6 |
| `registerSystemRoutes` | Function | `apps/api/src/routes/system.ts` | 21 |
| `createDerivedRecomputeRoute` | Function | `apps/api/src/routes/dashboard/routes/derived-recompute.ts` | 20 |
| `listByItemKeys` | Method | `apps/api/src/routes/enrichment/repositories/enrichment-notes-repository.ts` | 16 |
| `upsertOne` | Method | `apps/api/src/routes/enrichment/repositories/enrichment-notes-repository.ts` | 24 |
| `enqueueAllConnectionsSync` | Method | `apps/api/src/routes/integrations/powens/repositories/powens-job-queue-repository.ts` | 18 |
| `getSyncBacklogCount` | Method | `apps/api/src/routes/integrations/powens/repositories/powens-job-queue-repository.ts` | 27 |
| `resolveRange` | Function | `apps/web/src/routes/transactions.tsx` | 21 |
| `formatCurrency` | Function | `apps/web/src/routes/transactions.tsx` | 25 |
| `formatDate` | Function | `apps/web/src/routes/transactions.tsx` | 33 |
| `toErrorMessage` | Function | `apps/web/src/routes/transactions.tsx` | 39 |
| `filterTransactions` | Function | `apps/web/src/routes/transactions.tsx` | 66 |
| `TransactionsPage` | Function | `apps/web/src/routes/transactions.tsx` | 83 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateTransactionsRoute → EnqueueAllConnectionsSync` | intra_community | 3 |
| `CreateAdvisorRoute → ClampImpactEstimate` | intra_community | 3 |
| `CreateAdvisorRoute → BuildDecisionWorkflow` | intra_community | 3 |
| `CreateAdvisorRoute → BuildActionTracking` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "createAdvisorRoute"})` — see callers and callees
2. `gitnexus_query({query: "routes"})` — find related execution flows
3. Read key files listed above for implementation details
