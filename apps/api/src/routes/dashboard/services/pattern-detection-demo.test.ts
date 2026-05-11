import { describe, expect, it } from 'bun:test'
import { buildDemoPatternDetectionResponse } from './pattern-detection-demo'

const baseBody = {
  symbol: 'TEST',
  timeframe: '1d',
  candles: Array.from({ length: 80 }, (_, i) => ({
    timestamp: `2025-01-${String((i % 28) + 1).padStart(2, '0')}T00:00:00+00:00`,
    open: 100,
    high: 100.5,
    low: 99.5,
    close: 100,
  })),
}

describe('buildDemoPatternDetectionResponse', () => {
  it('returns ok=true with deterministic fixture data and required envelope fields', () => {
    const out = buildDemoPatternDetectionResponse(baseBody)
    expect(out.ok).toBe(true)
    expect(out.timeframe).toBe('1d')
    expect(out.symbol).toBe('TEST')
    expect(out.dataQuality.candleCount).toBe(80)
    expect(out.dataQuality.sufficient).toBe(true)
    expect(out.dataQuality.hasVolume).toBe(false)
    expect(Array.isArray(out.detections)).toBe(true)
    expect(out.caveats.length).toBeGreaterThanOrEqual(2)
    expect(out.caveats.some(c => c.toLowerCase().includes('not financial advice'))).toBe(true)
    expect(out.caveats.some(c => c.toLowerCase().includes('research-only'))).toBe(true)
  })

  it('is deterministic — same input produces identical output (including detection IDs)', () => {
    const a = buildDemoPatternDetectionResponse(baseBody)
    const b = buildDemoPatternDetectionResponse(baseBody)
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('returns sufficient=false and a warning when candle count is below threshold', () => {
    const out = buildDemoPatternDetectionResponse({ ...baseBody, candles: baseBody.candles.slice(0, 10) })
    expect(out.dataQuality.candleCount).toBe(10)
    expect(out.dataQuality.sufficient).toBe(false)
    expect(out.dataQuality.warnings.length).toBeGreaterThan(0)
  })

  it('honours the patterns filter — requesting only one type returns at most that type', () => {
    const out = buildDemoPatternDetectionResponse({
      ...baseBody,
      patterns: ['ema20_horizontal_level'],
    })
    const types = new Set(out.detections.map(d => d.patternType))
    expect([...types]).toEqual(['ema20_horizontal_level'])
  })

  it('returns no detections when an unrelated pattern is the only one requested', () => {
    const out = buildDemoPatternDetectionResponse({
      ...baseBody,
      patterns: ['ema200_one_touch'],
    })
    expect(out.detections).toEqual([])
  })

  it('PR15B: surfaces a deterministic bullish FVG entry when fair_value_gap is requested', () => {
    const out = buildDemoPatternDetectionResponse({
      ...baseBody,
      patterns: ['fair_value_gap'],
    })
    expect(out.detections).toHaveLength(1)
    const fvg = out.detections[0]
    if (!fvg) throw new Error('expected FVG detection')
    expect(fvg.patternType).toBe('fair_value_gap')
    expect(fvg.direction).toBe('bullish')
    expect(['low', 'medium']).toContain(fvg.confidence as string) // SMC cap
    const metrics = fvg.metrics as { gapLow: number; gapHigh: number; mitigated: boolean }
    expect(metrics.gapHigh).toBeGreaterThan(metrics.gapLow)
    expect(metrics.mitigated).toBe(false)
  })

  it('PR15B: SMC keys requested on demo do not produce execution vocabulary', () => {
    const out = buildDemoPatternDetectionResponse({
      ...baseBody,
      patterns: [
        'fair_value_gap',
        'liquidity_sweep',
        'break_of_structure',
        'change_of_character',
        'order_block_candidate',
      ],
    })
    const banlist = ['buy', 'sell', 'long', 'short', 'execute', 'execution', 'place order']
    const wb = (term: string) =>
      term.includes(' ')
        ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')
    const walk = (value: unknown): string[] => {
      const hits: string[] = []
      if (typeof value === 'string') {
        for (const term of banlist) {
          if (wb(term).test(value)) hits.push(term)
        }
      } else if (Array.isArray(value)) {
        for (const v of value) hits.push(...walk(v))
      } else if (value && typeof value === 'object') {
        for (const v of Object.values(value as Record<string, unknown>)) hits.push(...walk(v))
      }
      return hits
    }
    expect(walk(out)).toEqual([])
  })

  it('every detection includes evidence, invalidationHints, limitations, and a confidence label', () => {
    const out = buildDemoPatternDetectionResponse(baseBody)
    for (const det of out.detections) {
      expect(typeof det.id).toBe('string')
      expect(['low', 'medium', 'high']).toContain(det.confidence as string)
      expect(Array.isArray(det.evidence)).toBe(true)
      expect((det.evidence as unknown[]).length).toBeGreaterThan(0)
      expect(Array.isArray(det.invalidationHints)).toBe(true)
      expect((det.invalidationHints as unknown[]).length).toBeGreaterThan(0)
      expect(Array.isArray(det.limitations)).toBe(true)
      expect((det.limitations as unknown[]).length).toBeGreaterThan(0)
    }
  })

  it('never emits execution vocabulary in any text field', () => {
    const out = buildDemoPatternDetectionResponse(baseBody)
    const banlist = [
      'buy',
      'sell',
      'long',
      'short',
      'open position',
      'close position',
      'place order',
      'execute',
      'execution',
      'trade now',
      'enter trade',
      'exit trade',
      'stop loss',
      'take profit',
      'leverage',
      'margin',
      'futures',
      'swap',
    ]
    const wordBoundary = (term: string) =>
      term.includes(' ')
        ? new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        : new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i')

    const walk = (value: unknown): string[] => {
      const hits: string[] = []
      if (typeof value === 'string') {
        for (const term of banlist) {
          if (wordBoundary(term).test(value)) hits.push(term)
        }
      } else if (Array.isArray(value)) {
        for (const v of value) hits.push(...walk(v))
      } else if (value && typeof value === 'object') {
        for (const v of Object.values(value as Record<string, unknown>)) hits.push(...walk(v))
      }
      return hits
    }
    expect(walk(out)).toEqual([])
  })

  it('omits symbol from the response when not provided in the input', () => {
    const out = buildDemoPatternDetectionResponse({
      timeframe: '4h',
      candles: baseBody.candles,
    })
    expect('symbol' in out).toBe(false)
  })
})
