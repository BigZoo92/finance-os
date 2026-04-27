/**
 * Tests for the Trading Lab market data adapter.
 *
 * Cache and provider paths require a real DB connection / network — those
 * are skipped here. We exercise:
 *   - caller-provided priority + range filtering
 *   - forced fixture fallback flag
 *   - "deterministic_fixture" preference
 *   - "provider" preference returns PROVIDER_UNCONFIGURED when no key is set
 *   - "caller_provided" preference fails if no caller data
 *   - "auto" walks chain and lands on fixture when nothing else is configured
 *   - no provider tokens / api keys leak into errors or warnings
 */
import { describe, expect, it } from 'bun:test'
import { resolveMarketData, type ResolveDeps, type ResolveInput } from './trading-lab-market-data'

const FAKE_DB = {} as ResolveDeps['db']

const baseDeps: ResolveDeps = {
  db: FAKE_DB,
  eodhdApiKey: undefined,
  twelveDataApiKey: undefined,
  marketDataEodhdEnabled: false,
  marketDataTwelveDataEnabled: false,
  forceFixtureFallback: false,
  cacheEnabled: false,
}

const baseInput = (overrides: Partial<ResolveInput> = {}): ResolveInput => ({
  symbol: 'SPY.US',
  interval: '1d',
  startDate: new Date('2024-01-02'),
  endDate: new Date('2024-03-15'),
  requestId: 'rid-test',
  ...overrides,
})

describe('resolveMarketData', () => {
  it('uses caller-provided OHLCV when valid bars are supplied', async () => {
    const callerData = [
      { date: '2024-01-02', open: 100, high: 102, low: 99, close: 101, volume: 1_000_000 },
      { date: '2024-01-03', open: 101, high: 103, low: 100, close: 102, volume: 1_100_000 },
      { date: '2024-01-04', open: 102, high: 104, low: 101, close: 103, volume: 1_200_000 },
      { date: '2024-01-05', open: 103, high: 105, low: 102, close: 104, volume: 1_300_000 },
      { date: '2024-01-08', open: 104, high: 106, low: 103, close: 105, volume: 1_400_000 },
    ]
    const result = await resolveMarketData({
      input: baseInput({ callerData, dataSourcePreference: 'caller_provided' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resolvedMarketDataSource).toBe('caller_provided')
    expect(result.dataProvider).toBe('caller')
    expect(result.dataQuality).toBe('real')
    expect(result.barsCount).toBe(5)
    expect(result.fallbackUsed).toBe(false)
  })

  it('rejects caller_provided when no valid bars are supplied', async () => {
    const result = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'caller_provided' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('DATA_UNAVAILABLE')
  })

  it('returns deterministic fixture when forced via flag', async () => {
    const result = await resolveMarketData({
      input: baseInput(),
      deps: { ...baseDeps, forceFixtureFallback: true },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resolvedMarketDataSource).toBe('deterministic_fixture')
    expect(result.dataQuality).toBe('synthetic')
    expect(result.dataWarnings.some(w => w.includes('Synthetic'))).toBe(true)
  })

  it('returns deterministic fixture when preference=deterministic_fixture', async () => {
    const result = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'deterministic_fixture' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resolvedMarketDataSource).toBe('deterministic_fixture')
    expect(result.dataProvider).toBe('fixture')
    expect(result.fallbackUsed).toBe(false) // explicit choice, not fallback
  })

  it('returns PROVIDER_UNCONFIGURED when preference=provider and no key', async () => {
    const result = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'provider' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.code).toBe('PROVIDER_UNCONFIGURED')
  })

  it('walks auto chain and lands on fixture when nothing is configured', async () => {
    const result = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'auto' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.resolvedMarketDataSource).toBe('deterministic_fixture')
    expect(result.fallbackUsed).toBe(true)
    expect(result.fallbackReason).toBe('no_provider_configured')
  })

  it('produces deterministic fixture bars (no random seed leak)', async () => {
    const a = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'deterministic_fixture' }),
      deps: baseDeps,
    })
    const b = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'deterministic_fixture' }),
      deps: baseDeps,
    })
    expect(a.ok && b.ok).toBe(true)
    if (!a.ok || !b.ok) return
    expect(a.barsCount).toBe(b.barsCount)
    expect(a.bars[0]).toEqual(b.bars[0])
    expect(a.bars.at(-1)).toEqual(b.bars.at(-1))
  })

  it('does not leak any api key string into error or warnings', async () => {
    const fakeKey = 'eodhd-secret-token-12345'
    const result = await resolveMarketData({
      input: baseInput({ dataSourcePreference: 'auto' }),
      deps: {
        ...baseDeps,
        eodhdApiKey: fakeKey,
        marketDataEodhdEnabled: false, // disabled — adapter never reaches network
        forceFixtureFallback: true,
      },
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain(fakeKey)
  })

  it('drops out-of-range caller bars and warns', async () => {
    const callerData = [
      { date: '2023-12-15', open: 1, high: 1, low: 1, close: 1, volume: 1 },
      { date: '2024-01-02', open: 100, high: 102, low: 99, close: 101, volume: 1 },
      { date: '2024-01-03', open: 101, high: 103, low: 100, close: 102, volume: 1 },
      { date: '2024-01-04', open: 102, high: 104, low: 101, close: 103, volume: 1 },
      { date: '2024-01-05', open: 103, high: 105, low: 102, close: 104, volume: 1 },
      { date: '2024-01-08', open: 104, high: 106, low: 103, close: 105, volume: 1 },
    ]
    const result = await resolveMarketData({
      input: baseInput({ callerData, dataSourcePreference: 'caller_provided' }),
      deps: baseDeps,
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.barsCount).toBe(5)
    expect(result.dataWarnings.some(w => w.includes('out of range'))).toBe(true)
  })
})
