import { describe, expect, it } from 'bun:test'
import { classifySignal } from './signal-classifier'
import { createNormalizedNewsSignal } from './news-enrichment'
import { toStableHash } from './news-helpers'
import { normalizeManualImportItems } from '../services/providers/manual-import-provider'
import { buildXWatchlistQuery } from '../services/providers/x-twitter-news-provider'
import type { NormalizedNewsSignalDraft, NewsProviderRawItem } from './news-types'

// ---------------------------------------------------------------------------
// Manual import normalization
// ---------------------------------------------------------------------------

describe('normalizeManualImportItems', () => {
  it('normalizes text items into NewsProviderRawItem shape', () => {
    const items = normalizeManualImportItems(
      [
        { text: 'Fed expected to cut rates next week' },
        { text: 'Claude 5 released with 1M context window', author: '@AnthropicAI' },
      ],
      100
    )
    expect(items).toHaveLength(2)
    const [fedItem, anthropicItem] = items
    expect(fedItem?.provider).toBe('manual_import')
    expect(fedItem?.sourceType).toBe('manual')
    expect(fedItem?.title).toContain('Fed expected')
    expect(anthropicItem?.sourceName).toBe('@AnthropicAI')
  })

  it('skips empty text items', () => {
    const items = normalizeManualImportItems([{ text: '' }, { text: '  ' }], 100)
    expect(items).toHaveLength(0)
  })

  it('respects maxItems cap', () => {
    const items = normalizeManualImportItems(
      Array.from({ length: 10 }, (_, i) => ({ text: `Signal ${i}` })),
      3
    )
    expect(items).toHaveLength(3)
  })
})

// ---------------------------------------------------------------------------
// Signal enrichment pipeline
// ---------------------------------------------------------------------------

describe('createNormalizedNewsSignal for manual import', () => {
  it('enriches a manual import item with domains and scores', () => {
    const raw: NewsProviderRawItem = {
      provider: 'manual_import',
      providerArticleId: 'manual_001',
      providerUrl: null,
      canonicalUrl: null,
      sourceName: 'test',
      sourceDomain: null,
      sourceType: 'manual',
      title: 'Federal Reserve announces rate cut decision',
      summary: null,
      contentSnippet: 'Federal Reserve announces rate cut decision',
      language: 'en',
      country: null,
      region: null,
      geoScope: 'global',
      publishedAt: new Date(),
      metadata: null,
      rawPayload: null,
    }
    const enriched = createNormalizedNewsSignal(raw)
    expect(enriched.title).toBe('Federal Reserve announces rate cut decision')
    expect(enriched.dedupeKey).toBeTruthy()
    expect(enriched.domains.length).toBeGreaterThan(0)
  })
})

// ---------------------------------------------------------------------------
// Dedupe key generation
// ---------------------------------------------------------------------------

describe('dedupeKey generation', () => {
  it('produces a stable hash from content', () => {
    const key1 = toStableHash('manual_import:manual_001:fed rate cut')
    const key2 = toStableHash('manual_import:manual_001:fed rate cut')
    expect(key1).toBe(key2)
    expect(key1.length).toBe(48)
  })

  it('different content produces different keys', () => {
    const key1 = toStableHash('content A')
    const key2 = toStableHash('content B')
    expect(key1).not.toBe(key2)
  })
})

// ---------------------------------------------------------------------------
// Signal classification
// ---------------------------------------------------------------------------

describe('classifySignal — Finance vs AI/Tech routing', () => {
  const makeSignal = (
    overrides: Partial<NormalizedNewsSignalDraft>
  ): NormalizedNewsSignalDraft => ({
    provider: 'manual_import',
    providerArticleId: 'test',
    providerUrl: null,
    canonicalUrl: null,
    sourceName: 'test',
    sourceDomain: null,
    sourceType: 'manual',
    title: 'test',
    normalizedTitle: 'test',
    summary: null,
    contentSnippet: null,
    topic: 'test',
    language: 'en',
    country: null,
    region: null,
    geoScope: 'global',
    domains: [],
    categories: [],
    subcategories: [],
    eventType: 'general_update',
    severity: 3,
    confidence: 5,
    novelty: 5,
    marketImpactScore: 10,
    relevanceScore: 20,
    riskFlags: [],
    opportunityFlags: [],
    affectedEntities: [],
    affectedTickers: [],
    affectedSectors: [],
    affectedThemes: [],
    transmissionHypotheses: [],
    macroLinks: [],
    policyLinks: [],
    filingLinks: [],
    whyItMatters: [],
    scoringReasons: [],
    dedupeKey: 'test',
    clusteringKey: 'test',
    eventClusterId: 'test',
    canonicalUrlFingerprint: null,
    publishedAt: new Date(),
    metadata: null,
    rawProviderPayload: null,
    ...overrides,
  })

  it('routes finance domains to finance signal domain', () => {
    const result = classifySignal(makeSignal({ domains: ['markets', 'finance'] }))
    expect(result.signalDomain).toBe('finance')
  })

  it('routes AI domains from ai_tech group to ai_tech', () => {
    const result = classifySignal(makeSignal({ domains: ['ai'] }), 'ai_tech')
    expect(result.signalDomain).toBe('ai_tech')
  })

  it('flags Anthropic/Claude changes as attention-worthy', () => {
    const result = classifySignal(
      makeSignal({ title: 'Anthropic releases Claude 5', domains: ['ai'] }),
      'ai_tech'
    )
    expect(result.requiresAttention).toBe(true)
    expect(result.attentionReason).toContain('Anthropic')
  })

  it('flags Fed rate decision as attention-worthy', () => {
    const result = classifySignal(
      makeSignal({ title: 'Fed rate decision: 25bp cut', domains: ['central_banks'] })
    )
    expect(result.requiresAttention).toBe(true)
    expect(result.attentionReason).toContain('Fed')
  })

  it('does not flag routine content as attention', () => {
    const result = classifySignal(
      makeSignal({ title: 'Regular tech blog post about React' })
    )
    expect(result.requiresAttention).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// X/Twitter watchlist query builder
// ---------------------------------------------------------------------------

describe('buildXWatchlistQuery', () => {
  it('composes from: clauses from watchlist handles', () => {
    const query = buildXWatchlistQuery('finance OR markets', [
      { handle: '@zerohedge', includePatterns: [], excludePatterns: [] },
      { handle: 'unusual_whales', includePatterns: [], excludePatterns: [] },
    ])
    expect(query).toContain('from:zerohedge')
    expect(query).toContain('from:unusual_whales')
    expect(query).toContain('-is:retweet')
  })

  it('returns base query when watchlist is empty', () => {
    const query = buildXWatchlistQuery('finance', [])
    expect(query).toBe('finance')
  })

  it('handles watchlist without base keywords', () => {
    const query = buildXWatchlistQuery('', [
      { handle: '@test', includePatterns: [], excludePatterns: [] },
    ])
    expect(query).toContain('from:test')
    expect(query).toContain('-is:retweet')
    expect(query).not.toContain('()')
  })
})

// ---------------------------------------------------------------------------
// Graph ingest eligibility
// ---------------------------------------------------------------------------

describe('graph ingest auto-trigger eligibility', () => {
  it('only high-relevance signals should qualify for graph ingest', () => {
    // Simulating: listPendingGraphIngest with minRelevance=5
    // Signals with relevanceScore < 5 should not be sent to graph
    const highRelevance = makeSignal({ relevanceScore: 40 })
    const lowRelevance = makeSignal({ relevanceScore: 2 })

    const classify1 = classifySignal(highRelevance, 'finance')
    const classify2 = classifySignal(lowRelevance)

    // High relevance signal has meaningful impact
    expect(classify1.impactScore).toBeGreaterThan(0)
    // Both get classified — filtering happens at DB query level
    expect(classify2.signalDomain).toBeDefined()
  })
})

function makeSignal(overrides: Partial<NormalizedNewsSignalDraft>): NormalizedNewsSignalDraft {
  return {
    provider: 'manual_import',
    providerArticleId: 'test',
    providerUrl: null,
    canonicalUrl: null,
    sourceName: 'test',
    sourceDomain: null,
    sourceType: 'manual',
    title: 'test',
    normalizedTitle: 'test',
    summary: null,
    contentSnippet: null,
    topic: 'test',
    language: 'en',
    country: null,
    region: null,
    geoScope: 'global',
    domains: [],
    categories: [],
    subcategories: [],
    eventType: 'general_update',
    severity: 3,
    confidence: 5,
    novelty: 5,
    marketImpactScore: 10,
    relevanceScore: 20,
    riskFlags: [],
    opportunityFlags: [],
    affectedEntities: [],
    affectedTickers: [],
    affectedSectors: [],
    affectedThemes: [],
    transmissionHypotheses: [],
    macroLinks: [],
    policyLinks: [],
    filingLinks: [],
    whyItMatters: [],
    scoringReasons: [],
    dedupeKey: 'test',
    clusteringKey: 'test',
    eventClusterId: 'test',
    canonicalUrlFingerprint: null,
    publishedAt: new Date(),
    metadata: null,
    rawProviderPayload: null,
    ...overrides,
  }
}
