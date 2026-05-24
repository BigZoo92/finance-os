import { describe, expect, it } from 'bun:test'
import {
  createBinanceUsdEurFxFetcher,
  enrichBinanceValuations,
} from './binance-valuation-enrichment'
import type { ExternalInvestmentNormalizedSnapshot } from './types'

const now = () => '2026-05-12T10:00:00.000Z'

const tickerFromMap =
  (map: Record<string, string>) =>
  async ({ symbol }: { symbol: string }) => {
    const price = map[symbol]
    if (price === undefined) throw new Error(`no ticker ${symbol}`)
    return { symbol, price }
  }

const baseSnapshot = (
  overrides: Partial<ExternalInvestmentNormalizedSnapshot> = {}
): ExternalInvestmentNormalizedSnapshot => ({
  provider: 'binance',
  connectionId: 'conn-1',
  generatedAt: now(),
  accounts: [
    {
      provider: 'binance',
      connectionId: 'conn-1',
      accountExternalId: 'binance:spot',
      accountType: 'spot',
      accountAlias: null,
      baseCurrency: null,
      metadata: null,
      degradedReasons: ['VALUATION_PARTIAL'],
      sourceConfidence: 'high',
      rawImportKey: 'binance:account',
    },
  ],
  instruments: [],
  positions: [],
  trades: [],
  cashFlows: [],
  rawImports: [],
  degradedReasons: ['VALUATION_PARTIAL'],
  warnings: [],
  ...overrides,
})

const cryptoPosition = (
  asset: string,
  quantity: string,
  extra: Record<string, unknown> = {}
) =>
  ({
    provider: 'binance' as const,
    connectionId: 'conn-1',
    accountExternalId: 'binance:spot',
    instrumentKey: `binance:asset:${asset}`,
    positionKey: `binance:conn-1:${asset}`,
    providerPositionId: asset,
    name: asset,
    symbol: asset,
    assetClass: 'crypto' as const,
    quantity,
    freeQuantity: quantity,
    lockedQuantity: '0',
    currency: asset,
    providerValue: null,
    normalizedValue: null,
    valueCurrency: null,
    valueSource: 'unknown' as const,
    valueAsOf: now(),
    costBasis: null,
    costBasisCurrency: null,
    realizedPnl: null,
    unrealizedPnl: null,
    metadata: null,
    assumptions: ['Binance Spot balances do not include EUR valuation in USER_DATA account info.'],
    degradedReasons: ['VALUATION_PARTIAL', 'unknown_cost_basis'],
    sourceConfidence: 'high' as const,
    rawImportKey: `binance:position:${asset}`,
    ...extra,
  })

const eurCashPosition = () =>
  ({
    provider: 'binance' as const,
    connectionId: 'conn-1',
    accountExternalId: 'binance:spot',
    instrumentKey: 'binance:asset:EUR',
    positionKey: 'binance:conn-1:EUR',
    providerPositionId: 'EUR',
    name: 'EUR',
    symbol: 'EUR',
    assetClass: 'cash' as const,
    quantity: '4',
    freeQuantity: '4',
    lockedQuantity: '0',
    currency: 'EUR',
    providerValue: '4',
    normalizedValue: '4',
    valueCurrency: 'EUR',
    valueSource: 'provider_reported' as const,
    valueAsOf: now(),
    costBasis: '4',
    costBasisCurrency: 'EUR',
    realizedPnl: null,
    unrealizedPnl: null,
    metadata: null,
    assumptions: ['EUR cash balance is valued at its nominal amount.'],
    degradedReasons: [],
    sourceConfidence: 'high' as const,
    rawImportKey: 'binance:position:EUR',
  })

describe('enrichBinanceValuations', () => {
  it('resolves BTC via BTCEUR direct pair and writes normalized value', async () => {
    const snapshot = baseSnapshot({
      positions: [cryptoPosition('BTC', '0.5'), eurCashPosition()],
    })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({ BTCEUR: '60000', BTCUSDT: '65000' }),
      fxFetcher: async () => null,
    })

    expect(result.enrichedCount).toBe(1)
    expect(result.failedCount).toBe(0)
    const btcPos = result.snapshot.positions.find(p => p.symbol === 'BTC')
    expect(btcPos).toBeDefined()
    if (!btcPos) throw new Error('Expected BTC position')
    expect(btcPos.normalizedValue).toBe('30000')
    expect(btcPos.valueCurrency).toBe('EUR')
    expect(btcPos.valueSource).toBe('market_resolved')
    expect(btcPos.degradedReasons).not.toContain('VALUATION_PARTIAL')
    expect(btcPos.degradedReasons).toContain('unknown_cost_basis')
    expect(result.snapshot.degradedReasons).not.toContain('VALUATION_PARTIAL')
    expect(result.snapshot.accounts[0]?.degradedReasons).not.toContain('VALUATION_PARTIAL')
    expect(result.valuationSnapshots).toHaveLength(1)
    expect(result.valuationSnapshots[0]?.positionKey).toBe('binance:conn-1:BTC')
    expect(result.valuationSnapshots[0]?.value).toBe('30000')
    expect(result.valuationSnapshots[0]?.providerSymbol).toBe('BTCEUR')
  })

  it('falls back to BTCUSDT + FX when BTCEUR is unavailable', async () => {
    const snapshot = baseSnapshot({ positions: [cryptoPosition('BTC', '1')] })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({ BTCUSDT: '65000' }),
      fxFetcher: async ({ from, to }) => {
        expect(from).toBe('USD')
        expect(to).toBe('EUR')
        return { rate: 0.92, asOf: now() }
      },
    })

    expect(result.enrichedCount).toBe(1)
    const btcPos = result.snapshot.positions.find(p => p.symbol === 'BTC')
    expect(btcPos).toBeDefined()
    if (!btcPos) throw new Error('Expected BTC position')
    expect(btcPos.normalizedValue).toBe('59800')
    expect(btcPos.valueSource).toBe('market_resolved')
  })

  it('marks position with explicit degraded reason when no pair is found', async () => {
    const snapshot = baseSnapshot({ positions: [cryptoPosition('ZZZ', '10')] })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({}),
      fxFetcher: async () => null,
    })

    expect(result.enrichedCount).toBe(0)
    expect(result.failedCount).toBe(1)
    const zzz = result.snapshot.positions[0]
    expect(zzz).toBeDefined()
    if (!zzz) throw new Error('Expected one position')
    expect(zzz.normalizedValue).toBeNull()
    expect(zzz.degradedReasons).toContain('BINANCE_PRICE_NO_STABLE_PAIR')
    expect(result.snapshot.degradedReasons).toContain('VALUATION_PARTIAL')
  })

  it('leaves EUR cash positions untouched', async () => {
    const snapshot = baseSnapshot({ positions: [eurCashPosition()] })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({}),
      fxFetcher: async () => null,
    })

    expect(result.enrichedCount).toBe(0)
    expect(result.failedCount).toBe(0)
    expect(result.snapshot.positions[0]?.normalizedValue).toBe('4')
    expect(result.snapshot.positions[0]?.valueSource).toBe('provider_reported')
  })

  it('mirrors the real-world Finance-OS scenario: BTC 0.00007145 + EUR 4 cash', async () => {
    // This is the actual snapshot the user is observing in prod after v11.4.0.
    const snapshot = baseSnapshot({
      positions: [
        cryptoPosition('BTC', '0.00007145'),
        eurCashPosition(),
      ],
    })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      // BTCEUR is a real Binance pair — direct path expected
      tickerFetcher: tickerFromMap({ BTCEUR: '60000' }),
      fxFetcher: async () => null,
    })
    expect(result.enrichedCount).toBe(1)
    const btc = result.snapshot.positions.find(p => p.symbol === 'BTC')
    expect(btc).toBeDefined()
    if (!btc) throw new Error('Expected BTC position')
    expect(btc.normalizedValue).not.toBeNull()
    expect(btc.valueCurrency).toBe('EUR')
    expect(btc.valueSource).toBe('market_resolved')
    expect(btc.degradedReasons).not.toContain('VALUATION_PARTIAL')
    // VALUATION_PARTIAL must be dropped from the snapshot when all positions are valued
    expect(result.snapshot.degradedReasons).not.toContain('VALUATION_PARTIAL')
    expect(result.snapshot.accounts[0]?.degradedReasons).not.toContain('VALUATION_PARTIAL')
    // EUR cash stays provider_reported, not overwritten
    const eur = result.snapshot.positions.find(p => p.symbol === 'EUR')
    expect(eur).toBeDefined()
    if (!eur) throw new Error('Expected EUR position')
    expect(eur.valueSource).toBe('provider_reported')
    expect(eur.normalizedValue).toBe('4')
    // Valuation snapshots produced for the BTC position only
    expect(result.valuationSnapshots).toHaveLength(1)
    expect(result.valuationSnapshots[0]?.positionKey).toBe('binance:conn-1:BTC')
  })

  it('returns input snapshot unchanged for non-binance snapshots', async () => {
    const snapshot = baseSnapshot({ provider: 'ibkr' })
    const result = await enrichBinanceValuations({
      snapshot,
      targetCurrency: 'EUR',
      now,
      tickerFetcher: tickerFromMap({}),
      fxFetcher: async () => null,
    })

    expect(result.snapshot).toBe(snapshot)
    expect(result.enrichedCount).toBe(0)
  })
})

describe('createBinanceUsdEurFxFetcher', () => {
  it('uses Binance EURUSDT ticker to derive USD→EUR rate', async () => {
    const fetcher = createBinanceUsdEurFxFetcher({
      tickerFetcher: tickerFromMap({ EURUSDT: '1.10' }),
      now,
      fallbackUsdEurRate: 0.5,
    })
    const result = await fetcher({ from: 'USD', to: 'EUR' })
    expect(result).not.toBeNull()
    expect(result?.rate).toBeCloseTo(1 / 1.1, 6)
  })

  it('falls back to the static rate when EURUSDT is unavailable', async () => {
    const fetcher = createBinanceUsdEurFxFetcher({
      tickerFetcher: tickerFromMap({}),
      now,
      fallbackUsdEurRate: 0.92,
    })
    const result = await fetcher({ from: 'USD', to: 'EUR' })
    expect(result).toEqual({ rate: 0.92, asOf: now() })
  })

  it('returns null when both Binance and fallback are unavailable', async () => {
    const fetcher = createBinanceUsdEurFxFetcher({
      tickerFetcher: tickerFromMap({}),
      now,
      fallbackUsdEurRate: null,
    })
    expect(await fetcher({ from: 'USD', to: 'EUR' })).toBeNull()
  })

  it('returns 1:1 for matching currencies', async () => {
    const fetcher = createBinanceUsdEurFxFetcher({
      tickerFetcher: tickerFromMap({}),
      now,
      fallbackUsdEurRate: null,
    })
    expect(await fetcher({ from: 'EUR', to: 'EUR' })).toEqual({ rate: 1, asOf: now() })
  })
})
