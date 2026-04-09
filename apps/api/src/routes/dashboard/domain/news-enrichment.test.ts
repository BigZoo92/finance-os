import { describe, expect, it } from 'bun:test'
import { createNormalizedNewsSignal } from './news-enrichment'
import type { NewsProviderRawItem } from './news-types'

const createRawItem = (overrides?: Partial<NewsProviderRawItem>): NewsProviderRawItem => ({
  provider: 'hn_algolia',
  providerArticleId: 'hn-1',
  providerUrl: 'https://news.example.com/articles/anthropic-claude-cyber-model',
  canonicalUrl: 'https://news.example.com/articles/anthropic-claude-cyber-model?utm_source=test',
  sourceName: 'News Example',
  sourceDomain: 'news.example.com',
  sourceType: 'media',
  title: 'Anthropic launches Claude cyber model as Microsoft expands security tooling',
  summary:
    'The launch highlights AI productivity gains for cyber teams and competitive pressure across cloud software.',
  contentSnippet:
    'Anthropic and Microsoft are positioning new AI security capabilities for enterprise buyers.',
  language: 'en',
  country: null,
  region: null,
  geoScope: 'company',
  publishedAt: new Date('2026-04-09T08:30:00.000Z'),
  metadata: null,
  rawPayload: { source: 'test' },
  ...overrides,
})

describe('createNormalizedNewsSignal', () => {
  it('classifies domains, entities, scores, and context links for rich AI-oriented signals', () => {
    const signal = createNormalizedNewsSignal(
      createRawItem(),
      new Date('2026-04-09T09:00:00.000Z')
    )

    expect(signal.domains).toEqual(
      expect.arrayContaining(['technology', 'ai', 'cybersecurity', 'product_launches'])
    )
    expect(signal.eventType).toBe('product_launch')
    expect(signal.affectedEntities.map(entity => entity.name)).toEqual(
      expect.arrayContaining(['Anthropic', 'Microsoft'])
    )
    expect(signal.affectedTickers).toContain('MSFT')
    expect(signal.affectedSectors).toEqual(
      expect.arrayContaining(['AI software', 'Cloud software'])
    )
    expect(signal.opportunityFlags).toEqual(
      expect.arrayContaining(['productivity_upside'])
    )
    expect(signal.whyItMatters.length).toBeGreaterThan(0)
    expect(signal.marketImpactScore).toBeGreaterThan(0)
    expect(signal.relevanceScore).toBeGreaterThan(0)
    expect(signal.canonicalUrl).toBe(
      'https://news.example.com/articles/anthropic-claude-cyber-model'
    )
    expect(signal.canonicalUrlFingerprint).not.toBeNull()
  })

  it('maps filing-style primary sources into filing event types and links', () => {
    const signal = createNormalizedNewsSignal(
      createRawItem({
        provider: 'sec_edgar',
        providerArticleId: '0000320193-26-000001',
        providerUrl: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/aapl-8k.htm',
        canonicalUrl:
          'https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/aapl-8k.htm',
        sourceName: 'SEC EDGAR',
        sourceDomain: 'sec.gov',
        sourceType: 'filing',
        title: 'Apple files Form 8-K on supply chain update',
        summary: 'The filing describes supply chain normalization and updated production assumptions.',
        contentSnippet: null,
        geoScope: 'company',
      }),
      new Date('2026-04-09T09:00:00.000Z')
    )

    expect(signal.topic).toBe('filings')
    expect(signal.eventType).toBe('filing_8k')
    expect(signal.filingLinks).toEqual([
      {
        label: 'filing-source',
        url: 'https://www.sec.gov/Archives/edgar/data/320193/000032019326000001/aapl-8k.htm',
      },
    ])
    expect(signal.confidence).toBeGreaterThanOrEqual(80)
  })
})
