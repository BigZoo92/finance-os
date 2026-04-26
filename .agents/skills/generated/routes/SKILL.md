<!-- GENERATED — DO NOT EDIT
     Source: .agentic/source/skills/generated/routes/SKILL.md
     Hash:   sha256:025da88f20cab947
     Sync:   pnpm agent:skills:sync -->

---
name: routes
description: "Skill for the Routes area of finance-os. 72 symbols across 32 files."
---

# Routes

72 symbols | 32 files | Cohesion: 99%

## When to Use

- Working with code in `apps/`
- Understanding how createSyncRoute, createConnectUrlRoute, createCallbackRoute work
- Modifying routes-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/web/src/routes/transactions.tsx` | resolveRange, formatCurrency, formatDate, toErrorMessage, filterTransactions (+1) |
| `apps/api/src/routes/dashboard/routes/advisor.ts` | clampImpactEstimate, buildLocalInsights, buildActionTracking, buildDecisionWorkflow, buildLocalActions (+1) |
| `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | recordEvent, safeParseEvent, listRecentEvents, getLatestCallback |
| `apps/api/src/routes/integrations/powens/routes/status.test.ts` | createConnectionStatus, createLatestCallback, createPowensRuntime, createStatusTestApp |
| `apps/api/src/routes/integrations/powens/services/create-powens-connect-url-service.ts` | withStateQueryParam, getConnectUrl, isCallbackStateValid |
| `apps/api/src/routes/dashboard/routes/news.test.ts` | createNewsPayload, createDashboardRuntime, createNewsTestApp |
| `apps/api/src/routes/dashboard/routes/goals.test.ts` | createGoalPayload, createDashboardRuntime, createGoalsTestApp |
| `apps/api/src/routes/dashboard/routes/derived-recompute.test.ts` | createDerivedRecomputePayload, createDashboardRuntime, createDerivedRecomputeTestApp |
| `apps/api/src/routes/dashboard/routes/analytics.test.ts` | buildSummary, createDashboardRuntime, createAnalyticsTestApp |
| `apps/api/src/routes/integrations/powens/routes/callback.ts` | sanitizeConnectionId, createCallbackRoute |

## Entry Points

Start here when exploring this area:

- **`createSyncRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/sync.ts:9`
- **`createConnectUrlRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/connect-url.ts:7`
- **`createCallbackRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/callback.ts:14`
- **`recordEvent`** (Function) — `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts:67`
- **`requestTransactionsBackgroundRefresh`** (Function) — `apps/api/src/routes/dashboard/runtime.ts:114`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `PowensManualSyncRateLimitError` | Class | `apps/api/src/routes/integrations/powens/domain/powens-sync-errors.ts` | 0 |
| `createSyncRoute` | Function | `apps/api/src/routes/integrations/powens/routes/sync.ts` | 9 |
| `createConnectUrlRoute` | Function | `apps/api/src/routes/integrations/powens/routes/connect-url.ts` | 7 |
| `createCallbackRoute` | Function | `apps/api/src/routes/integrations/powens/routes/callback.ts` | 14 |
| `recordEvent` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 67 |
| `requestTransactionsBackgroundRefresh` | Function | `apps/api/src/routes/dashboard/runtime.ts` | 114 |
| `createTransactionsRoute` | Function | `apps/api/src/routes/dashboard/routes/transactions.ts` | 15 |
| `logResolutionStats` | Function | `apps/api/src/routes/dashboard/routes/transactions.ts` | 27 |
| `createRequestSyncUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-request-sync-use-case.ts` | 16 |
| `createAdvisorRoute` | Function | `apps/api/src/routes/dashboard/routes/advisor.ts` | 206 |
| `createStatusRoute` | Function | `apps/api/src/routes/integrations/powens/routes/status.ts` | 24 |
| `createAuditTrailRoute` | Function | `apps/api/src/routes/integrations/powens/routes/audit-trail.ts` | 6 |
| `listRecentEvents` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 73 |
| `getLatestCallback` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 87 |
| `createEnrichmentNotesRoute` | Function | `apps/api/src/routes/enrichment/routes/notes.ts` | 15 |
| `createEnrichmentBulkTriageRoute` | Function | `apps/api/src/routes/enrichment/routes/bulk-triage.ts` | 10 |
| `createBacklogRoute` | Function | `apps/api/src/routes/integrations/powens/routes/backlog.ts` | 4 |
| `createGetSyncBacklogCountUseCase` | Function | `apps/api/src/routes/integrations/powens/domain/create-get-sync-backlog-count-use-case.ts` | 6 |
| `registerSystemRoutes` | Function | `apps/api/src/routes/system.ts` | 22 |
| `createNewsRoute` | Function | `apps/api/src/routes/dashboard/routes/news.ts` | 63 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateStatusRoute → SafeParseEvent` | intra_community | 4 |
| `CreateRequestSyncUseCase → Ttl` | cross_community | 3 |
| `CreateTransactionsRoute → EnqueueAllConnectionsSync` | intra_community | 3 |
| `CreateAdvisorRoute → ClampImpactEstimate` | intra_community | 3 |
| `CreateAdvisorRoute → BuildDecisionWorkflow` | intra_community | 3 |
| `CreateAdvisorRoute → BuildActionTracking` | intra_community | 3 |
| `CreateConnectUrlRoute → WithStateQueryParam` | intra_community | 3 |
| `CreateAuditTrailRoute → SafeParseEvent` | intra_community | 3 |

## Connected Areas

| Area | Connections |
|------|-------------|
| Auth | 1 calls |
| Repositories | 1 calls |

## How to Explore

1. `gitnexus_context({name: "createSyncRoute"})` — see callers and callees
2. `gitnexus_query({query: "routes"})` — find related execution flows
3. Read key files listed above for implementation details
