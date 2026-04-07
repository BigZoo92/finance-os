---
name: services
description: "Skill for the Services area of finance-os. 29 symbols across 11 files."
---

# Services

29 symbols | 11 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how recordEvent, createSyncRoute, createConnectUrlRoute work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | recordEvent, safeParseEvent, listRecentEvents, getLatestCallback, bindRedisFunction (+1) |
| `apps/api/src/routes/notifications/services/push-store.ts` | toBoolean, toPermission, getStoredPushSettings, nowIso, setStoredPushOptIn (+1) |
| `apps/api/src/routes/integrations/powens/services/create-powens-connect-url-service.ts` | withStateQueryParam, getConnectUrl, isCallbackStateValid |
| `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | inferTopic, toDedupeKey, fetchLiveNews |
| `apps/api/src/routes/integrations/powens/routes/callback.ts` | sanitizeConnectionId, createCallbackRoute |
| `apps/api/src/routes/integrations/powens/routes/status.ts` | withPersistenceFlag, createStatusRoute |
| `apps/api/src/routes/notifications/services/delivery-worker.ts` | isSubscriptionExpired, deliverCriticalNotification |
| `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | percentile, recordBulkTriageMetrics |
| `apps/api/src/routes/integrations/powens/routes/sync.ts` | createSyncRoute |
| `apps/api/src/routes/integrations/powens/routes/connect-url.ts` | createConnectUrlRoute |

## Entry Points

Start here when exploring this area:

- **`recordEvent`** (Function) — `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts:67`
- **`createSyncRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/sync.ts:9`
- **`createConnectUrlRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/connect-url.ts:7`
- **`createCallbackRoute`** (Function) — `apps/api/src/routes/integrations/powens/routes/callback.ts:14`
- **`listRecentEvents`** (Function) — `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts:73`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `recordEvent` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 67 |
| `createSyncRoute` | Function | `apps/api/src/routes/integrations/powens/routes/sync.ts` | 9 |
| `createConnectUrlRoute` | Function | `apps/api/src/routes/integrations/powens/routes/connect-url.ts` | 7 |
| `createCallbackRoute` | Function | `apps/api/src/routes/integrations/powens/routes/callback.ts` | 14 |
| `listRecentEvents` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 73 |
| `getLatestCallback` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 87 |
| `createStatusRoute` | Function | `apps/api/src/routes/integrations/powens/routes/status.ts` | 24 |
| `createAuditTrailRoute` | Function | `apps/api/src/routes/integrations/powens/routes/audit-trail.ts` | 6 |
| `getStoredPushSettings` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 24 |
| `setStoredPushOptIn` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 83 |
| `setStoredPushSubscription` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 99 |
| `fetchLiveNews` | Function | `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | 33 |
| `deliverCriticalNotification` | Function | `apps/api/src/routes/notifications/services/delivery-worker.ts` | 11 |
| `recordBulkTriageMetrics` | Function | `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | 15 |
| `createPowensAdminAuditService` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 38 |
| `getConnectUrl` | Method | `apps/api/src/routes/integrations/powens/services/create-powens-connect-url-service.ts` | 19 |
| `isCallbackStateValid` | Method | `apps/api/src/routes/integrations/powens/services/create-powens-connect-url-service.ts` | 41 |
| `withStateQueryParam` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-connect-url-service.ts` | 5 |
| `sanitizeConnectionId` | Function | `apps/api/src/routes/integrations/powens/routes/callback.ts` | 9 |
| `safeParseEvent` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 5 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `CreateStatusRoute → SafeParseEvent` | intra_community | 4 |
| `CreateConnectUrlRoute → WithStateQueryParam` | intra_community | 3 |
| `CreateAuditTrailRoute → SafeParseEvent` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "recordEvent"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
