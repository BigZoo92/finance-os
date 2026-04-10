import { logApiEvent, toErrorLogFields } from '../../../observability/logger'
import {
  DEFAULT_MARKET_MACRO_SERIES_IDS,
  DEFAULT_MARKET_WATCHLIST_IDS,
  getMarketInstrumentDefinition,
  getMarketMacroSeriesDefinition,
  MARKET_PROVIDER_LABELS,
  MARKET_WATCHLIST_GROUPS,
  PANORAMA_MARKET_IDS,
  type MarketProviderId,
} from './market-definitions'
import { buildMacroSeriesSnapshots, buildMarketContextBundle, buildMarketsOverviewResponse } from './market-analytics'
import { getMarketSessionState, toIsoOrNull } from './market-helpers'
import type {
  DashboardMarketProviderHealth,
  DashboardMarketQuote,
  DashboardMarketsContextBundleResponse,
  DashboardMarketsMacroResponse,
  DashboardMarketsOverviewResponse,
  DashboardMarketsWatchlistResponse,
} from './markets-types'
import type { LiveMarketRefreshSummary } from '../services/fetch-live-market-data'
import type { DashboardMarketsRepository, DashboardMarketsUseCases } from '../types'

const buildProviderHealthFallback = ({
  enabledMap,
}: {
  enabledMap: Record<MarketProviderId, boolean>
}): DashboardMarketProviderHealth[] => {
  return (['eodhd', 'twelve_data', 'fred'] as const).map(provider => ({
    provider,
    label: MARKET_PROVIDER_LABELS[provider],
    role: provider === 'fred' ? 'macro' : provider === 'twelve_data' ? 'overlay' : 'prices',
    enabled: enabledMap[provider],
    status: 'idle',
    lastSuccessAt: null,
    lastAttemptAt: null,
    lastFailureAt: null,
    lastErrorCode: null,
    lastErrorMessage: null,
    lastFetchedCount: 0,
    successCount: 0,
    failureCount: 0,
    skippedCount: 0,
    freshnessLabel: `${MARKET_PROVIDER_LABELS[provider]}: jamais rafraîchi`,
  }))
}

const hydrateQuotes = ({
  rows,
  now,
}: {
  rows: Awaited<ReturnType<DashboardMarketsRepository['listQuoteSnapshots']>>
  now: Date
}): DashboardMarketQuote[] => {
  return rows
    .map(row => {
      const definition = getMarketInstrumentDefinition(row.instrumentId)
      if (!definition) {
        return null
      }

      const session = getMarketSessionState({
        now,
        timeZone: definition.sessionTimeZone,
        opensAt: definition.sessionHours.opensAt,
        closesAt: definition.sessionHours.closesAt,
      })

      return {
        instrumentId: row.instrumentId,
        label: definition.label,
        shortLabel: definition.shortLabel,
        symbol: definition.symbol,
        assetClass: definition.assetClass,
        region: definition.region,
        exchange: definition.exchange,
        currency: definition.currency,
        proxyLabel: definition.proxyLabel,
        tags: definition.tags,
        price: row.price,
        previousClose: row.previousClose,
        dayChangePct: row.dayChangePct,
        weekChangePct: row.weekChangePct,
        monthChangePct: row.monthChangePct,
        ytdChangePct: row.ytdChangePct,
        history: row.history,
        source: {
          provider: row.sourceProvider,
          baselineProvider: row.baselineProvider,
          overlayProvider: row.overlayProvider,
          mode: row.sourceMode,
          delayLabel: row.sourceDelayLabel,
          reason: row.sourceReason,
          quoteDate: row.quoteDate,
          quoteAsOf: toIsoOrNull(row.quoteAsOf),
          capturedAt: row.capturedAt.toISOString(),
          freshnessMinutes: row.freshnessMinutes,
          isDelayed: row.isDelayed,
        },
        marketSession: {
          state: session.state,
          isOpen: session.isOpen,
          label: session.label,
        },
      }
    })
    .filter((quote): quote is DashboardMarketQuote => quote !== null)
}

const buildOverview = async ({
  repository,
  requestId,
  staleAfterMinutes,
  providerEnabledMap,
}: {
  repository: DashboardMarketsRepository
  requestId: string
  staleAfterMinutes: number
  providerEnabledMap: Record<MarketProviderId, boolean>
}): Promise<DashboardMarketsOverviewResponse> => {
  const [quoteRows, macroObservations, cacheState, providerRows] = await Promise.all([
    repository.listQuoteSnapshots(),
    repository.listMacroObservations(),
    repository.getMarketCacheState(),
    repository.listMarketProviderHealth(),
  ])

  const quotes = hydrateQuotes({
    rows: quoteRows,
    now: new Date(),
  })

  if (quotes.length === 0) {
    throw new Error('MARKET_CACHE_EMPTY')
  }

  const macroSeries = buildMacroSeriesSnapshots({
    definitions: DEFAULT_MARKET_MACRO_SERIES_IDS
      .map(seriesId => getMarketMacroSeriesDefinition(seriesId))
      .filter((definition): definition is NonNullable<typeof definition> => definition !== null),
    observations: macroObservations,
  })

  const providerHealth =
    providerRows.length > 0 ? providerRows : buildProviderHealthFallback({ enabledMap: providerEnabledMap })

  const overview = buildMarketsOverviewResponse({
    requestId,
    generatedAt: new Date().toISOString(),
    quotes,
    panoramaIds: [...PANORAMA_MARKET_IDS],
    macroSeries,
    providerHealth,
    staleAfterMinutes,
    lastSuccessAt: cacheState?.lastSuccessAt?.toISOString() ?? null,
    source: 'cache',
  })

  overview.watchlist = {
    items: quotes,
    groups: MARKET_WATCHLIST_GROUPS.map(group => ({
      id: group.id,
      label: group.label,
      itemIds: group.instrumentIds,
    })),
  }

  overview.dataset = {
    version: 'markets-cache:2026-04-10',
    source: 'admin_live',
    mode: 'admin',
    isDemoData: false,
  }

  return overview
}

export const createDashboardMarketsUseCases = ({
  repository,
  runLiveRefresh,
  marketDataEnabled,
  marketDataRefreshEnabled,
  staleAfterMinutes,
  defaultWatchlistIds,
  fredSeriesIds,
  providerEnabledMap,
}: {
  repository: DashboardMarketsRepository
  runLiveRefresh: (input: {
    watchlistIds: string[]
    fredSeriesIds: string[]
    requestId: string
  }) => Promise<LiveMarketRefreshSummary>
  marketDataEnabled: boolean
  marketDataRefreshEnabled: boolean
  staleAfterMinutes: number
  defaultWatchlistIds: string[]
  fredSeriesIds: string[]
  providerEnabledMap: Record<MarketProviderId, boolean>
}): DashboardMarketsUseCases => ({
  getOverview: async ({ requestId }) => {
    return buildOverview({
      repository,
      requestId,
      staleAfterMinutes,
      providerEnabledMap,
    })
  },

  getWatchlist: async ({ requestId }) => {
    const overview = await buildOverview({
      repository,
      requestId,
      staleAfterMinutes,
      providerEnabledMap,
    })

    return {
      requestId,
      generatedAt: overview.generatedAt,
      freshness: overview.freshness,
      items: overview.watchlist.items,
      groups: overview.watchlist.groups,
      providers: overview.providers,
    } satisfies DashboardMarketsWatchlistResponse
  },

  getMacro: async ({ requestId }) => {
    const overview = await buildOverview({
      repository,
      requestId,
      staleAfterMinutes,
      providerEnabledMap,
    })

    return {
      requestId,
      generatedAt: overview.generatedAt,
      freshness: overview.freshness,
      items: overview.macro.items,
      providers: overview.providers,
    } satisfies DashboardMarketsMacroResponse
  },

  getContextBundle: async ({ requestId }) => {
    const [overview, savedBundle] = await Promise.all([
      buildOverview({
        repository,
        requestId,
        staleAfterMinutes,
        providerEnabledMap,
      }),
      repository.getContextBundle(),
    ])

    return {
      requestId,
      generatedAt: savedBundle?.generatedAt ?? overview.generatedAt,
      freshness: overview.freshness,
      bundle: savedBundle?.bundle ?? overview.contextBundle,
    } satisfies DashboardMarketsContextBundleResponse
  },

  refreshMarkets: async ({ requestId }) => {
    const startedAt = Date.now()

    if (!marketDataEnabled) {
      await repository.upsertMarketCacheState({
        lastAttemptAt: new Date(),
        lastErrorCode: 'FEATURE_DISABLED',
        lastErrorMessage: 'Market data feature is disabled.',
        lastRequestId: requestId,
      })
      throw Object.assign(new Error('FEATURE_DISABLED'), { code: 'FEATURE_DISABLED' })
    }

    if (!marketDataRefreshEnabled) {
      await repository.upsertMarketCacheState({
        lastAttemptAt: new Date(),
        lastErrorCode: 'REFRESH_DISABLED',
        lastErrorMessage: 'Market refresh is disabled.',
        lastRequestId: requestId,
      })
      throw Object.assign(new Error('REFRESH_DISABLED'), { code: 'REFRESH_DISABLED' })
    }

    try {
      const result = await runLiveRefresh({
        watchlistIds: defaultWatchlistIds.length > 0 ? defaultWatchlistIds : DEFAULT_MARKET_WATCHLIST_IDS,
        fredSeriesIds: fredSeriesIds.length > 0 ? fredSeriesIds : DEFAULT_MARKET_MACRO_SERIES_IDS,
        requestId,
      })

      if (result.quotes.length === 0) {
        throw Object.assign(new Error('MARKET_PROVIDER_UNAVAILABLE'), {
          code: 'MARKET_PROVIDER_UNAVAILABLE',
        })
      }

      await Promise.all([
        repository.syncQuoteSnapshots(result.quotes),
        repository.upsertMacroObservations(result.macroObservations),
        ...result.providerResults.map(providerResult =>
          repository.upsertMarketProviderState({
            ...providerResult,
            enabled: providerEnabledMap[providerResult.provider],
          })
        ),
      ])

      const providerHealth = await repository.listMarketProviderHealth()
      const macroObservations = await repository.listMacroObservations()
      const overview = await buildOverview({
        repository,
        requestId,
        staleAfterMinutes,
        providerEnabledMap,
      })
      const bundle = buildMarketContextBundle({
        generatedAt: overview.generatedAt,
        quotes: overview.watchlist.items,
        macroSeries: buildMacroSeriesSnapshots({
          definitions: DEFAULT_MARKET_MACRO_SERIES_IDS
            .map(seriesId => getMarketMacroSeriesDefinition(seriesId))
            .filter((definition): definition is NonNullable<typeof definition> => definition !== null),
          observations: macroObservations,
        }),
        signals: overview.signals.items,
        providers: providerHealth.length > 0 ? providerHealth : buildProviderHealthFallback({ enabledMap: providerEnabledMap }),
        staleAfterMinutes,
      })

      await Promise.all([
        repository.saveContextBundle({
          generatedAt: new Date(overview.generatedAt),
          schemaVersion: bundle.schemaVersion,
          bundle,
        }),
        repository.upsertMarketCacheState({
          lastAttemptAt: new Date(),
          lastSuccessAt: new Date(),
          lastErrorCode:
            result.providerResults.some(provider => provider.status === 'failed')
              ? 'PARTIAL_PROVIDER_FAILURE'
              : null,
          lastErrorMessage:
            result.providerResults.some(provider => provider.status === 'failed')
              ? 'Au moins un provider marchés a échoué. Les snapshots restent utilisables.'
              : null,
          lastRequestId: requestId,
          refreshCountIncrement: 1,
          providerFailureCountIncrement: result.providerResults.filter(
            provider => provider.status === 'failed'
          ).length,
          lastInstrumentCount: overview.watchlist.items.length,
          lastMacroObservationCount: result.macroObservations.length,
          lastSignalCount: overview.signals.items.length,
          lastRefreshDurationMs: Date.now() - startedAt,
        }),
      ])

      logApiEvent({
        level: result.providerResults.some(provider => provider.status === 'failed') ? 'warn' : 'info',
        msg: 'dashboard markets refreshed',
        requestId,
        market_quote_count: overview.watchlist.items.length,
        market_macro_observation_count: result.macroObservations.length,
        market_signal_count: overview.signals.items.length,
        market_provider_failure_count: result.providerResults.filter(
          provider => provider.status === 'failed'
        ).length,
        market_refresh_duration_ms: Date.now() - startedAt,
      })

      return {
        requestId,
        refreshedAt: overview.generatedAt,
        quoteCount: overview.watchlist.items.length,
        macroObservationCount: result.macroObservations.length,
        signalCount: overview.signals.items.length,
        providerResults: result.providerResults,
      }
    } catch (error) {
      await repository.upsertMarketCacheState({
        lastAttemptAt: new Date(),
        lastFailureAt: new Date(),
        lastErrorCode: error instanceof Error ? error.message.slice(0, 80) : 'MARKET_REFRESH_FAILED',
        lastErrorMessage: 'Market refresh failed. Cached data remains available when present.',
        lastRequestId: requestId,
        refreshCountIncrement: 1,
        providerFailureCountIncrement: 1,
        lastRefreshDurationMs: Date.now() - startedAt,
      })

      logApiEvent({
        level: 'warn',
        msg: 'dashboard markets refresh failed',
        requestId,
        market_refresh_duration_ms: Date.now() - startedAt,
        ...toErrorLogFields({
          error,
          includeStack: false,
        }),
      })

      throw error
    }
  },
})
