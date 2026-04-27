import { describe, expect, it } from 'bun:test'
import { generateDeterministicOhlcv } from './trading-lab-ohlcv-fixtures'

describe('generateDeterministicOhlcv', () => {
  const start = new Date('2024-01-02')
  const end = new Date('2024-03-15')

  it('produces deterministic output for same inputs', () => {
    const a = generateDeterministicOhlcv({ symbol: 'SPY.US', startDate: start, endDate: end })
    const b = generateDeterministicOhlcv({ symbol: 'SPY.US', startDate: start, endDate: end })
    expect(a.length).toBe(b.length)
    expect(a.length).toBeGreaterThan(20)
    expect(a[0]).toEqual(b[0])
    expect(a.at(-1)).toEqual(b.at(-1))
  })

  it('produces different output for different symbols', () => {
    const a = generateDeterministicOhlcv({ symbol: 'SPY.US', startDate: start, endDate: end })
    const b = generateDeterministicOhlcv({ symbol: 'QQQ.US', startDate: start, endDate: end })
    expect(a[0]?.close).not.toEqual(b[0]?.close)
  })

  it('skips weekends', () => {
    const bars = generateDeterministicOhlcv({ symbol: 'TEST', startDate: start, endDate: end })
    for (const bar of bars) {
      const day = new Date(bar.date).getUTCDay()
      expect(day).not.toBe(0)
      expect(day).not.toBe(6)
    }
  })

  it('respects maxBars cap', () => {
    const bars = generateDeterministicOhlcv({
      symbol: 'TEST',
      startDate: start,
      endDate: new Date('2030-01-01'),
      maxBars: 50,
    })
    expect(bars.length).toBeLessThanOrEqual(50)
  })

  it('produces valid OHLC relationships', () => {
    const bars = generateDeterministicOhlcv({ symbol: 'TEST', startDate: start, endDate: end })
    for (const bar of bars) {
      expect(bar.high).toBeGreaterThanOrEqual(Math.max(bar.open, bar.close))
      expect(bar.low).toBeLessThanOrEqual(Math.min(bar.open, bar.close))
      expect(bar.volume).toBeGreaterThan(0)
    }
  })
})
