import { describe, expect, it } from 'vitest'
import { rankNewsByRelevance, rankPersonalSignalsByRelevance } from './relevance-scoring'

describe('rankNewsByRelevance', () => {
  it('prioritizes topic/source matches and recency with explainable reasons', () => {
    const ranked = rankNewsByRelevance(
      [
        {
          id: 'older-match',
          title: 'Equity markets digest inflation outlook',
          summary: 'Long form context',
          url: 'https://example.com/older-match',
          sourceName: 'Macro Wire',
          sourceDomain: 'macrowire.example',
          sourceType: 'media',
          topic: 'macro',
          language: 'en',
          publishedAt: '2026-04-02T10:00:00.000Z',
          domains: ['macroeconomy'],
          eventType: 'macro_release',
          severity: 50,
          confidence: 70,
          novelty: 40,
          marketImpactScore: 52,
          relevanceScore: 60,
          direction: 'risk',
          affectedSectors: ['Financials'],
          affectedTickers: [],
        },
        {
          id: 'fresh-miss',
          title: 'Corporate bonds hold steady',
          summary: null,
          url: 'https://example.com/fresh-miss',
          sourceName: 'Bond Desk',
          sourceDomain: 'bonddesk.example',
          sourceType: 'media',
          topic: 'credit',
          language: 'en',
          publishedAt: '2026-04-06T09:30:00.000Z',
          domains: ['credit'],
          eventType: 'market_commentary',
          severity: 20,
          confidence: 60,
          novelty: 25,
          marketImpactScore: 18,
          relevanceScore: 20,
          direction: 'mixed',
          affectedSectors: ['Financials'],
          affectedTickers: [],
        },
      ],
      {
        topicFilter: 'macro',
        sourceFilter: 'macro',
        domainFilter: '',
        eventTypeFilter: '',
        now: new Date('2026-04-06T10:00:00.000Z'),
      }
    )

    expect(ranked[0]?.item.id).toBe('older-match')
    expect(ranked[0]?.reasons).toContain('topic matches filter')
    expect(ranked[0]?.reasons).toContain('source matches filter')
  })
})

describe('rankPersonalSignalsByRelevance', () => {
  it('puts destructive quantified signals first and includes reasons', () => {
    const ranked = rankPersonalSignalsByRelevance([
      {
        id: 'budget',
        title: 'Signal budget personnel',
        detail: 'Depenses a 95% des revenus',
        tone: 'outline',
      },
      {
        id: 'sync',
        title: 'Signal sync personnel',
        detail: '3 synchronisations en attente',
        tone: 'destructive',
      },
    ])

    expect(ranked[0]?.item.id).toBe('sync')
    expect(ranked[0]?.reasons).toContain('critical tone')
    expect(ranked[0]?.reasons).toContain('operational risk signal')
    expect(ranked[0]?.reasons).toContain('quantified impact')
  })
})
