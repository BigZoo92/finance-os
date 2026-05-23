import { describe, expect, it } from 'bun:test'
import { computeValuationConfidence, resolvePriceStaleness } from './valuation-foundation'

describe('valuation foundation', () => {
  it('marks a direct market price stale when fetchedAt exceeds the policy window', () => {
    const result = resolvePriceStaleness({
      now: new Date('2026-05-04T10:10:00.000Z'),
      snapshot: {
        symbol: 'AAPL',
        assetClass: 'stock',
        provider: 'twelvedata',
        sourceType: 'delayed',
        price: 200,
        currency: 'USD',
        marketTimestamp: '2026-05-04T09:45:00.000Z',
        fetchedAt: '2026-05-04T10:00:00.000Z',
        delaySeconds: 900,
        staleAfterSeconds: 300,
        isMarketOpen: true,
        confidence: 0.8,
      },
    })

    expect(result.isStale).toBe(true)
    expect(result.staleReason).toContain('price_age_600s')
  })

  it('does not punish an EOD price simply because the market is closed', () => {
    const result = resolvePriceStaleness({
      now: new Date('2026-05-05T18:00:00.000Z'),
      snapshot: {
        symbol: 'CW8.PA',
        assetClass: 'etf',
        provider: 'eodhd',
        sourceType: 'eod',
        price: 520,
        currency: 'EUR',
        marketTimestamp: '2026-05-04T16:35:00.000Z',
        fetchedAt: '2026-05-04T18:00:00.000Z',
        delaySeconds: 86_400,
        staleAfterSeconds: 60,
        isMarketOpen: false,
        confidence: 0.7,
      },
    })

    expect(result.isStale).toBe(false)
    expect(result.staleReason).toBeNull()
  })

  it('applies stale and FX penalties to valuation confidence', () => {
    expect(
      computeValuationConfidence({
        priceConfidence: 0.8,
        fxConfidence: 0.9,
        isPriceStale: true,
      })
    ).toBeCloseTo(0.36)
  })
})
