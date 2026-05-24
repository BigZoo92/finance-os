import { describe, expect, it } from 'bun:test'
import { enrichMarketQuotedValuations, type MarketQuoteRow } from './market-quoted-valuation'
import type { ExternalInvestmentNormalizedSnapshot } from './types'

const GENERATED_AT = '2026-05-12T10:00:00.000Z'

const baseSnapshot = (
  overrides: Partial<ExternalInvestmentNormalizedSnapshot> = {}
): ExternalInvestmentNormalizedSnapshot => ({
  provider: 'ibkr',
  connectionId: 'ibkr:flex',
  generatedAt: GENERATED_AT,
  accounts: [],
  instruments: [],
  positions: [],
  trades: [],
  cashFlows: [],
  rawImports: [],
  degradedReasons: ['VALUATION_PARTIAL'],
  warnings: [],
  ...overrides,
})

const etfPosition = (overrides: Record<string, unknown> = {}) =>
  ({
    provider: 'ibkr' as const,
    connectionId: 'ibkr:flex',
    accountExternalId: 'U1',
    instrumentKey: 'ibkr:cw8',
    positionKey: 'ibkr:U1:cw8',
    providerPositionId: 'cw8',
    name: 'Amundi MSCI World',
    symbol: 'CW8.PA',
    assetClass: 'etf' as const,
    quantity: '10',
    freeQuantity: null,
    lockedQuantity: null,
    currency: 'EUR',
    providerValue: null,
    normalizedValue: null,
    valueCurrency: null,
    valueSource: 'unknown' as const,
    valueAsOf: GENERATED_AT,
    costBasis: null,
    costBasisCurrency: null,
    realizedPnl: null,
    unrealizedPnl: null,
    metadata: { isin: 'LU1681043599', conid: '12345' },
    assumptions: [],
    degradedReasons: ['VALUATION_PARTIAL'],
    sourceConfidence: 'high' as const,
    rawImportKey: null,
    ...overrides,
  })

const quoteRow = (overrides: Partial<MarketQuoteRow> = {}): MarketQuoteRow => ({
  symbol: 'CW8.PA',
  providerSymbol: 'CW8.PA',
  isin: 'LU1681043599',
  price: '500',
  currency: 'EUR',
  quoteAsOf: GENERATED_AT,
  sourceProvider: 'eodhd',
  isDelayed: false,
  marketState: 'closed',
  freshnessMinutes: 0,
  ...overrides,
})

describe('enrichMarketQuotedValuations', () => {
  it('values an ETF position using the market quote snapshot', async () => {
    const snapshot = baseSnapshot({ positions: [etfPosition()] })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async ({ symbol }) => (symbol === 'CW8.PA' ? quoteRow() : null),
      staleAfterMinutes: 240,
    })

    expect(result.enrichedCount).toBe(1)
    expect(result.staleCount).toBe(0)
    expect(result.missingCount).toBe(0)
    const pos = result.snapshot.positions[0]
    expect(pos).toBeDefined()
    if (!pos) throw new Error('Expected one position')
    expect(pos.normalizedValue).toBe('5000')
    expect(pos.valueCurrency).toBe('EUR')
    expect(pos.valueSource).toBe('market_cache')
    expect(pos.degradedReasons).not.toContain('VALUATION_PARTIAL')
    expect(result.snapshot.degradedReasons).not.toContain('VALUATION_PARTIAL')
  })

  it('flags a quote older than staleAfterMinutes as STALE_QUOTE', async () => {
    const snapshot = baseSnapshot({ positions: [etfPosition()] })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async () =>
        quoteRow({
          // 24 hours older than generatedAt
          quoteAsOf: '2026-05-11T10:00:00.000Z',
        }),
      staleAfterMinutes: 240, // 4 hours
    })

    expect(result.enrichedCount).toBe(1)
    expect(result.staleCount).toBe(1)
    const pos = result.snapshot.positions[0]
    expect(pos).toBeDefined()
    if (!pos) throw new Error('Expected one position')
    expect(pos.normalizedValue).toBe('5000')
    expect(pos.degradedReasons).toContain('STALE_QUOTE')
  })

  it('returns MARKET_QUOTE_MISSING when lookup yields no row', async () => {
    const snapshot = baseSnapshot({ positions: [etfPosition()] })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async () => null,
      staleAfterMinutes: 240,
    })

    expect(result.enrichedCount).toBe(0)
    expect(result.missingCount).toBe(1)
    const pos = result.snapshot.positions[0]
    expect(pos).toBeDefined()
    if (!pos) throw new Error('Expected one position')
    expect(pos.normalizedValue).toBeNull()
    expect(pos.degradedReasons).toContain('MARKET_QUOTE_MISSING')
    expect(result.snapshot.degradedReasons).toContain('VALUATION_PARTIAL')
  })

  it('returns SYMBOL_MAPPING_MISSING when the position has no usable lookup key', async () => {
    const snapshot = baseSnapshot({
      positions: [etfPosition({ symbol: null, metadata: null })],
    })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async () => quoteRow(),
      staleAfterMinutes: 240,
    })
    expect(result.missingCount).toBe(1)
    expect(result.snapshot.positions[0]?.degradedReasons).toContain('SYMBOL_MAPPING_MISSING')
  })

  it('skips positions that already have a normalizedValue', async () => {
    let called = 0
    const snapshot = baseSnapshot({
      positions: [
        etfPosition({
          providerValue: '5000',
          normalizedValue: '5000',
          valueCurrency: 'EUR',
          valueSource: 'provider_reported',
          degradedReasons: [],
        }),
      ],
    })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async () => {
        called += 1
        return quoteRow()
      },
      staleAfterMinutes: 240,
    })
    expect(called).toBe(0)
    expect(result.enrichedCount).toBe(0)
    expect(result.snapshot.positions[0]?.valueSource).toBe('provider_reported')
  })

  it('skips cash positions and non-quoteable asset classes', async () => {
    const snapshot = baseSnapshot({
      positions: [
        etfPosition({
          assetClass: 'cash',
          symbol: 'EUR',
        }),
      ],
    })
    const result = await enrichMarketQuotedValuations({
      snapshot,
      lookup: async () => quoteRow(),
      staleAfterMinutes: 240,
    })
    expect(result.enrichedCount).toBe(0)
    expect(result.missingCount).toBe(0)
  })
})
