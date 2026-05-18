import { describe, expect, it } from 'bun:test'
import { createLiveNewsIngestionService } from './fetch-live-news'
import type { NewsProviderAdapter } from './news-provider-types'
import type { DashboardNewsRepository } from '../types'

/**
 * The news ingestion group's `overallStatus` taxonomy is the contract the
 * orchestrator + UI consume. These tests pin it.
 *
 *   - success         : every enabled provider succeeded with non-zero items.
 *   - partial_success : at least one provider succeeded AND at least one
 *                       failed.
 *   - success_empty   : every enabled provider succeeded but returned 0 items.
 *   - failed          : every enabled provider failed.
 *
 * Previously the service threw `NEWS_PROVIDER_UNAVAILABLE` when no provider
 * succeeded, which masked partial-success runs.
 */

const baseRepository = () =>
  ({
    countNewsArticles: async () => 0,
    findNewsArticleCandidates: async () => [],
    insertNewsSignal: async () => undefined,
    mergeNewsSignal: async () => undefined,
    upsertNewsProviderState: async () => undefined,
  }) as unknown as Pick<
    DashboardNewsRepository,
    | 'countNewsArticles'
    | 'findNewsArticleCandidates'
    | 'insertNewsSignal'
    | 'mergeNewsSignal'
    | 'upsertNewsProviderState'
  >

const makeProvider = (
  name: NewsProviderAdapter['provider'],
  options: {
    enabled?: boolean
    itemCount?: number
    throwError?: string | null
  } = {}
): NewsProviderAdapter => {
  const enabled = options.enabled ?? true
  const itemCount = options.itemCount ?? 0
  const throwError = options.throwError ?? null
  return {
    provider: name,
    enabled,
    cooldownMs: 0,
    fetchItems: async () => {
      if (throwError) {
        throw new Error(throwError)
      }
      return Array.from({ length: itemCount }, (_, i) => ({
        provider: name,
        providerArticleId: `${name}-${i}`,
        providerUrl: `https://example.com/${name}/${i}`,
        canonicalUrl: `https://example.com/${name}/${i}`,
        sourceName: name,
        sourceDomain: 'example.com',
        sourceType: 'media' as const,
        title: `Item ${i} from ${name}`,
        summary: null,
        contentSnippet: null,
        language: 'en',
        country: null,
        region: null,
        geoScope: 'global' as const,
        publishedAt: new Date('2026-05-18T08:00:00Z'),
        metadata: null,
        rawPayload: null,
      }))
    },
  }
}

const runService = (providers: NewsProviderAdapter[]) =>
  createLiveNewsIngestionService({
    repository: baseRepository(),
    providers,
    maxItemsPerProvider: 50,
    metadataFetchEnabled: false,
    metadataFetchTimeoutMs: 1000,
    metadataFetchMaxBytes: 4096,
    metadataUserAgent: 'test',
  }).run({ requestId: 'test-req' })

describe('live news ingestion — overallStatus taxonomy', () => {
  it('reports `success` when every enabled provider returns items', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { itemCount: 3 }),
      makeProvider('gdelt_doc', { itemCount: 2 }),
    ])
    expect(result.overallStatus).toBe('success')
    expect(result.successCount).toBe(2)
    expect(result.failedCount).toBe(0)
    expect(result.emptyCount).toBe(0)
    expect(result.fetchedCount).toBe(5)
  })

  it('reports `partial_success` when one provider fails and another succeeds', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { itemCount: 3 }),
      makeProvider('gdelt_doc', { throwError: 'fetch_timeout' }),
    ])
    expect(result.overallStatus).toBe('partial_success')
    expect(result.successCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(result.fetchedCount).toBe(3)
  })

  it('reports `success_empty` when every provider succeeds with zero items', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { itemCount: 0 }),
      makeProvider('gdelt_doc', { itemCount: 0 }),
    ])
    expect(result.overallStatus).toBe('success_empty')
    expect(result.successCount).toBe(2)
    expect(result.emptyCount).toBe(2)
    expect(result.failedCount).toBe(0)
  })

  it('reports `failed` when every enabled provider fails (no throw)', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { throwError: 'fetch_timeout' }),
      makeProvider('gdelt_doc', { throwError: 'fetch_timeout' }),
    ])
    // KEY behavior change: previous implementation threw
    // NEWS_PROVIDER_UNAVAILABLE here. New implementation returns the status
    // as data so the orchestrator can map it cleanly.
    expect(result.overallStatus).toBe('failed')
    expect(result.successCount).toBe(0)
    expect(result.failedCount).toBe(2)
  })

  it('reports `success_empty` when all providers are disabled (no enabled provider count)', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { enabled: false }),
      makeProvider('gdelt_doc', { enabled: false }),
    ])
    expect(result.overallStatus).toBe('success_empty')
    expect(result.enabledProviderCount).toBe(0)
    expect(result.skippedCount).toBe(2)
  })

  it('counts skipped providers as not-enabled and not as failed', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { itemCount: 5 }),
      makeProvider('gdelt_doc', { enabled: false }),
      makeProvider('ecb_rss', { throwError: 'rate_limit' }),
    ])
    expect(result.skippedCount).toBe(1)
    expect(result.enabledProviderCount).toBe(2)
    expect(result.successCount).toBe(1)
    expect(result.failedCount).toBe(1)
    expect(result.overallStatus).toBe('partial_success')
  })

  it('mixed empty-success + failure is still partial_success', async () => {
    const result = await runService([
      makeProvider('hn_algolia', { itemCount: 2 }),
      makeProvider('gdelt_doc', { itemCount: 0 }),
      makeProvider('ecb_rss', { throwError: 'rate_limit' }),
    ])
    expect(result.overallStatus).toBe('partial_success')
    expect(result.successCount).toBe(2) // hn + gdelt both succeeded (gdelt empty)
    expect(result.emptyCount).toBe(1)
    expect(result.failedCount).toBe(1)
  })
})
