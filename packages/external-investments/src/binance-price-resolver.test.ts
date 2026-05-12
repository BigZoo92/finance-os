import { describe, expect, it } from 'bun:test'
import { resolveBinanceAssetValue } from './binance-price-resolver'

const now = () => '2026-05-12T10:00:00.000Z'

const tickerFromMap =
  (map: Record<string, string>) =>
  async ({ symbol }: { symbol: string }) => {
    const price = map[symbol]
    if (price === undefined) throw new Error(`no ticker ${symbol}`)
    return { symbol, price }
  }

const noFx = async () => null

describe('resolveBinanceAssetValue', () => {
  it('resolves BTC → BTCEUR direct pair with confidence=high', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'BTC',
      quantity: '0.5',
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({ BTCEUR: '60000', BTCUSDT: '65000' }),
      fxFetcher: noFx,
    })
    expect(outcome.source).toBe('binance_direct')
    expect(outcome.providerSymbol).toBe('BTCEUR')
    expect(outcome.value).toBe(30000)
    expect(outcome.confidence).toBe('high')
    expect(outcome.degradedReason).toBeNull()
  })

  it('falls back to BTCUSDT + EUR/USD when BTCEUR is unavailable', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'BTC',
      quantity: '1',
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({ BTCUSDT: '65000' }),
      fxFetcher: async ({ from, to }) => {
        expect(from).toBe('USD')
        expect(to).toBe('EUR')
        return { rate: 0.92, asOf: now() }
      },
    })
    expect(outcome.source).toBe('binance_via_stable')
    expect(outcome.providerSymbol).toBe('BTCUSDT')
    expect(outcome.bridge).toEqual({ stable: 'USDT', fxRate: 0.92, fxAsOf: now() })
    expect(outcome.value).toBe(59800)
    expect(outcome.confidence).toBe('medium')
  })

  it('treats USDT→USD as 1:1 (no FX bridge needed)', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'BTC',
      quantity: '0.1',
      targetCurrency: 'USD',
      now,
      tickerFetcher: tickerFromMap({ BTCUSDT: '70000' }),
      fxFetcher: noFx,
    })
    expect(outcome.source).toBe('binance_via_stable')
    expect(outcome.providerSymbol).toBe('BTCUSDT')
    expect(outcome.bridge).toEqual({ stable: 'USDT', fxRate: 1, fxAsOf: now() })
    expect(outcome.value).toBe(7000)
    expect(outcome.confidence).toBe('high')
  })

  it('returns NO_STABLE_PAIR when neither a direct nor a stablecoin pair exists', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'ZZZ',
      quantity: '10',
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({}),
      fxFetcher: noFx,
    })
    expect(outcome.value).toBeNull()
    expect(outcome.degradedReason).toBe('NO_STABLE_PAIR')
    expect(outcome.confidence).toBe('none')
  })

  it('returns FX_RATE_UNAVAILABLE when stable pair found but FX is missing', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'BTC',
      quantity: '1',
      targetCurrency: 'JPY',
      now,
      tickerFetcher: tickerFromMap({ BTCUSDT: '65000' }),
      fxFetcher: async () => null,
    })
    expect(outcome.value).toBeNull()
    expect(outcome.degradedReason).toBe('FX_RATE_UNAVAILABLE')
  })

  it('refuses to value an invalid or zero quantity', async () => {
    const outcome = await resolveBinanceAssetValue({
      asset: 'BTC',
      quantity: '0',
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({ BTCEUR: '60000' }),
      fxFetcher: noFx,
    })
    expect(outcome.degradedReason).toBe('INVALID_QUANTITY')
  })

  it('ignores ticker fetch errors and falls through to next strategy', async () => {
    let calls = 0
    const outcome = await resolveBinanceAssetValue({
      asset: 'ETH',
      quantity: '2',
      targetCurrency: 'EUR',
      now,
      tickerFetcher: async ({ symbol }) => {
        calls += 1
        if (symbol === 'ETHEUR') {
          throw new Error('binance 500')
        }
        if (symbol === 'ETHUSDT') {
          return { symbol, price: '3000' }
        }
        throw new Error('not in map')
      },
      fxFetcher: async () => ({ rate: 0.9, asOf: now() }),
    })
    expect(calls).toBeGreaterThanOrEqual(2)
    expect(outcome.source).toBe('binance_via_stable')
    expect(outcome.value).toBe(5400) // 2 * 3000 * 0.9
  })
})
