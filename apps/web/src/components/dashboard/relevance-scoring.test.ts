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
          topic: 'macro',
          language: 'en',
          publishedAt: '2026-04-02T10:00:00.000Z',
        },
        {
          id: 'fresh-miss',
          title: 'Corporate bonds hold steady',
          summary: null,
          url: 'https://example.com/fresh-miss',
          sourceName: 'Bond Desk',
          topic: 'credit',
          language: 'en',
          publishedAt: '2026-04-06T09:30:00.000Z',
        },
      ],
      {
        topicFilter: 'macro',
        sourceFilter: 'macro',
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
