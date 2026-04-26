---
name: services
description: "Skill for the Services area of finance-os. 27 symbols across 6 files."
---

# Services

27 symbols | 6 files | Cohesion: 100%

## When to Use

- Working with code in `apps/`
- Understanding how scrapeArticleMetadata, getStoredPushSettings, setStoredPushOptIn work
- Modifying services-related functionality

## Key Files

| File | Symbols |
|------|---------|
| `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | readPartialBody, resolveMetaContent, collectMetaContents, resolveLinkHref, collectLinkHrefs (+8) |
| `apps/api/src/routes/notifications/services/push-store.ts` | toBoolean, toPermission, getStoredPushSettings, nowIso, setStoredPushOptIn (+1) |
| `apps/api/src/routes/notifications/services/delivery-worker.ts` | isSubscriptionExpired, deliverCriticalNotification |
| `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | percentile, recordBulkTriageMetrics |
| `apps/api/src/routes/dashboard/services/news-provider-utils.ts` | splitCsvLine, parseCsvRows |
| `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | bindRedisFunction, createPowensAdminAuditService |

## Entry Points

Start here when exploring this area:

- **`scrapeArticleMetadata`** (Function) — `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts:220`
- **`getStoredPushSettings`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:24`
- **`setStoredPushOptIn`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:83`
- **`setStoredPushSubscription`** (Function) — `apps/api/src/routes/notifications/services/push-store.ts:99`
- **`deliverCriticalNotification`** (Function) — `apps/api/src/routes/notifications/services/delivery-worker.ts:11`

## Key Symbols

| Symbol | Type | File | Line |
|--------|------|------|------|
| `scrapeArticleMetadata` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 220 |
| `getStoredPushSettings` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 24 |
| `setStoredPushOptIn` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 83 |
| `setStoredPushSubscription` | Function | `apps/api/src/routes/notifications/services/push-store.ts` | 99 |
| `deliverCriticalNotification` | Function | `apps/api/src/routes/notifications/services/delivery-worker.ts` | 11 |
| `recordBulkTriageMetrics` | Function | `apps/api/src/routes/enrichment/services/bulk-metrics.ts` | 15 |
| `parseCsvRows` | Function | `apps/api/src/routes/dashboard/services/news-provider-utils.ts` | 117 |
| `createPowensAdminAuditService` | Function | `apps/api/src/routes/integrations/powens/services/create-powens-admin-audit-service.ts` | 38 |
| `readPartialBody` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 11 |
| `resolveMetaContent` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 47 |
| `collectMetaContents` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 58 |
| `resolveLinkHref` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 73 |
| `collectLinkHrefs` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 84 |
| `resolveAbsoluteUrl` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 99 |
| `resolveAbsoluteUrls` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 111 |
| `buildDefaultFaviconUrl` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 117 |
| `flattenJsonLdEntries` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 125 |
| `extractJsonLdImageCandidates` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 140 |
| `parseJsonLd` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 161 |
| `buildMinimalCard` | Function | `apps/api/src/routes/dashboard/services/scrape-article-metadata.ts` | 200 |

## Execution Flows

| Flow | Type | Steps |
|------|------|-------|
| `ScrapeArticleMetadata → BuildDefaultFaviconUrl` | intra_community | 3 |
| `ScrapeArticleMetadata → FlattenJsonLdEntries` | intra_community | 3 |
| `ScrapeArticleMetadata → ExtractJsonLdImageCandidates` | intra_community | 3 |

## How to Explore

1. `gitnexus_context({name: "scrapeArticleMetadata"})` — see callers and callees
2. `gitnexus_query({query: "services"})` — find related execution flows
3. Read key files listed above for implementation details
