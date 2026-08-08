import { describe, expect, it } from 'bun:test'
import { createFxConverter } from './fx'
import type { FxRateInput } from './types'

const NOW = new Date('2026-08-07T12:00:00.000Z')

const usdRate: FxRateInput = {
  baseCurrency: 'EUR',
  quoteCurrency: 'USD',
  rate: 1.08,
  provider: 'ecb',
  sourceType: 'daily',
  rateTimestamp: '2026-08-07T00:00:00.000Z',
  staleAfterSeconds: 4 * 24 * 60 * 60,
}

describe('createFxConverter', () => {
  it('converts EUR to EUR with rate 1 and no provenance', () => {
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [], now: NOW })
    const result = fx.toBase(100, 'EUR')
    expect(result).toEqual({
      value: 100,
      rate: 1,
      provider: null,
      rateTimestamp: null,
      isStale: false,
    })
  })

  it('converts USD to EUR with the ECB convention (quote per base)', () => {
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [usdRate], now: NOW })
    const result = fx.toBase(108, 'USD')
    expect(result?.value).toBeCloseTo(100, 8)
    expect(result?.isStale).toBe(false)
    expect(result?.provider).toBe('ecb')
  })

  it('round-trips a conversion in both directions', () => {
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [usdRate], now: NOW })
    const toEur = fx.toBase(250, 'USD')
    expect(toEur).not.toBeNull()
    if (toEur === null) {
      return
    }
    // Inverse: EUR value * (USD per EUR) must return the original USD amount.
    expect(toEur.value * usdRate.rate).toBeCloseTo(250, 8)
  })

  it('returns null for a missing rate instead of 0', () => {
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [usdRate], now: NOW })
    expect(fx.toBase(500, 'JPY')).toBeNull()
    expect(fx.hasRate('JPY')).toBe(false)
  })

  it('flags stale rates but still converts', () => {
    const staleRate: FxRateInput = {
      ...usdRate,
      rateTimestamp: '2026-07-01T00:00:00.000Z',
    }
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [staleRate], now: NOW })
    const result = fx.toBase(108, 'USD')
    expect(result?.value).toBeCloseTo(100, 8)
    expect(result?.isStale).toBe(true)
    expect(fx.staleCurrencies()).toEqual(['USD'])
  })

  it('ignores invalid rates and picks the most recent per pair', () => {
    const older: FxRateInput = { ...usdRate, rate: 1.2, rateTimestamp: '2026-08-01T00:00:00.000Z' }
    const invalid: FxRateInput = { ...usdRate, rate: 0 }
    const fx = createFxConverter({ baseCurrency: 'EUR', rates: [older, invalid, usdRate], now: NOW })
    const result = fx.toBase(108, 'USD')
    expect(result?.value).toBeCloseTo(100, 8)
  })
})
