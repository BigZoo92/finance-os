import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import {
  createDashboardSignalSourcesRepository,
  type CreateSignalSourceInput,
  type SignalSourceGroup,
  type UpdateSignalSourceInput,
} from '../repositories/dashboard-signal-sources-repository'
import { createDashboardSignalItemsRepository } from '../repositories/dashboard-signal-items-repository'
import { normalizeManualImportItems } from '../services/providers/manual-import-provider'
import { createNormalizedNewsSignal } from '../domain/news-enrichment'
import { classifySignal } from '../domain/signal-classifier'
import { toStableHash } from '../domain/news-helpers'
import { sendSignalsToKnowledgeGraph } from '../services/signal-graph-ingest'
import type { ApiDb } from '../types'

// Demo fixtures for signal sources
const DEMO_FINANCE_SOURCES = [
  {
    id: 1,
    provider: 'x_twitter',
    handle: '@zaborsky',
    displayName: 'Ben Zaborsky',
    url: 'https://x.com/zaborsky',
    group: 'finance' as const,
    enabled: true,
    priority: 90,
    tags: ['macro', 'fed', 'rates'],
    language: 'en',
    includePatterns: [],
    excludePatterns: [],
    minRelevanceScore: 0,
    requiresAttentionPolicy: 'auto' as const,
    lastFetchedAt: null,
    lastCursor: null,
    lastError: null,
    lastFetchedCount: null,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 2,
    provider: 'x_twitter',
    handle: '@unusual_whales',
    displayName: 'Unusual Whales',
    url: 'https://x.com/unusual_whales',
    group: 'finance' as const,
    enabled: true,
    priority: 80,
    tags: ['options', 'flow', 'alerts'],
    language: 'en',
    includePatterns: [],
    excludePatterns: [],
    minRelevanceScore: 0,
    requiresAttentionPolicy: 'auto' as const,
    lastFetchedAt: null,
    lastCursor: null,
    lastError: null,
    lastFetchedCount: null,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
]

const DEMO_AI_TECH_SOURCES = [
  {
    id: 3,
    provider: 'x_twitter',
    handle: '@AnthropicAI',
    displayName: 'Anthropic',
    url: 'https://x.com/AnthropicAI',
    group: 'ai_tech' as const,
    enabled: true,
    priority: 95,
    tags: ['claude', 'models', 'safety'],
    language: 'en',
    includePatterns: [],
    excludePatterns: [],
    minRelevanceScore: 0,
    requiresAttentionPolicy: 'auto' as const,
    lastFetchedAt: null,
    lastCursor: null,
    lastError: null,
    lastFetchedCount: null,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
  {
    id: 4,
    provider: 'x_twitter',
    handle: '@OpenAI',
    displayName: 'OpenAI',
    url: 'https://x.com/OpenAI',
    group: 'ai_tech' as const,
    enabled: true,
    priority: 90,
    tags: ['gpt', 'models', 'api'],
    language: 'en',
    includePatterns: [],
    excludePatterns: [],
    minRelevanceScore: 0,
    requiresAttentionPolicy: 'auto' as const,
    lastFetchedAt: null,
    lastCursor: null,
    lastError: null,
    lastFetchedCount: null,
    createdAt: '2026-04-20T10:00:00Z',
    updatedAt: '2026-04-20T10:00:00Z',
  },
]

const DEMO_SOURCES = [...DEMO_FINANCE_SOURCES, ...DEMO_AI_TECH_SOURCES]

const DEMO_RUNS = [
  {
    id: 1,
    provider: 'hn_algolia',
    runType: 'scheduled',
    startedAt: '2026-04-26T08:00:00Z',
    finishedAt: '2026-04-26T08:00:03Z',
    status: 'success',
    fetchedCount: 15,
    insertedCount: 8,
    dedupedCount: 5,
    classifiedCount: 8,
    graphIngestedCount: 3,
    failedCount: 0,
    errorSummary: null,
    requestId: 'demo-run-1',
    durationMs: 3200,
    createdAt: '2026-04-26T08:00:00Z',
  },
]

const signalSourceBodySchema = t.Object({
  provider: t.String(),
  handle: t.String(),
  displayName: t.String(),
  url: t.Optional(t.String()),
  group: t.Union([t.Literal('finance'), t.Literal('ai_tech')]),
  enabled: t.Optional(t.Boolean()),
  priority: t.Optional(t.Number()),
  tags: t.Optional(t.Array(t.String())),
  language: t.Optional(t.String()),
  includePatterns: t.Optional(t.Array(t.String())),
  excludePatterns: t.Optional(t.Array(t.String())),
  minRelevanceScore: t.Optional(t.Number()),
  requiresAttentionPolicy: t.Optional(
    t.Union([
      t.Literal('auto'),
      t.Literal('always'),
      t.Literal('never'),
      t.Literal('high_only'),
    ])
  ),
})

const signalSourceUpdateBodySchema = t.Object({
  displayName: t.Optional(t.String()),
  url: t.Optional(t.String()),
  group: t.Optional(t.Union([t.Literal('finance'), t.Literal('ai_tech')])),
  enabled: t.Optional(t.Boolean()),
  priority: t.Optional(t.Number()),
  tags: t.Optional(t.Array(t.String())),
  language: t.Optional(t.String()),
  includePatterns: t.Optional(t.Array(t.String())),
  excludePatterns: t.Optional(t.Array(t.String())),
  minRelevanceScore: t.Optional(t.Number()),
  requiresAttentionPolicy: t.Optional(
    t.Union([
      t.Literal('auto'),
      t.Literal('always'),
      t.Literal('never'),
      t.Literal('high_only'),
    ])
  ),
})

const manualImportBodySchema = t.Object({
  items: t.Array(
    t.Object({
      text: t.String(),
      author: t.Optional(t.String()),
      url: t.Optional(t.String()),
      publishedAt: t.Optional(t.String()),
      language: t.Optional(t.String()),
      provider: t.Optional(t.String()),
    })
  ),
})

export const createSignalSourcesRoute = ({ db }: { db: ApiDb }) => {
  const repository = createDashboardSignalSourcesRepository({ db })
  const itemsRepo = createDashboardSignalItemsRepository({ db })

  return new Elysia()
    // List signal sources
    .get('/signals/sources', async context => {
      const groupParam = (context.query as Record<string, string | undefined>).group as
        | SignalSourceGroup
        | undefined
      return demoOrReal({
        context,
        demo: () => {
          const items = groupParam
            ? DEMO_SOURCES.filter(s => s.group === groupParam)
            : DEMO_SOURCES
          return { ok: true, items, counts: { finance: 2, ai_tech: 2 } }
        },
        real: async () => {
          const [items, counts] = await Promise.all([
            repository.listSources(groupParam),
            repository.countSourcesByGroup(),
          ])
          return { ok: true, items, counts }
        },
      })
    })

    // Create signal source
    .post(
      '/signals/sources',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            try {
              const source = await repository.createSource(context.body as CreateSignalSourceInput)
              context.set.status = 201
              return { ok: true, source }
            } catch (error) {
              const isDuplicate =
                error instanceof Error && error.message.includes('unique')
              if (isDuplicate) {
                context.set.status = 409
                return {
                  ok: false,
                  code: 'SIGNAL_SOURCE_DUPLICATE',
                  message: 'A source with this provider and handle already exists',
                  requestId,
                }
              }
              throw error
            }
          },
        })
      },
      { body: signalSourceBodySchema }
    )

    // Update signal source
    .patch(
      '/signals/sources/:id',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const id = Number(context.params.id)
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const source = await repository.updateSource(id, context.body as UpdateSignalSourceInput)
            if (!source) {
              context.set.status = 404
              return { ok: false, code: 'SIGNAL_SOURCE_NOT_FOUND', message: 'Source not found', requestId }
            }
            return { ok: true, source }
          },
        })
      },
      { body: signalSourceUpdateBodySchema }
    )

    // Delete signal source
    .delete('/signals/sources/:id', async context => {
      const requestId = getRequestMeta(context).requestId
      const id = Number(context.params.id)
      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
        },
        real: async () => {
          requireAdmin(context)
          const deleted = await repository.deleteSource(id)
          if (!deleted) {
            context.set.status = 404
            return { ok: false, code: 'SIGNAL_SOURCE_NOT_FOUND', message: 'Source not found', requestId }
          }
          return { ok: true }
        },
      })
    })

    // List ingestion runs
    .get('/signals/runs', async context => {
      return demoOrReal({
        context,
        demo: () => ({ ok: true, runs: DEMO_RUNS }),
        real: async () => {
          const runs = await repository.listRecentRuns(30)
          return { ok: true, runs }
        },
      })
    })

    // Manual import
    .post(
      '/signals/ingest/manual',
      async context => {
        const requestId = getRequestMeta(context).requestId
        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required', requestId }
          },
          real: async () => {
            requireAdmin(context)
            const startedAt = Date.now()
            const runId = await repository.createIngestionRun({
              provider: 'manual_import',
              runType: 'manual_import',
              requestId,
            })

            try {
              const rawItems = normalizeManualImportItems(context.body.items, 100)
              const enriched = rawItems.map(item => ({
                raw: item,
                normalized: createNormalizedNewsSignal(item),
              }))

              let insertedCount = 0
              let dedupedCount = 0

              for (const { raw, normalized } of enriched) {
                const classification = classifySignal(normalized)
                const contentHash = toStableHash(`${normalized.title}|${raw.providerArticleId}`)
                const dedupeKey = toStableHash(
                  `${raw.provider}:${raw.providerArticleId}:${normalized.normalizedTitle}`
                )

                const insertInput: Parameters<typeof itemsRepo.insertIfNotDuplicate>[0] = {
                  sourceProvider: raw.provider,
                  sourceType: raw.sourceType,
                  externalId: raw.providerArticleId,
                  title: normalized.title,
                  author: raw.sourceName,
                  publishedAt: raw.publishedAt,
                  fetchedAt: new Date(),
                  language: raw.language,
                  entities: normalized.affectedEntities.map(e => e.name),
                  tickers: normalized.affectedTickers,
                  sectors: normalized.affectedSectors,
                  topics: normalized.domains,
                  signalDomain: classification.signalDomain,
                  relevanceScore: normalized.relevanceScore,
                  noveltyScore: normalized.novelty,
                  confidenceScore: normalized.confidence,
                  impactScore: classification.impactScore,
                  urgencyScore: classification.urgencyScore,
                  requiresAttention: classification.requiresAttention,
                  dedupeKey,
                  contentHash,
                  provenance: {
                    source: raw.provider,
                    sourceName: raw.sourceName,
                    importedAt: new Date().toISOString(),
                  },
                  ingestionRunId: runId,
                }
                if (raw.providerUrl) insertInput.url = raw.providerUrl
                if (raw.contentSnippet) insertInput.body = raw.contentSnippet
                if (classification.attentionReason) insertInput.attentionReason = classification.attentionReason

                const result = await itemsRepo.insertIfNotDuplicate(insertInput)

                if (result.inserted) {
                  insertedCount++
                } else {
                  dedupedCount++
                }
              }

              // Graph ingest auto-trigger (fail-soft)
              let graphIngestedCount = 0
              const knowledgeUrl = process.env.KNOWLEDGE_SERVICE_URL
              const graphEnabled = process.env.KNOWLEDGE_SERVICE_ENABLED === 'true'
              if (graphEnabled && knowledgeUrl && insertedCount > 0) {
                try {
                  const topItems = await itemsRepo.listPendingGraphIngest(10, 5)
                  if (topItems.length > 0) {
                    const graphResult = await sendSignalsToKnowledgeGraph({
                      items: topItems,
                      knowledgeServiceUrl: knowledgeUrl,
                      requestId,
                    })
                    await itemsRepo.markGraphIngested(
                      graphResult.sentIds,
                      'sent'
                    )
                    if (graphResult.failedIds.length > 0) {
                      await itemsRepo.markGraphIngested(graphResult.failedIds, 'failed')
                    }
                    graphIngestedCount = graphResult.sentCount
                  }
                } catch {
                  // fail-soft: graph failure does not fail the import
                }
              }

              const durationMs = Date.now() - startedAt
              await repository.completeIngestionRun(runId, {
                status: 'success',
                fetchedCount: rawItems.length,
                insertedCount,
                dedupedCount,
                classifiedCount: enriched.length,
                graphIngestedCount,
                durationMs,
              })

              return {
                ok: true,
                runId,
                fetchedCount: rawItems.length,
                insertedCount,
                dedupedCount,
                classifiedCount: enriched.length,
                graphIngestedCount,
                durationMs,
              }
            } catch (error) {
              const durationMs = Date.now() - startedAt
              await repository.completeIngestionRun(runId, {
                status: 'failed',
                fetchedCount: 0,
                insertedCount: 0,
                dedupedCount: 0,
                classifiedCount: 0,
                failedCount: context.body.items.length,
                errorSummary:
                  error instanceof Error ? error.message : 'Unknown error',
                durationMs,
              })

              logApiEvent({
                level: 'error',
                msg: 'signal_manual_import_failed',
                requestId,
                ...toErrorLogFields({ error, includeStack: false }),
              })

              context.set.status = 500
              return {
                ok: false,
                code: 'SIGNAL_MANUAL_IMPORT_FAILED',
                message: 'Manual import failed',
                requestId,
              }
            }
          },
        })
      },
      { body: manualImportBodySchema }
    )

    // List persisted signal items
    .get('/signals/items', async context => {
      const q = context.query as Record<string, string | undefined>
      return demoOrReal({
        context,
        demo: () => ({ ok: true, items: [], total: 0 }),
        real: async () => {
          const listOpts: Parameters<typeof itemsRepo.listItems>[0] = {
            limit: Number(q.limit) || 50,
            offset: Number(q.offset) || 0,
          }
          if (q.signalDomain) listOpts.signalDomain = q.signalDomain
          if (q.sourceProvider) listOpts.sourceProvider = q.sourceProvider
          if (q.requiresAttention === 'true') listOpts.requiresAttention = true
          if (q.graphIngestStatus) listOpts.graphIngestStatus = q.graphIngestStatus

          const items = await itemsRepo.listItems(listOpts)
          const total = await itemsRepo.countItems()
          return { ok: true, items, total }
        },
      })
    })

    // Signal health overview
    .get('/signals/health', async context => {
      return demoOrReal({
        context,
        demo: () => ({
          ok: true,
          providers: {
            x_twitter: { configured: false, enabled: false, reason: 'Credentials absentes' },
            bluesky: { configured: false, enabled: false, reason: 'Non configure' },
            manual_import: { configured: true, enabled: true },
          },
          sources: { finance: 2, ai_tech: 2, total: 4 },
        }),
        real: async () => {
          const counts = await repository.countSourcesByGroup()
          return {
            ok: true,
            providers: {
              x_twitter: {
                configured: !!process.env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN,
                enabled: process.env.NEWS_PROVIDER_X_TWITTER_ENABLED === 'true',
              },
              bluesky: {
                configured: !!process.env.BLUESKY_APP_PASSWORD,
                enabled: process.env.BLUESKY_ENABLED === 'true',
              },
              manual_import: { configured: true, enabled: true },
            },
            sources: {
              finance: counts.finance,
              ai_tech: counts.ai_tech,
              total: counts.finance + counts.ai_tech,
            },
          }
        },
      })
    })
}
