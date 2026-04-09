import { describe, expect, it } from 'bun:test'
import { resolveNewsDuplicate } from './news-dedupe'
import { createNormalizedNewsSignal } from './news-enrichment'

const baseSignal = createNormalizedNewsSignal(
  {
    provider: 'gdelt_doc',
    providerArticleId: 'gdelt-1',
    providerUrl: 'https://www.example.com/fed-cuts-rates-and-markets-rally',
    canonicalUrl: 'https://www.example.com/fed-cuts-rates-and-markets-rally',
    sourceName: 'Example News',
    sourceDomain: 'example.com',
    sourceType: 'media',
    title: 'Fed cuts rates and markets rally on softer inflation outlook',
    summary: 'The Federal Reserve rate cut lifted risk appetite across equities and duration.',
    contentSnippet: null,
    language: 'en',
    country: 'US',
    region: 'north_america',
    geoScope: 'market',
    publishedAt: new Date('2026-04-09T10:00:00.000Z'),
    metadata: null,
    rawPayload: null,
  },
  new Date('2026-04-09T11:00:00.000Z')
)

describe('resolveNewsDuplicate', () => {
  it('merges cross-source articles when strong canonical, title, and entity evidence align', () => {
    const match = resolveNewsDuplicate({
      signal: baseSignal,
      candidates: [
        {
          id: 42,
          canonicalUrlFingerprint: baseSignal.canonicalUrlFingerprint,
          normalizedTitle: baseSignal.normalizedTitle,
          sourceDomain: 'example.com',
          eventType: baseSignal.eventType,
          publishedAt: new Date('2026-04-09T09:15:00.000Z'),
          affectedEntities: baseSignal.affectedEntities,
          eventClusterId: baseSignal.eventClusterId,
        },
      ],
    })

    expect(match?.articleId).toBe(42)
    expect(match?.evidence.score).toBeGreaterThanOrEqual(60)
    expect(match?.evidence.reasons).toEqual(
      expect.arrayContaining(['canonical-url-match', 'normalized-title-match'])
    )
  })

  it('keeps distinct events separate when overlap is too weak', () => {
    const match = resolveNewsDuplicate({
      signal: baseSignal,
      candidates: [
        {
          id: 99,
          canonicalUrlFingerprint: null,
          normalizedTitle: 'company unveils new smartphone in spring event',
          sourceDomain: 'another-source.example',
          eventType: 'product_launch',
          publishedAt: new Date('2026-04-03T09:15:00.000Z'),
          affectedEntities: [],
          eventClusterId: 'cluster-other',
        },
      ],
    })

    expect(match).toBeNull()
  })
})
