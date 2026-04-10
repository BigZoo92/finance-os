import { describe, expect, it } from 'bun:test'
import { MARKET_MACRO_SERIES } from './market-definitions'
import { buildMacroSeriesSnapshots, buildMarketSignals } from './market-analytics'

describe('buildMacroSeriesSnapshots', () => {
  it('computes CPI year-over-year and preserves level series', () => {
    const series = buildMacroSeriesSnapshots({
      definitions: MARKET_MACRO_SERIES.filter(definition =>
        ['FEDFUNDS', 'CPIAUCSL', 'UNRATE'].includes(definition.id)
      ),
      observations: [
        { seriesId: 'FEDFUNDS', observationDate: '2026-02-01', value: 4.5 },
        { seriesId: 'FEDFUNDS', observationDate: '2026-03-01', value: 4.5 },
        { seriesId: 'UNRATE', observationDate: '2026-02-01', value: 4.2 },
        { seriesId: 'UNRATE', observationDate: '2026-03-01', value: 4.4 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-01-01', value: 310 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-02-01', value: 311 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-03-01', value: 312 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-04-01', value: 313 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-05-01', value: 314 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-06-01', value: 315 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-07-01', value: 316 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-08-01', value: 317 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-09-01', value: 318 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-10-01', value: 319 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-11-01', value: 320 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-12-01', value: 321 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-01-01', value: 322 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-02-01', value: 323 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-03-01', value: 323.5 },
      ],
    })

    const fedFunds = series.find(item => item.seriesId === 'FEDFUNDS')
    const inflation = series.find(item => item.seriesId === 'CPIAUCSL')

    expect(fedFunds?.latestValue).toBe(4.5)
    expect(inflation?.latestValue).toBeGreaterThan(3)
    expect(inflation?.comparisonValue).not.toBeNull()
  })
})

describe('buildMarketSignals', () => {
  it('emits deterministic market and macro signals from the snapshot', () => {
    const macroSeries = buildMacroSeriesSnapshots({
      definitions: MARKET_MACRO_SERIES.filter(definition =>
        ['FEDFUNDS', 'T10Y2Y', 'CPIAUCSL', 'UNRATE'].includes(definition.id)
      ),
      observations: [
        { seriesId: 'FEDFUNDS', observationDate: '2026-02-01', value: 4.75 },
        { seriesId: 'FEDFUNDS', observationDate: '2026-03-01', value: 4.5 },
        { seriesId: 'T10Y2Y', observationDate: '2026-02-01', value: -0.12 },
        { seriesId: 'T10Y2Y', observationDate: '2026-03-01', value: -0.08 },
        { seriesId: 'UNRATE', observationDate: '2026-02-01', value: 4.1 },
        { seriesId: 'UNRATE', observationDate: '2026-03-01', value: 4.4 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-01-01', value: 310 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-02-01', value: 311 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-03-01', value: 312 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-04-01', value: 313 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-05-01', value: 314 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-06-01', value: 315 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-07-01', value: 316 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-08-01', value: 317 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-09-01', value: 318 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-10-01', value: 319 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-11-01', value: 320 },
        { seriesId: 'CPIAUCSL', observationDate: '2025-12-01', value: 321 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-01-01', value: 322 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-02-01', value: 323 },
        { seriesId: 'CPIAUCSL', observationDate: '2026-03-01', value: 323.5 },
      ],
    })

    const signals = buildMarketSignals({
      macroSeries,
      quotes: [
        {
          instrumentId: 'spy-us',
          label: 'S&P 500 (SPY)',
          shortLabel: 'S&P 500',
          symbol: 'SPY',
          assetClass: 'etf',
          region: 'us',
          exchange: 'NYSE Arca',
          currency: 'USD',
          proxyLabel: 'ETF proxy',
          tags: [],
          price: 500,
          previousClose: 495,
          dayChangePct: 1.01,
          weekChangePct: 1.3,
          monthChangePct: 4.5,
          ytdChangePct: 7.2,
          history: [],
          source: {
            provider: 'eodhd',
            baselineProvider: 'eodhd',
            overlayProvider: null,
            mode: 'eod',
            delayLabel: 'Clôture EOD',
            reason: 'fixture',
            quoteDate: '2026-03-01',
            quoteAsOf: null,
            capturedAt: '2026-03-01T00:00:00.000Z',
            freshnessMinutes: null,
            isDelayed: true,
          },
          marketSession: { state: 'closed', isOpen: false, label: 'Marché fermé' },
        },
        {
          instrumentId: 'cw8-pa',
          label: 'MSCI World PEA (CW8)',
          shortLabel: 'MSCI World',
          symbol: 'CW8',
          assetClass: 'etf',
          region: 'europe',
          exchange: 'Euronext Paris',
          currency: 'EUR',
          proxyLabel: 'ETF monde',
          tags: [],
          price: 100,
          previousClose: 100.5,
          dayChangePct: -0.5,
          weekChangePct: 0.2,
          monthChangePct: 1.1,
          ytdChangePct: 3.5,
          history: [],
          source: {
            provider: 'eodhd',
            baselineProvider: 'eodhd',
            overlayProvider: null,
            mode: 'eod',
            delayLabel: 'Clôture EOD',
            reason: 'fixture',
            quoteDate: '2026-03-01',
            quoteAsOf: null,
            capturedAt: '2026-03-01T00:00:00.000Z',
            freshnessMinutes: null,
            isDelayed: true,
          },
          marketSession: { state: 'closed', isOpen: false, label: 'Marché fermé' },
        },
      ],
    })

    expect(signals.some(signal => signal.id === 'rates-high')).toBeTrue()
    expect(signals.some(signal => signal.id === 'curve-inverted')).toBeTrue()
    expect(signals.some(signal => signal.id === 'us-outperformance')).toBeTrue()
  })
})
