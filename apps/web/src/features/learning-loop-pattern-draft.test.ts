import { describe, expect, it } from 'vitest'
import { buildHypothesisDraftFromDetection } from './learning-loop-view-model'
import type { DashboardTradingLabPatternDetection } from './dashboard-types'

const baseDetection: DashboardTradingLabPatternDetection = {
  id: 'det_abcdef123456',
  patternType: 'ema20_horizontal_level',
  direction: 'bullish',
  confidence: 'medium',
  observedAt: '2026-05-07T16:00:00+00:00',
  evidence: [
    'EMA20 confluence with retested horizontal level at 100.0000 (>=4 retests).',
    'EMA20 currently 100.05; deviation 0.05%.',
  ],
  invalidationHints: [
    'A sustained close beyond the level by more than the tolerance band invalidates the confluence.',
    'EMA20 separating from the level invalidates the pattern.',
  ],
  metrics: { level: 100, ema20: 100.05, retestCount: 4, candlesUsed: 250 },
  limitations: [
    'Horizontal level is heuristic, derived from rolling 20-bar pivots only.',
    'Pattern is observational; it does NOT predict price direction.',
  ],
}

describe('buildHypothesisDraftFromDetection', () => {
  it('uses the canonical pattern label and the symbol/timeframe in the title', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection, {
      symbol: 'AAPL',
      timeframe: '4h',
    })
    expect(draft.name).toContain('Hypothèse paper')
    expect(draft.name).toContain('EMA20 + niveau horizontal')
    expect(draft.name).toContain('AAPL')
    expect(draft.name).toContain('4h')
  })

  it('emits a slug constrained to a-z/0-9/dashes only and bounded to 80 chars', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection, {
      symbol: 'AAPL',
      timeframe: '4h',
    })
    expect(draft.slug).toMatch(/^[a-z0-9-]+$/)
    expect(draft.slug.length).toBeGreaterThan(0)
    expect(draft.slug.length).toBeLessThanOrEqual(80)
    expect(draft.slug).toContain('ema20_horizontal_level'.replace(/_/g, '-'))
  })

  it('keeps the thesis cautious and never uses execution wording', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection, { symbol: 'AAPL' })
    expect(draft.thesis).toBeTruthy()
    const banned = ['buy', 'sell', 'execute', 'place order', 'leverage']
    const wb = (term: string) =>
      term.includes(' ')
        ? new RegExp(term, 'i')
        : new RegExp(`\\b${term}\\b`, 'i')
    for (const term of banned) {
      expect(wb(term).test(draft.thesis ?? '')).toBe(false)
    }
    // Cautious framing must be present.
    expect((draft.thesis ?? '').toLowerCase()).toContain('paper')
  })

  it('maps invalidationHints into invalidationCriteria 1:1', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection)
    expect(draft.invalidationCriteria).toEqual(baseDetection.invalidationHints)
  })

  it('falls back to a placeholder when the detection has no invalidation hints', () => {
    const draft = buildHypothesisDraftFromDetection({ ...baseDetection, invalidationHints: [] })
    expect(draft.invalidationCriteria.length).toBe(1)
    expect(draft.invalidationCriteria[0]).toMatch(/définir/i)
  })

  it('maps evidence into evidenceNotes', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection)
    expect(draft.evidenceNotes).toEqual(baseDetection.evidence)
  })

  it('omits evidenceNotes entirely when the detection has no evidence', () => {
    const draft = buildHypothesisDraftFromDetection({ ...baseDetection, evidence: [] })
    expect('evidenceNotes' in draft).toBe(false)
  })

  it('prepends "not a recommendation" + "must be backtested" caveats before pattern limitations', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection)
    expect(draft.caveats?.[0]).toMatch(/n’est pas une recommandation/)
    expect(draft.caveats?.[1]).toMatch(/backtest/i)
    expect(draft.caveats?.slice(2)).toEqual(baseDetection.limitations)
  })

  it('forces strategy/status framing to a paper-only manual hypothesis draft', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection)
    expect(draft.status).toBe('draft')
    expect(draft.horizon).toBeNull()
    expect(draft.tags).toContain('pattern-detection')
    expect(draft.tags).toContain('paper-only')
    expect(draft.tags).toContain(baseDetection.patternType)
    expect(draft.assumptions).toEqual([])
  })

  it('tolerates missing context (no symbol / no timeframe) without throwing', () => {
    const draft = buildHypothesisDraftFromDetection(baseDetection, {})
    expect(draft.name).toContain('EMA20 + niveau horizontal')
    expect(draft.slug).toMatch(/^[a-z0-9-]+$/)
  })
})
