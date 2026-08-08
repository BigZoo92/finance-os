import { describe, expect, it } from 'bun:test'
import { buildValuationCoverageReport } from './coverage'
import type { FxRateInput, ValuationItemInput } from './types'
import { valuateItems } from './valuate-items'

const NOW = new Date('2026-08-07T12:00:00.000Z')
const FRESH_AS_OF = '2026-08-07T06:00:00.000Z'

const FX_RATES: FxRateInput[] = [
  {
    baseCurrency: 'EUR',
    quoteCurrency: 'USD',
    rate: 1.08,
    provider: 'ecb',
    sourceType: 'daily',
    rateTimestamp: '2026-08-07T00:00:00.000Z',
    staleAfterSeconds: 4 * 24 * 60 * 60,
  },
]

const baseItem = (overrides: Partial<ValuationItemInput>): ValuationItemInput => ({
  itemKey: 'asset:1',
  kind: 'cash',
  name: 'Compte courant',
  provider: 'powens',
  assetClass: 'cash',
  currency: 'EUR',
  quantity: null,
  nativeValue: 1000,
  asOf: FRESH_AS_OF,
  isManual: false,
  costBasis: null,
  costBasisCurrency: null,
  costBasisSource: 'unknown',
  identity: { provider: 'powens' },
  degradedReasons: [],
  ...overrides,
})

const run = (items: ValuationItemInput[]) => valuateItems({ items, fxRates: FX_RATES, now: NOW })

describe('valuateItems — cash', () => {
  it('values EUR cash at its balance with derived status', () => {
    const [v] = run([baseItem({})])
    expect(v?.status).toBe('derived')
    expect(v?.valueBase).toBe(1000)
    expect(v?.fxRate).toBe(1)
  })

  it('values USD cash through FX', () => {
    const [v] = run([baseItem({ currency: 'USD', nativeValue: 1080 })])
    expect(v?.status).toBe('derived')
    expect(v?.valueBase).toBe(1000)
    expect(v?.fxProvider).toBe('ecb')
  })

  it('marks missing FX as unavailable, never 0', () => {
    const [v] = run([baseItem({ currency: 'JPY', nativeValue: 150000 })])
    expect(v?.status).toBe('unavailable')
    expect(v?.valueBase).toBeNull()
    expect(v?.valueOriginal).toBe(150000)
    expect(v?.errorCode).toBe('FX_RATE_UNAVAILABLE')
  })
})

describe('valuateItems — investments', () => {
  it('prices a fresh position from provider-native value', () => {
    const [v] = run([
      baseItem({
        kind: 'investment',
        assetClass: 'stock',
        provider: 'ibkr',
        currency: 'USD',
        nativeValue: 2160,
        quantity: 10,
        identity: { provider: 'ibkr', conid: '265598' },
      }),
    ])
    expect(v?.status).toBe('priced')
    expect(v?.valueBase).toBe(2000)
    expect(v?.identityStatus).toBe('resolved')
    expect(v?.identityKey).toBe('conid:265598')
  })

  it('marks an identified position without value as unavailable', () => {
    const [v] = run([
      baseItem({
        kind: 'investment',
        assetClass: 'stock',
        provider: 'ibkr',
        nativeValue: null,
        identity: { provider: 'ibkr', isin: 'FR0000121014' },
        degradedReasons: ['MARKET_QUOTE_MISSING'],
      }),
    ])
    expect(v?.status).toBe('unavailable')
    expect(v?.valueBase).toBeNull()
    expect(v?.errorCode).toBe('MARKET_QUOTE_MISSING')
  })

  it('marks a bare ambiguous ticker without value as unresolved', () => {
    const [v] = run([
      baseItem({
        kind: 'investment',
        assetClass: 'stock',
        provider: 'manual-import',
        nativeValue: null,
        currency: null,
        identity: { provider: 'manual-import', symbol: 'AIR' },
      }),
    ])
    expect(v?.status).toBe('unresolved')
    expect(v?.identityStatus).toBe('ambiguous')
  })

  it('marks a value built on an approximate upstream FX bridge as estimated', () => {
    const [v] = run([
      baseItem({
        kind: 'position',
        assetClass: 'crypto',
        provider: 'binance',
        currency: 'EUR',
        nativeValue: 90000,
        approximateValue: true,
        identity: { provider: 'binance', binanceAsset: 'BTC' },
      }),
    ])
    expect(v?.status).toBe('estimated')
    expect(v?.valueBase).toBe(90000)
  })

  it('downgrades an old provider value to stale but keeps it', () => {
    const [v] = run([
      baseItem({
        kind: 'investment',
        assetClass: 'crypto',
        provider: 'binance',
        currency: 'EUR',
        nativeValue: 500,
        asOf: '2026-08-01T00:00:00.000Z',
        identity: { provider: 'binance', binanceAsset: 'BTC' },
      }),
    ])
    expect(v?.status).toBe('stale')
    expect(v?.valueBase).toBe(500)
  })
})

describe('valuateItems — manual assets', () => {
  it('keeps manual status and value even with an old date', () => {
    const [v] = run([
      baseItem({
        kind: 'manual',
        assetClass: 'other',
        provider: null,
        isManual: true,
        nativeValue: 285000,
        asOf: '2025-01-01T00:00:00.000Z',
        identity: { provider: null },
      }),
    ])
    expect(v?.status).toBe('manual')
    expect(v?.valueBase).toBe(285000)
    expect(v?.source).toBe('manual_entry')
  })

  it('converts a foreign-currency manual asset through FX', () => {
    const [v] = run([
      baseItem({
        kind: 'manual',
        assetClass: 'other',
        provider: null,
        isManual: true,
        currency: 'USD',
        nativeValue: 1080,
        identity: { provider: null },
      }),
    ])
    expect(v?.status).toBe('manual')
    expect(v?.valueBase).toBe(1000)
  })
})

describe('valuateItems — P&L semantics', () => {
  const investment = (overrides: Partial<ValuationItemInput>) =>
    baseItem({
      kind: 'investment',
      assetClass: 'etf',
      provider: 'ibkr',
      identity: { provider: 'ibkr', isin: 'IE00B4L5Y983' },
      ...overrides,
    })

  it('computes positive unrealized P&L when cost basis is known', () => {
    const [v] = run([
      investment({ nativeValue: 12450, costBasis: 10980, costBasisSource: 'provider' }),
    ])
    expect(v?.costBasisBase).toBe(10980)
    expect(v?.unrealizedPnlBase).toBe(1470)
    expect(v?.unrealizedPnlPercent).toBeCloseTo(13.3879, 3)
  })

  it('computes negative unrealized P&L', () => {
    const [v] = run([
      investment({ nativeValue: 900, costBasis: 1000, costBasisSource: 'provider' }),
    ])
    expect(v?.unrealizedPnlBase).toBe(-100)
    expect(v?.unrealizedPnlPercent).toBeCloseTo(-10, 6)
  })

  it('returns null P&L when cost basis is unknown — never 0', () => {
    const [v] = run([investment({ nativeValue: 900, costBasis: null, costBasisSource: 'unknown' })])
    expect(v?.unrealizedPnlBase).toBeNull()
    expect(v?.unrealizedPnlPercent).toBeNull()
  })

  it('never divides by a zero cost basis', () => {
    const [v] = run([investment({ nativeValue: 900, costBasis: 0, costBasisSource: 'provider' })])
    expect(v?.unrealizedPnlPercent).toBeNull()
    expect(v?.unrealizedPnlBase).toBe(900)
  })

  it('converts a cost basis expressed in another currency', () => {
    const [v] = run([
      investment({
        currency: 'USD',
        nativeValue: 2160,
        costBasis: 1080,
        costBasisCurrency: 'USD',
        costBasisSource: 'provider',
      }),
    ])
    expect(v?.valueBase).toBe(2000)
    expect(v?.costBasisBase).toBe(1000)
    expect(v?.unrealizedPnlBase).toBe(1000)
  })
})

describe('valuateItems — invariants', () => {
  const mixedItems: ValuationItemInput[] = [
    baseItem({}),
    baseItem({ itemKey: 'asset:2', currency: 'USD', nativeValue: 540 }),
    baseItem({ itemKey: 'asset:3', currency: 'JPY', nativeValue: 10000 }),
    baseItem({
      itemKey: 'asset:4',
      kind: 'investment',
      assetClass: 'stock',
      provider: 'ibkr',
      nativeValue: null,
      identity: { provider: 'ibkr', conid: '1' },
    }),
    baseItem({
      itemKey: 'asset:5',
      kind: 'manual',
      isManual: true,
      provider: null,
      nativeValue: 100,
      identity: { provider: null },
    }),
  ]

  it('valueBase is finite whenever defined and statuses map to sources', () => {
    for (const v of run(mixedItems)) {
      if (v.valueBase !== null) {
        expect(Number.isFinite(v.valueBase)).toBe(true)
      }
      if (v.status === 'manual') {
        expect(v.source).toBe('manual_entry')
      }
      if (v.status === 'unavailable' || v.status === 'unresolved') {
        expect(v.valueBase).toBeNull()
      }
    }
  })

  it('is deterministic: same inputs produce same outputs', () => {
    expect(run(mixedItems)).toEqual(run(mixedItems))
  })

  it('coverage percent stays in [0, 100] and unknown values are not counted as 0', () => {
    const report = buildValuationCoverageReport(run(mixedItems))
    expect(report.coveragePercent).not.toBeNull()
    if (report.coveragePercent !== null) {
      expect(report.coveragePercent).toBeGreaterThanOrEqual(0)
      expect(report.coveragePercent).toBeLessThanOrEqual(100)
    }
    // 3 valued items: 1000 EUR + 500 EUR (540 USD) + 100 EUR manual.
    expect(report.totalValueBase).toBe(1600)
    expect(report.unknownValueCount).toBe(2)
    expect(report.statusCounts.unavailable).toBe(2)
  })

  it('reports null totals when nothing has a value', () => {
    const report = buildValuationCoverageReport(
      run([
        baseItem({
          kind: 'investment',
          nativeValue: null,
          identity: { provider: 'ibkr', conid: '2' },
        }),
      ])
    )
    expect(report.totalValueBase).toBeNull()
    expect(report.coveragePercent).toBe(0)
  })

  it('reports null coverage for an empty portfolio', () => {
    const report = buildValuationCoverageReport(run([]))
    expect(report.coveragePercent).toBeNull()
    expect(report.totalValueBase).toBeNull()
  })
})
