import { clampHistory, computeChangePct, computeFreshnessMinutes, getMarketSessionState, safeNumber } from '../domain/market-helpers'
import {
  getMarketInstrumentDefinition,
  getMarketMacroSeriesDefinition,
  MARKET_PROVIDER_LABELS,
  type MarketInstrumentDefinition,
  type MarketMacroSeriesDefinition,
} from '../domain/market-definitions'
import type {
  MarketMacroObservationPersistInput,
  MarketProviderRunResult,
  MarketQuotePersistInput,
} from '../domain/markets-types'
import { fetchProviderJson, normalizeProviderError } from './market-provider-http'

type EodhdHistoryRow = {
  date: string
  close?: number
  adjusted_close?: number
}

type TwelveDataQuoteResponse = {
  symbol?: string
  name?: string
  close?: string
  previous_close?: string
  percent_change?: string
  datetime?: string
  timestamp?: number
  is_market_open?: boolean
  status?: string
  code?: number
  message?: string
}

type FredObservationsResponse = {
  observations?: Array<{
    date: string
    value: string
  }>
}

const HISTORY_LOOKBACK_DAYS = 390

const formatDateOnly = (value: Date) => value.toISOString().slice(0, 10)

const addDays = (value: Date, days: number) => {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

const resolveYtdAnchorValue = (history: Array<{ date: string; value: number }>) => {
  if (history.length === 0) {
    return null
  }

  const currentYear = history[history.length - 1]?.date.slice(0, 4)
  if (!currentYear) {
    return history[0]?.value ?? null
  }

  const yearStart = history.find(point => point.date.startsWith(currentYear))
  return yearStart?.value ?? history[0]?.value ?? null
}

const buildQuoteFromHistory = ({
  instrument,
  history,
  capturedAt,
  now,
}: {
  instrument: MarketInstrumentDefinition
  history: Array<{ date: string; value: number }>
  capturedAt: Date
  now: Date
}): MarketQuotePersistInput | null => {
  const lastPoint = history[history.length - 1]
  if (!lastPoint) {
    return null
  }

  const previousPoint = history[history.length - 2] ?? null
  const values = history.map(point => point.value)
  const session = getMarketSessionState({
    now,
    timeZone: instrument.sessionTimeZone,
    opensAt: instrument.sessionHours.opensAt,
    closesAt: instrument.sessionHours.closesAt,
  })
  const quoteAsOf = new Date(`${lastPoint.date}T00:00:00.000Z`)

  return {
    instrument,
    sourceProvider: 'eodhd',
    baselineProvider: 'eodhd',
    overlayProvider: null,
    sourceMode: 'eod',
    sourceDelayLabel: 'Clôture EOD',
    sourceReason: 'Source primaire globale EODHD (EOD / différée).',
    quoteDate: lastPoint.date,
    quoteAsOf,
    capturedAt,
    marketState: session.state,
    marketOpen: session.isOpen,
    isDelayed: true,
    freshnessMinutes: computeFreshnessMinutes({
      capturedAt,
      quoteAsOf,
    }),
    price: lastPoint.value,
    previousClose: previousPoint?.value ?? null,
    dayChangePct: computeChangePct(lastPoint.value, previousPoint?.value ?? null),
    weekChangePct: computeChangePct(lastPoint.value, values.length > 5 ? values[values.length - 6] ?? null : values[0] ?? null),
    monthChangePct: computeChangePct(lastPoint.value, values.length > 21 ? values[values.length - 22] ?? null : values[0] ?? null),
    ytdChangePct: computeChangePct(lastPoint.value, resolveYtdAnchorValue(history)),
    history: clampHistory(
      history.map(point => ({
        date: point.date,
        value: point.value,
        provider: 'eodhd',
      })),
      40
    ),
    metadata: {
      providerLabel: MARKET_PROVIDER_LABELS.eodhd,
      proxyLabel: instrument.proxyLabel,
    },
  }
}

const applyTwelveDataOverlay = ({
  baseline,
  instrument,
  quote,
  capturedAt,
  now,
}: {
  baseline: MarketQuotePersistInput
  instrument: MarketInstrumentDefinition
  quote: TwelveDataQuoteResponse
  capturedAt: Date
  now: Date
}): MarketQuotePersistInput | null => {
  const price = safeNumber(quote.close)
  if (price === null) {
    return null
  }

  const previousClose = safeNumber(quote.previous_close)
  const timestamp = quote.timestamp ? new Date(quote.timestamp * 1000) : null
  const quoteDate = timestamp ? formatDateOnly(timestamp) : formatDateOnly(now)
  const quoteAsOf = timestamp ?? now
  const history = [...baseline.history]
  const lastHistoryPoint = history[history.length - 1]
  if (!lastHistoryPoint || lastHistoryPoint.date !== quoteDate) {
    history.push({
      date: quoteDate,
      value: price,
      provider: 'twelve_data',
    })
  } else {
    history[history.length - 1] = {
      date: quoteDate,
      value: price,
      provider: 'twelve_data',
    }
  }

  const session = getMarketSessionState({
    now,
    timeZone: instrument.sessionTimeZone,
    opensAt: instrument.sessionHours.opensAt,
    closesAt: instrument.sessionHours.closesAt,
  })

  return {
    ...baseline,
    sourceProvider: 'twelve_data',
    overlayProvider: 'twelve_data',
    sourceMode: quote.is_market_open ? 'intraday' : 'delayed',
    sourceDelayLabel: quote.is_market_open
      ? 'Overlay US plus frais'
      : 'Overlay US différé',
    sourceReason:
      'Surcouche Twelve Data appliquée sur symbole US éligible pour fournir une lecture plus fraîche lorsque disponible.',
    quoteDate,
    quoteAsOf,
    capturedAt,
    marketState: session.state,
    marketOpen: session.isOpen,
    isDelayed: !quote.is_market_open,
    freshnessMinutes: computeFreshnessMinutes({
      capturedAt,
      quoteAsOf,
    }),
    price,
    previousClose,
    dayChangePct: safeNumber(quote.percent_change) ?? computeChangePct(price, previousClose),
    weekChangePct: baseline.weekChangePct,
    monthChangePct: baseline.monthChangePct,
    ytdChangePct: baseline.ytdChangePct,
    history: clampHistory(history, 40),
    metadata: {
      ...baseline.metadata,
      overlaySymbol: instrument.twelveDataSymbol ?? instrument.symbol,
    },
  }
}

const fetchEodhdHistory = async ({
  instrument,
  apiKey,
  requestId,
  fromDate,
  toDate,
}: {
  instrument: MarketInstrumentDefinition
  apiKey: string
  requestId: string
  fromDate: string
  toDate: string
}) => {
  const url = new URL(`https://eodhd.com/api/eod/${instrument.eodhdSymbol}`)
  url.searchParams.set('api_token', apiKey)
  url.searchParams.set('fmt', 'json')
  url.searchParams.set('from', fromDate)
  url.searchParams.set('to', toDate)

  const rows = await fetchProviderJson<EodhdHistoryRow[]>({
    url: url.toString(),
    requestId,
  })

  return rows
    .map(row => ({
      date: row.date,
      value: safeNumber(row.adjusted_close ?? row.close) ?? null,
    }))
    .filter((row): row is { date: string; value: number } => row.value !== null)
    .sort((left, right) => left.date.localeCompare(right.date))
}

const fetchTwelveDataQuote = async ({
  instrument,
  apiKey,
  requestId,
}: {
  instrument: MarketInstrumentDefinition
  apiKey: string
  requestId: string
}) => {
  const symbol = instrument.twelveDataSymbol
  if (!symbol) {
    return null
  }

  const url = new URL('https://api.twelvedata.com/quote')
  url.searchParams.set('symbol', symbol)
  url.searchParams.set('apikey', apiKey)

  const quote = await fetchProviderJson<TwelveDataQuoteResponse>({
    url: url.toString(),
    requestId,
  })

  if (quote.status === 'error' || quote.code) {
    throw Object.assign(new Error('TWELVE_DATA_ERROR'), {
      code: 'TWELVE_DATA_ERROR',
      safeMessage: quote.message ?? 'Twelve Data returned an error.',
    })
  }

  return quote
}

const fetchFredObservations = async ({
  series,
  apiKey,
  requestId,
}: {
  series: MarketMacroSeriesDefinition
  apiKey: string
  requestId: string
}) => {
  const url = new URL('https://api.stlouisfed.org/fred/series/observations')
  url.searchParams.set('series_id', series.id)
  url.searchParams.set('api_key', apiKey)
  url.searchParams.set('file_type', 'json')
  url.searchParams.set('sort_order', 'asc')
  url.searchParams.set('limit', '80')

  const response = await fetchProviderJson<FredObservationsResponse>({
    url: url.toString(),
    requestId,
  })

  return (response.observations ?? [])
    .map(observation => ({
      observationDate: observation.date,
      value: safeNumber(observation.value),
    }))
    .filter((observation): observation is { observationDate: string; value: number } => observation.value !== null)
}

export const createLiveMarketDataRefreshService = ({
  marketDataEodhdEnabled,
  marketDataTwelveDataEnabled,
  marketDataFredEnabled,
  marketDataUsFreshOverlayEnabled,
  eodhdApiKey,
  twelveDataApiKey,
  fredApiKey,
}: {
  marketDataEodhdEnabled: boolean
  marketDataTwelveDataEnabled: boolean
  marketDataFredEnabled: boolean
  marketDataUsFreshOverlayEnabled: boolean
  eodhdApiKey: string | undefined
  twelveDataApiKey: string | undefined
  fredApiKey: string | undefined
}) => {
  return {
    async run({
      watchlistIds,
      fredSeriesIds,
      requestId,
    }: {
      watchlistIds: string[]
      fredSeriesIds: string[]
      requestId: string
    }): Promise<LiveMarketRefreshSummary> {
      const now = new Date()
      const fromDate = formatDateOnly(addDays(now, -HISTORY_LOOKBACK_DAYS))
      const toDate = formatDateOnly(now)
      const instruments = watchlistIds
        .map(id => getMarketInstrumentDefinition(id))
        .filter((instrument): instrument is MarketInstrumentDefinition => instrument !== null)
      const macroSeries = fredSeriesIds
        .map(id => getMarketMacroSeriesDefinition(id))
        .filter((series): series is MarketMacroSeriesDefinition => series !== null)

      const providerResults: MarketProviderRunResult[] = []
      const quoteMap = new Map<string, MarketQuotePersistInput>()
      const macroObservations: MarketMacroObservationPersistInput[] = []

      const eodhdStartedAt = Date.now()
      if (!marketDataEodhdEnabled || !eodhdApiKey) {
        providerResults.push({
          provider: 'eodhd',
          status: 'skipped',
          requestId,
          fetchedCount: 0,
          durationMs: Date.now() - eodhdStartedAt,
          errorCode: !eodhdApiKey && marketDataEodhdEnabled ? 'API_KEY_MISSING' : null,
          errorMessage: !eodhdApiKey && marketDataEodhdEnabled ? 'EODHD_API_KEY manquant.' : null,
        })
      } else {
        const eodhdRuns = await Promise.allSettled(
          instruments.map(async instrument => {
            const history = await fetchEodhdHistory({
              instrument,
              apiKey: eodhdApiKey,
              requestId,
              fromDate,
              toDate,
            })

            const quote = buildQuoteFromHistory({
              instrument,
              history,
              capturedAt: now,
              now,
            })

            if (quote) {
              quoteMap.set(instrument.id, quote)
            }

            return quote
          })
        )

        const failed = eodhdRuns.filter(result => result.status === 'rejected')
        if (failed.length === eodhdRuns.length && eodhdRuns.length > 0) {
          const normalized = normalizeProviderError(failed[0]?.reason)
          providerResults.push({
            provider: 'eodhd',
            status: 'failed',
            requestId,
            fetchedCount: 0,
            durationMs: Date.now() - eodhdStartedAt,
            errorCode: normalized.code,
            errorMessage: normalized.message,
          })
        } else {
          providerResults.push({
            provider: 'eodhd',
            status: 'success',
            requestId,
            fetchedCount: quoteMap.size,
            durationMs: Date.now() - eodhdStartedAt,
            errorCode: failed.length > 0 ? 'PARTIAL_FETCH_FAILURE' : null,
            errorMessage:
              failed.length > 0 ? `${failed.length} instrument(s) non récupéré(s).` : null,
          })
        }
      }

      const twelveStartedAt = Date.now()
      if (!marketDataUsFreshOverlayEnabled || !marketDataTwelveDataEnabled || !twelveDataApiKey) {
        providerResults.push({
          provider: 'twelve_data',
          status: 'skipped',
          requestId,
          fetchedCount: 0,
          durationMs: Date.now() - twelveStartedAt,
          errorCode:
            !twelveDataApiKey && marketDataUsFreshOverlayEnabled && marketDataTwelveDataEnabled
              ? 'API_KEY_MISSING'
              : null,
          errorMessage:
            !twelveDataApiKey && marketDataUsFreshOverlayEnabled && marketDataTwelveDataEnabled
              ? 'TWELVEDATA_API_KEY manquant.'
              : null,
        })
      } else {
        const eligible = instruments.filter(instrument => instrument.twelveDataSymbol)
        const overlayRuns = await Promise.allSettled(
          eligible.map(async instrument => {
            const baseline = quoteMap.get(instrument.id)
            if (!baseline) {
              return null
            }

            const quote = await fetchTwelveDataQuote({
              instrument,
              apiKey: twelveDataApiKey,
              requestId,
            })
            if (!quote) {
              return null
            }

            const overlaid = applyTwelveDataOverlay({
              baseline,
              instrument,
              quote,
              capturedAt: now,
              now,
            })
            if (overlaid) {
              quoteMap.set(instrument.id, overlaid)
            }
            return overlaid
          })
        )
        const successes = overlayRuns.filter(
          result => result.status === 'fulfilled' && result.value !== null
        ).length
        const failures = overlayRuns.filter(result => result.status === 'rejected')
        providerResults.push({
          provider: 'twelve_data',
          status:
            failures.length === overlayRuns.length && overlayRuns.length > 0
              ? 'failed'
              : successes > 0
                ? 'success'
                : 'skipped',
          requestId,
          fetchedCount: successes,
          durationMs: Date.now() - twelveStartedAt,
          errorCode: failures.length > 0 ? 'PARTIAL_FETCH_FAILURE' : null,
          errorMessage:
            failures.length > 0 ? `${failures.length} overlay(s) US indisponible(s).` : null,
        })
      }

      const fredStartedAt = Date.now()
      if (!marketDataFredEnabled || !fredApiKey) {
        providerResults.push({
          provider: 'fred',
          status: 'skipped',
          requestId,
          fetchedCount: 0,
          durationMs: Date.now() - fredStartedAt,
          errorCode: !fredApiKey && marketDataFredEnabled ? 'API_KEY_MISSING' : null,
          errorMessage: !fredApiKey && marketDataFredEnabled ? 'FRED_API_KEY manquant.' : null,
        })
      } else {
        const fredRuns = await Promise.allSettled(
          macroSeries.map(async series => {
            const observations = await fetchFredObservations({
              series,
              apiKey: fredApiKey,
              requestId,
            })

            macroObservations.push(
              ...observations.map(observation => ({
                series,
                observationDate: observation.observationDate,
                value: observation.value,
                metadata: {
                  providerLabel: MARKET_PROVIDER_LABELS.fred,
                  transform: series.transform,
                },
              }))
            )
          })
        )

        const failures = fredRuns.filter(result => result.status === 'rejected')
        providerResults.push({
          provider: 'fred',
          status:
            failures.length === fredRuns.length && fredRuns.length > 0 ? 'failed' : 'success',
          requestId,
          fetchedCount: macroSeries.length,
          durationMs: Date.now() - fredStartedAt,
          errorCode: failures.length > 0 ? 'PARTIAL_FETCH_FAILURE' : null,
          errorMessage:
            failures.length > 0 ? `${failures.length} série(s) FRED indisponible(s).` : null,
        })
      }

      return {
        quotes: [...quoteMap.values()],
        macroObservations,
        providerResults,
      }
    },
  }
}

export interface LiveMarketRefreshSummary {
  quotes: MarketQuotePersistInput[]
  macroObservations: MarketMacroObservationPersistInput[]
  providerResults: MarketProviderRunResult[]
}
