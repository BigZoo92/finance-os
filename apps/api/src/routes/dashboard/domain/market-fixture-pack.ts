import {
  getMarketMacroSeriesDefinition,
  MARKET_WATCHLIST_GROUPS,
  PANORAMA_MARKET_IDS,
  getMarketInstrumentDefinition,
} from './market-definitions'
import { buildMarketsOverviewResponse, buildMacroSeriesSnapshots } from './market-analytics'
import type { DashboardMarketProviderHealth, DashboardMarketsOverviewResponse } from './markets-types'

const FIXTURE_GENERATED_AT = '2026-04-10T06:45:00.000Z'
const FIXTURE_LAST_SUCCESS_AT = '2026-04-10T06:40:00.000Z'

const quote = ({
  instrumentId,
  price,
  previousClose,
  dayChangePct,
  weekChangePct,
  monthChangePct,
  ytdChangePct,
  history,
  provider = 'eodhd',
  mode = 'eod',
  overlayProvider = null,
}: {
  instrumentId: string
  price: number
  previousClose: number
  dayChangePct: number
  weekChangePct: number
  monthChangePct: number
  ytdChangePct: number
  history: number[]
  provider?: 'eodhd' | 'twelve_data'
  mode?: 'eod' | 'delayed' | 'intraday'
  overlayProvider?: 'twelve_data' | null
}) => {
  const instrument = getMarketInstrumentDefinition(instrumentId)
  if (!instrument) {
    throw new Error(`Unknown fixture instrument: ${instrumentId}`)
  }

  return {
    instrumentId,
    label: instrument.label,
    shortLabel: instrument.shortLabel,
    symbol: instrument.symbol,
    assetClass: instrument.assetClass,
    region: instrument.region,
    exchange: instrument.exchange,
    currency: instrument.currency,
    proxyLabel: instrument.proxyLabel,
    tags: instrument.tags,
    price,
    previousClose,
    dayChangePct,
    weekChangePct,
    monthChangePct,
    ytdChangePct,
    history: history.map((value, index) => ({
      date: `2026-03-${String(index + 1).padStart(2, '0')}`,
      value,
      provider: overlayProvider && index === history.length - 1 ? overlayProvider : 'eodhd',
    })),
    source: {
      provider,
      baselineProvider: 'eodhd' as const,
      overlayProvider,
      mode,
      delayLabel: provider === 'twelve_data' ? 'Overlay US plus frais' : 'Clôture EOD',
      reason:
        provider === 'twelve_data'
          ? 'Overlay Twelve Data actif sur symbole US éligible.'
          : 'Source primaire EODHD EOD.',
      quoteDate: '2026-04-09',
      quoteAsOf: provider === 'twelve_data' ? '2026-04-10T06:35:00.000Z' : '2026-04-09T21:00:00.000Z',
      capturedAt: FIXTURE_GENERATED_AT,
      freshnessMinutes: provider === 'twelve_data' ? 10 : 540,
      isDelayed: provider !== 'twelve_data',
    },
    marketSession: {
      state: 'closed' as const,
      isOpen: false,
      label: 'Marché fermé',
    },
  }
}

const macroObservations = [
  ['FEDFUNDS', [
    ['2025-10-01', 4.75],
    ['2025-11-01', 4.75],
    ['2025-12-01', 4.5],
    ['2026-01-01', 4.5],
    ['2026-02-01', 4.5],
    ['2026-03-01', 4.5],
  ]],
  ['SOFR', [
    ['2026-03-24', 4.31],
    ['2026-03-25', 4.31],
    ['2026-03-26', 4.31],
    ['2026-03-27', 4.30],
    ['2026-03-30', 4.29],
    ['2026-03-31', 4.29],
  ]],
  ['DGS2', [
    ['2026-03-24', 4.02],
    ['2026-03-25', 4.01],
    ['2026-03-26', 4.04],
    ['2026-03-27', 4.07],
    ['2026-03-30', 4.08],
    ['2026-03-31', 4.06],
  ]],
  ['DGS10', [
    ['2026-03-24', 4.18],
    ['2026-03-25', 4.2],
    ['2026-03-26', 4.23],
    ['2026-03-27', 4.25],
    ['2026-03-30', 4.27],
    ['2026-03-31', 4.24],
  ]],
  ['T10Y2Y', [
    ['2026-03-24', 0.16],
    ['2026-03-25', 0.19],
    ['2026-03-26', 0.19],
    ['2026-03-27', 0.18],
    ['2026-03-30', 0.19],
    ['2026-03-31', 0.18],
  ]],
  ['CPIAUCSL', [
    ['2025-01-01', 315.1],
    ['2025-02-01', 316.0],
    ['2025-03-01', 317.2],
    ['2025-04-01', 318.1],
    ['2025-05-01', 319.0],
    ['2025-06-01', 319.7],
    ['2025-07-01', 320.2],
    ['2025-08-01', 320.5],
    ['2025-09-01', 321.0],
    ['2025-10-01', 321.7],
    ['2025-11-01', 322.1],
    ['2025-12-01', 322.6],
    ['2026-01-01', 323.0],
    ['2026-02-01', 323.4],
    ['2026-03-01', 323.7],
  ]],
  ['UNRATE', [
    ['2025-10-01', 4.1],
    ['2025-11-01', 4.1],
    ['2025-12-01', 4.1],
    ['2026-01-01', 4.2],
    ['2026-02-01', 4.2],
    ['2026-03-01', 4.3],
  ]],
] as const

const providerHealth: DashboardMarketProviderHealth[] = [
  {
    provider: 'eodhd',
    label: 'EODHD',
    role: 'prices',
    enabled: true,
    status: 'healthy',
    lastSuccessAt: FIXTURE_LAST_SUCCESS_AT,
    lastAttemptAt: FIXTURE_LAST_SUCCESS_AT,
    lastFailureAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastFetchedCount: 14,
    successCount: 1,
    failureCount: 0,
    skippedCount: 0,
    freshnessLabel: 'EODHD: fixture EOD',
  },
  {
    provider: 'twelve_data',
    label: 'Twelve Data',
    role: 'overlay',
    enabled: true,
    status: 'healthy',
    lastSuccessAt: FIXTURE_LAST_SUCCESS_AT,
    lastAttemptAt: FIXTURE_LAST_SUCCESS_AT,
    lastFailureAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastFetchedCount: 2,
    successCount: 1,
    failureCount: 0,
    skippedCount: 0,
    freshnessLabel: 'Twelve Data: overlay US actif',
  },
  {
    provider: 'fred',
    label: 'FRED',
    role: 'macro',
    enabled: true,
    status: 'healthy',
    lastSuccessAt: FIXTURE_LAST_SUCCESS_AT,
    lastAttemptAt: FIXTURE_LAST_SUCCESS_AT,
    lastFailureAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastFetchedCount: 7,
    successCount: 1,
    failureCount: 0,
    skippedCount: 0,
    freshnessLabel: 'FRED: séries officielles',
  },
]

export const getDashboardMarketsFixture = (
  requestId: string
): DashboardMarketsOverviewResponse => {
  const quotes = [
    quote({
      instrumentId: 'spy-us',
      price: 536.2,
      previousClose: 531.1,
      dayChangePct: 0.96,
      weekChangePct: 1.7,
      monthChangePct: 4.6,
      ytdChangePct: 8.2,
      history: [510, 512, 515, 518, 520, 523, 526, 528, 531, 536.2],
      provider: 'twelve_data',
      mode: 'intraday',
      overlayProvider: 'twelve_data',
    }),
    quote({
      instrumentId: 'qqq-us',
      price: 462.7,
      previousClose: 457.8,
      dayChangePct: 1.07,
      weekChangePct: 2.1,
      monthChangePct: 5.8,
      ytdChangePct: 10.4,
      history: [430, 434, 438, 441, 445, 448, 451, 455, 458, 462.7],
      provider: 'twelve_data',
      mode: 'intraday',
      overlayProvider: 'twelve_data',
    }),
    quote({
      instrumentId: 'vgk-us',
      price: 68.1,
      previousClose: 67.7,
      dayChangePct: 0.59,
      weekChangePct: 1.2,
      monthChangePct: 2.6,
      ytdChangePct: 5.2,
      history: [64.5, 64.9, 65.1, 65.4, 65.9, 66.2, 66.8, 67.1, 67.7, 68.1],
    }),
    quote({
      instrumentId: 'ewj-us',
      price: 73.8,
      previousClose: 73.4,
      dayChangePct: 0.54,
      weekChangePct: 1.5,
      monthChangePct: 3.1,
      ytdChangePct: 6.6,
      history: [69.2, 69.5, 70.1, 70.4, 70.9, 71.4, 72.1, 72.8, 73.4, 73.8],
    }),
    quote({
      instrumentId: 'iemg-us',
      price: 56.2,
      previousClose: 55.9,
      dayChangePct: 0.54,
      weekChangePct: 0.9,
      monthChangePct: 2.4,
      ytdChangePct: 4.4,
      history: [53.1, 53.5, 53.9, 54.3, 54.8, 55.0, 55.4, 55.6, 55.9, 56.2],
    }),
    quote({
      instrumentId: 'cw8-pa',
      price: 546.8,
      previousClose: 544.3,
      dayChangePct: 0.46,
      weekChangePct: 1.4,
      monthChangePct: 4.1,
      ytdChangePct: 7.8,
      history: [521, 523, 526, 529, 532, 535, 538, 541, 544.3, 546.8],
    }),
    quote({
      instrumentId: 'meud-pa',
      price: 33.7,
      previousClose: 33.6,
      dayChangePct: 0.3,
      weekChangePct: 0.8,
      monthChangePct: 2.2,
      ytdChangePct: 4.6,
      history: [31.2, 31.6, 31.9, 32.1, 32.4, 32.6, 32.9, 33.2, 33.6, 33.7],
    }),
    quote({
      instrumentId: 'aeem-pa',
      price: 27.2,
      previousClose: 27.0,
      dayChangePct: 0.74,
      weekChangePct: 0.7,
      monthChangePct: 1.5,
      ytdChangePct: 3.1,
      history: [25.8, 26.0, 26.2, 26.3, 26.5, 26.6, 26.8, 26.9, 27.0, 27.2],
    }),
    quote({
      instrumentId: 'mjp-pa',
      price: 29.6,
      previousClose: 29.4,
      dayChangePct: 0.68,
      weekChangePct: 1.3,
      monthChangePct: 2.9,
      ytdChangePct: 5.3,
      history: [27.3, 27.7, 28.0, 28.2, 28.5, 28.8, 29.0, 29.2, 29.4, 29.6],
    }),
    quote({
      instrumentId: 'air-pa',
      price: 166.4,
      previousClose: 165.3,
      dayChangePct: 0.67,
      weekChangePct: 2.4,
      monthChangePct: 6.1,
      ytdChangePct: 9.7,
      history: [152, 154, 156, 158, 160, 161.5, 163.2, 164.8, 165.3, 166.4],
    }),
    quote({
      instrumentId: 'mc-pa',
      price: 742.5,
      previousClose: 748.2,
      dayChangePct: -0.76,
      weekChangePct: -0.3,
      monthChangePct: 1.2,
      ytdChangePct: 3.8,
      history: [720, 724, 728, 731, 735, 740, 744, 746, 748.2, 742.5],
    }),
    quote({
      instrumentId: 'ief-us',
      price: 93.2,
      previousClose: 93.7,
      dayChangePct: -0.53,
      weekChangePct: -0.8,
      monthChangePct: -1.9,
      ytdChangePct: -2.2,
      history: [95.6, 95.4, 95.2, 94.8, 94.4, 94.0, 93.8, 93.9, 93.7, 93.2],
    }),
    quote({
      instrumentId: 'gld-us',
      price: 219.6,
      previousClose: 218.1,
      dayChangePct: 0.69,
      weekChangePct: 1.9,
      monthChangePct: 4.8,
      ytdChangePct: 7.1,
      history: [206, 208, 209, 210.5, 212, 213.1, 214.9, 216.5, 218.1, 219.6],
    }),
    quote({
      instrumentId: 'eza-us',
      price: 44.1,
      previousClose: 43.6,
      dayChangePct: 1.15,
      weekChangePct: 2.2,
      monthChangePct: 4.2,
      ytdChangePct: 6.5,
      history: [40.2, 40.6, 41.0, 41.4, 41.8, 42.4, 42.8, 43.2, 43.6, 44.1],
    }),
  ]

  const response = buildMarketsOverviewResponse({
    requestId,
    generatedAt: FIXTURE_GENERATED_AT,
    quotes,
    panoramaIds: [...PANORAMA_MARKET_IDS],
    macroSeries: buildMacroSeriesSnapshots({
      definitions: macroObservations
        .map(([seriesId]) => getMarketMacroSeriesDefinition(seriesId))
        .filter((definition): definition is NonNullable<typeof definition> => definition !== null),
      observations: macroObservations.flatMap(([seriesId, rows]) =>
        rows.map(([observationDate, value]) => ({
          seriesId,
          observationDate,
          value,
        }))
      ),
    }),
    providerHealth,
    staleAfterMinutes: 16 * 60,
    lastSuccessAt: FIXTURE_LAST_SUCCESS_AT,
    source: 'demo_fixture',
  })
  response.watchlist = {
    items: quotes,
    groups: MARKET_WATCHLIST_GROUPS.map(group => ({
      id: group.id,
      label: group.label,
      itemIds: group.instrumentIds,
    })),
  }

  return response
}
