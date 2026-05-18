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

/**
 * Outcome taxonomy for the news ingestion group:
 *
 *   - 'success'         : every enabled provider returned and inserted/merged
 *                         at least one item OR returned 0 items cleanly.
 *   - 'partial_success' : at least one enabled provider succeeded AND at
 *                         least one failed. Run is degraded but useful data
 *                         still landed.
 *   - 'success_empty'   : every enabled provider returned 0 items (no error,
 *                         genuinely empty period). Distinct from failed.
 *   - 'failed'          : every enabled provider failed. Caller should
 *                         consider this a hard error for the group.
 *
 * The previous behavior — throw `NEWS_PROVIDER_UNAVAILABLE` when no provider
 * succeeded — masked partial-success runs and turned an "every provider
 * empty" outcome into a 500. The status is now data, not an exception.
 */
export type LiveNewsIngestionOverallStatus =
  | 'success'
  | 'partial_success'
  | 'success_empty'
  | 'failed'

export interface LiveNewsIngestionSummary {
  fetchedCount: number
  insertedCount: number
  mergedCount: number
  dedupeDropCount: number
  providerResults: NewsProviderRunResult[]
  overallStatus: LiveNewsIngestionOverallStatus
  /**
   * Convenience counts derived from `providerResults`. The caller doesn't
   * need to re-filter the array for the common "how many succeeded vs
   * failed" question.
   */
  successCount: number
  failedCount: number
  emptyCount: number
  skippedCount: number
  enabledProviderCount: number
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
      const failedCount = providerResults.filter(result => result.status === 'failed').length
      const skippedCount = providerResults.filter(result => result.status === 'skipped').length
      const enabledProviderCount = providerResults.length - skippedCount
      // A success with 0 items is informative ("provider responded, no
      // relevant news") but distinct from a hard empty group: count it.
      const emptyCount = providerResults.filter(
        r => r.status === 'success' && r.fetchedCount === 0
      ).length

      let overallStatus: LiveNewsIngestionOverallStatus
      if (enabledProviderCount === 0) {
        // Everything disabled — treat as empty rather than failed; the
        // caller (registry) maps this to `skipped_disabled` upstream.
        overallStatus = 'success_empty'
      } else if (successCount === 0) {
        // No provider returned anything cleanly — hard failure for the group.
        overallStatus = 'failed'
      } else if (failedCount > 0) {
        // Some succeeded, some failed — degraded but useful.
        overallStatus = 'partial_success'
      } else if (emptyCount === successCount) {
        // All succeeded but produced 0 items.
        overallStatus = 'success_empty'
      } else {
        overallStatus = 'success'
      }

      return {
        fetchedCount,
        insertedCount,
        mergedCount,
        dedupeDropCount,
        providerResults,
        overallStatus,
        successCount,
        failedCount,
        emptyCount,
        skippedCount,
        enabledProviderCount,
      }
    },
  }
}
