import { describe, expect, it } from 'bun:test'
import { classifySignal, isAiTechSignalRelevantForFinanceOs } from './signal-classifier'
import type { NormalizedNewsSignalDraft } from './news-types'

const makeSignal = (
  overrides: Partial<NormalizedNewsSignalDraft> = {}
): NormalizedNewsSignalDraft => ({
  provider: 'hn_algolia',
  providerArticleId: 'test-1',
  providerUrl: null,
  canonicalUrl: null,
  sourceName: 'Test',
  sourceDomain: 'test.com',
  sourceType: 'media',
  title: 'Test signal',
  normalizedTitle: 'test signal',
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
  dedupeKey: 'test-key',
  clusteringKey: 'test-cluster',
  eventClusterId: 'test-event-cluster',
  canonicalUrlFingerprint: null,
  publishedAt: new Date(),
  metadata: null,
  rawProviderPayload: null,
  ...overrides,
})

describe('classifySignal', () => {
  it('classifies finance domain from news taxonomy domains', () => {
    const signal = makeSignal({ domains: ['finance', 'markets'] })
    const result = classifySignal(signal)
    expect(result.signalDomain).toBe('finance')
  })

  it('classifies ai_tech domain from taxonomy domains', () => {
    const signal = makeSignal({ domains: ['ai', 'technology'] })
    const result = classifySignal(signal)
    expect(result.signalDomain).toBe('ai_tech')
  })

  it('classifies regulatory domain', () => {
    const signal = makeSignal({ domains: ['regulation'] })
    const result = classifySignal(signal)
    expect(result.signalDomain).toBe('regulatory')
  })

  it('classifies unknown for empty domains', () => {
    const signal = makeSignal({ domains: [] })
    const result = classifySignal(signal)
    expect(result.signalDomain).toBe('unknown')
  })

  it('respects source group override for ai_tech', () => {
    const signal = makeSignal({ domains: ['technology'] })
    const result = classifySignal(signal, 'ai_tech')
    expect(result.signalDomain).toBe('ai_tech')
  })

  it('flags attention for Fed rate decision', () => {
    const signal = makeSignal({
      title: 'Federal Reserve rate decision expected next week',
      domains: ['central_banks', 'monetary_policy'],
    })
    const result = classifySignal(signal)
    expect(result.requiresAttention).toBe(true)
    expect(result.attentionReason).toBe('Decision Fed')
  })

  it('flags attention for high severity', () => {
    const signal = makeSignal({
      title: 'Some important event happening',
      domains: ['finance'],
      severity: 8,
    })
    const result = classifySignal(signal)
    expect(result.requiresAttention).toBe(true)
  })

  it('flags attention for AI/Tech Claude changes', () => {
    const signal = makeSignal({
      title: 'Anthropic releases Claude 5 with major improvements',
      domains: ['ai', 'model_releases'],
    })
    const result = classifySignal(signal, 'ai_tech')
    expect(result.requiresAttention).toBe(true)
    expect(result.attentionReason).toBe('Changement Anthropic/Claude')
  })

  it('does not flag routine AI/Tech posts', () => {
    const signal = makeSignal({
      title: 'A regular tech blog post about programming',
      domains: ['technology'],
    })
    const result = classifySignal(signal, 'ai_tech')
    expect(result.requiresAttention).toBe(false)
  })
})

describe('isAiTechSignalRelevantForFinanceOs', () => {
  it('returns true for Claude/Anthropic mentions', () => {
    expect(isAiTechSignalRelevantForFinanceOs('Anthropic Claude update')).toBe(true)
  })

  it('returns true for OpenAI pricing changes', () => {
    expect(isAiTechSignalRelevantForFinanceOs('OpenAI API pricing reduced by 50%')).toBe(true)
  })

  it('returns true for agentic framework releases', () => {
    expect(
      isAiTechSignalRelevantForFinanceOs('New agentic framework SDK released for tool use')
    ).toBe(true)
  })

  it('returns false for generic tech content', () => {
    expect(isAiTechSignalRelevantForFinanceOs('React 20 released with new features')).toBe(false)
  })
})
