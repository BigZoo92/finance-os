import { createSourceReferenceFromSignal, createNormalizedNewsSignal } from '../domain/news-enrichment'
import { resolveNewsDuplicate } from '../domain/news-dedupe'
import { scrapeArticleMetadata } from './scrape-article-metadata'
import type { NewsProviderAdapter } from './news-provider-types'
import type {
  NewsMetadataFetchStatus,
  NewsPersistableSignalDraft,
  NewsProviderRunResult,
} from '../domain/news-types'
import type { DashboardNewsRepository } from '../types'

const DUPLICATE_LOOKBACK_MS = 36 * 60 * 60 * 1000

export interface LiveNewsIngestionSummary {
  fetchedCount: number
  insertedCount: number
  mergedCount: number
  dedupeDropCount: number
  providerResults: NewsProviderRunResult[]
}

const buildPersistableSignal = async ({
  signal,
  requestId,
  metadataFetchEnabled,
  metadataFetchTimeoutMs,
  metadataFetchMaxBytes,
  metadataUserAgent,
}: {
  signal: ReturnType<typeof createNormalizedNewsSignal>
  requestId: string
  metadataFetchEnabled: boolean
  metadataFetchTimeoutMs: number
  metadataFetchMaxBytes: number
  metadataUserAgent: string
}): Promise<NewsPersistableSignalDraft> => {
  let metadataFetchStatus: NewsMetadataFetchStatus = metadataFetchEnabled ? 'pending' : 'not_requested'
  let metadataCard = null
  let metadataFetchedAt: Date | null = null

  if (metadataFetchEnabled && (signal.canonicalUrl ?? signal.providerUrl)) {
    const metadataResult = await scrapeArticleMetadata({
      url: signal.canonicalUrl ?? signal.providerUrl ?? signal.providerUrl ?? '',
      requestId,
      timeoutMs: metadataFetchTimeoutMs,
      maxBytes: metadataFetchMaxBytes,
      userAgent: metadataUserAgent,
    })
    metadataFetchStatus = metadataResult.status
    metadataCard = metadataResult.card
    metadataFetchedAt = metadataResult.fetchedAt
  }

  const now = new Date()
  return {
    ...signal,
    metadataFetchStatus,
    metadataCard,
    metadataFetchedAt,
    firstSeenAt: now,
    ingestedAt: now,
    lastEnrichedAt: now,
    provenance: {
      sourceCount: 1,
      providerCount: 1,
      providers: [signal.provider],
      sourceDomains: signal.sourceDomain ? [signal.sourceDomain] : [],
      primaryReason: 'initial-ingest',
    },
    sourceRefs: [createSourceReferenceFromSignal(signal, null)],
  }
}

export const createLiveNewsIngestionService = ({
  repository,
  providers,
  maxItemsPerProvider,
  metadataFetchEnabled,
  metadataFetchTimeoutMs,
  metadataFetchMaxBytes,
  metadataUserAgent,
}: {
  repository: Pick<
    DashboardNewsRepository,
    | 'countNewsArticles'
    | 'findNewsArticleCandidates'
    | 'insertNewsSignal'
    | 'mergeNewsSignal'
    | 'upsertNewsProviderState'
  >
  providers: NewsProviderAdapter[]
  maxItemsPerProvider: number
  metadataFetchEnabled: boolean
  metadataFetchTimeoutMs: number
  metadataFetchMaxBytes: number
  metadataUserAgent: string
}) => {
  return {
    async run({ requestId }: { requestId: string }): Promise<LiveNewsIngestionSummary> {
      let fetchedCount = 0
      let insertedCount = 0
      let mergedCount = 0
      let dedupeDropCount = 0
      const providerResults: NewsProviderRunResult[] = []

      for (const provider of providers) {
        const startedAt = Date.now()

        if (!provider.enabled) {
          const result: NewsProviderRunResult = {
            provider: provider.provider,
            status: 'skipped',
            fetchedCount: 0,
            insertedCount: 0,
            mergedCount: 0,
            dedupeDropCount: 0,
            durationMs: 0,
            requestId,
            errorCode: null,
            errorMessage: null,
            cooldownUntil: null,
          }
          providerResults.push(result)
          await repository.upsertNewsProviderState({
            ...result,
            enabled: false,
          })
          continue
        }

        try {
          const rawItems = await provider.fetchItems({
            requestId,
            now: new Date(),
            maxItems: maxItemsPerProvider,
          })
          fetchedCount += rawItems.length

          let providerInsertedCount = 0
          let providerMergedCount = 0
          let providerDedupeCount = 0

          for (const rawItem of rawItems) {
            const normalized = createNormalizedNewsSignal(rawItem)
            const candidates = await repository.findNewsArticleCandidates({
              canonicalUrlFingerprint: normalized.canonicalUrlFingerprint,
              normalizedTitle: normalized.normalizedTitle,
              publishedAfter: new Date(normalized.publishedAt.getTime() - DUPLICATE_LOOKBACK_MS),
              publishedBefore: new Date(normalized.publishedAt.getTime() + DUPLICATE_LOOKBACK_MS),
            })
            const duplicateMatch = resolveNewsDuplicate({
              signal: normalized,
              candidates,
            })
            const persistableSignal = await buildPersistableSignal({
              signal: normalized,
              requestId,
              metadataFetchEnabled,
              metadataFetchTimeoutMs,
              metadataFetchMaxBytes,
              metadataUserAgent,
            })

            if (duplicateMatch) {
              await repository.mergeNewsSignal({
                articleId: duplicateMatch.articleId,
                signal: {
                  ...persistableSignal,
                  sourceRefs: [
                    createSourceReferenceFromSignal(normalized, duplicateMatch.evidence),
                  ],
                },
                dedupeEvidence: duplicateMatch.evidence,
              })
              mergedCount += 1
              providerMergedCount += 1
              dedupeDropCount += 1
              providerDedupeCount += 1
              continue
            }

            await repository.insertNewsSignal(persistableSignal)
            insertedCount += 1
            providerInsertedCount += 1
          }

          const result: NewsProviderRunResult = {
            provider: provider.provider,
            status: 'success',
            fetchedCount: rawItems.length,
            insertedCount: providerInsertedCount,
            mergedCount: providerMergedCount,
            dedupeDropCount: providerDedupeCount,
            durationMs: Date.now() - startedAt,
            requestId,
            errorCode: null,
            errorMessage: null,
            cooldownUntil: provider.cooldownMs > 0 ? new Date(Date.now() + provider.cooldownMs) : null,
          }
          providerResults.push(result)
          await repository.upsertNewsProviderState({
            ...result,
            enabled: true,
          })
        } catch (error) {
          const result: NewsProviderRunResult = {
            provider: provider.provider,
            status: 'failed',
            fetchedCount: 0,
            insertedCount: 0,
            mergedCount: 0,
            dedupeDropCount: 0,
            durationMs: Date.now() - startedAt,
            requestId,
            errorCode: error instanceof Error ? error.message.slice(0, 96) : 'NEWS_PROVIDER_ERROR',
            errorMessage: 'Provider fetch failed.',
            cooldownUntil: provider.cooldownMs > 0 ? new Date(Date.now() + provider.cooldownMs) : null,
          }
          providerResults.push(result)
          await repository.upsertNewsProviderState({
            ...result,
            enabled: true,
          })
        }
      }

      const successCount = providerResults.filter(result => result.status === 'success').length
      const enabledProviderCount = providerResults.filter(result => result.status !== 'skipped').length
      if (enabledProviderCount > 0 && successCount === 0) {
        throw new Error('NEWS_PROVIDER_UNAVAILABLE')
      }

      return {
        fetchedCount,
        insertedCount,
        mergedCount,
        dedupeDropCount,
        providerResults,
      }
    },
  }
}
