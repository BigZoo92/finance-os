---
name: services
description: "Skill for the Services area of finance-os. 15 symbols across 5 files."
---

# Services

15 symbols | 5 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how getStoredPushSettings, setStoredPushOptIn, setStoredPushSubscription work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/notifications/services/push-store.ts` | toBoolean, toPermission, getStoredPushSettings, nowIso, setStoredPushOptIn (+1) |
| `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | inferTopic, toDedupeKey, fetchLiveNews |
| `apps/api/src/routes/notifications/services/delivery-worker.ts` | isSubscriptionExpired, deliverCriticalNotification |
| `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | percentile, recordBulkTriageMetrics |
| `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | bindRedisFunction, createPowensAdminAuditService |

## Entry Points

Start here when exploring this area:

- **`getStoredPushSettings`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:24`
- **`setStoredPushOptIn`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:83`
- **`setStoredPushSubscription`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:99`
- **`fetchLiveNews`** (Function) — `apps/api/src/routes/dashboard/services/fetch-live-news.ts:33`
- **`deliverCriticalNotification`** (Function) — `apps/api/src/routes/notifications/services/delivery-worker.ts:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `getStoredPushSettings` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 24 |
| `setStoredPushOptIn` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 83 |
| `setStoredPushSubscription` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 99 |
| `fetchLiveNews` | Function | `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | 33 |
| `deliverCriticalNotification` | Function | `apps/api/src/routes/notifications/services/delivery-worker.ts` | 11 |
| `recordBulkTriageMetrics` | Function | `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | 15 |
| `createPowensAdminAuditService` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 38 |
| `toBoolean` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 5 |
| `toPermission` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 14 |
| `nowIso` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 22 |
| `inferTopic` | Function | `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | 21 |
| `toDedupeKey` | Function | `apps/api/src/routes/dashboard/services/fetch-live-news.ts` | 31 |
| `isSubscriptionExpired` | Function | `apps/api/src/routes/notifications/services/delivery-worker.ts` | 3 |
| `percentile` | Function | `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | 5 |
| `bindRedisFunction` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 25 |

## How to Explore

1. `gitnexus_context({name: "getStoredPushSettings"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
