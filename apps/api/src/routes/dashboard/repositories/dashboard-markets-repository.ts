import { schema } from '@finance-os/db'
import { eq, notInArray, sql } from 'drizzle-orm'
import { safeNumber, toIsoOrNull, toProviderFreshnessLabel } from '../domain/market-helpers'
import { MARKET_PROVIDER_LABELS } from '../domain/market-definitions'
import type {
  DashboardMarketProviderHealth,
  MarketContextBundle,
  MarketMacroObservationPersistInput,
  MarketProviderRunResult,
  MarketQuotePersistInput,
} from '../domain/markets-types'
import type { ApiDb } from '../types'

export const createDashboardMarketsRepository = ({ db }: { db: ApiDb }) => {
  return {
    async listQuoteSnapshots() {
      return db
        .select({
          instrumentId: schema.marketQuoteSnapshot.instrumentId,
          label: schema.marketQuoteSnapshot.label,
          symbol: schema.marketQuoteSnapshot.symbol,
          providerSymbol: schema.marketQuoteSnapshot.providerSymbol,
          assetClass: schema.marketQuoteSnapshot.assetClass,
          region: schema.marketQuoteSnapshot.region,
          exchange: schema.marketQuoteSnapshot.exchange,
          currency: schema.marketQuoteSnapshot.currency,
          sourceProvider: schema.marketQuoteSnapshot.sourceProvider,
          baselineProvider: schema.marketQuoteSnapshot.baselineProvider,
          overlayProvider: schema.marketQuoteSnapshot.overlayProvider,
          sourceMode: schema.marketQuoteSnapshot.sourceMode,
          sourceDelayLabel: schema.marketQuoteSnapshot.sourceDelayLabel,
          sourceReason: schema.marketQuoteSnapshot.sourceReason,
          quoteDate: schema.marketQuoteSnapshot.quoteDate,
          quoteAsOf: schema.marketQuoteSnapshot.quoteAsOf,
          capturedAt: schema.marketQuoteSnapshot.capturedAt,
          marketState: schema.marketQuoteSnapshot.marketState,
          marketOpen: schema.marketQuoteSnapshot.marketOpen,
          isDelayed: schema.marketQuoteSnapshot.isDelayed,
          freshnessMinutes: schema.marketQuoteSnapshot.freshnessMinutes,
          price: schema.marketQuoteSnapshot.price,
          previousClose: schema.marketQuoteSnapshot.previousClose,
          dayChangePct: schema.marketQuoteSnapshot.dayChangePct,
          weekChangePct: schema.marketQuoteSnapshot.weekChangePct,
          monthChangePct: schema.marketQuoteSnapshot.monthChangePct,
          ytdChangePct: schema.marketQuoteSnapshot.ytdChangePct,
          history: schema.marketQuoteSnapshot.history,
        })
        .from(schema.marketQuoteSnapshot)
        .orderBy(schema.marketQuoteSnapshot.instrumentId)
        .then(rows =>
          rows.map(row => ({
            ...row,
            sourceProvider: row.sourceProvider as 'eodhd' | 'fred' | 'twelve_data',
            baselineProvider: row.baselineProvider as 'eodhd' | 'fred' | 'twelve_data',
            overlayProvider: row.overlayProvider as 'eodhd' | 'fred' | 'twelve_data' | null,
            sourceMode: row.sourceMode as 'eod' | 'delayed' | 'intraday',
            marketState: row.marketState as 'open' | 'closed',
            price: safeNumber(row.price) ?? 0,
            previousClose: safeNumber(row.previousClose),
            dayChangePct: safeNumber(row.dayChangePct),
            weekChangePct: safeNumber(row.weekChangePct),
            monthChangePct: safeNumber(row.monthChangePct),
            ytdChangePct: safeNumber(row.ytdChangePct),
            history: row.history ?? [],
          }))
        )
    },

    async syncQuoteSnapshots(quotes: MarketQuotePersistInput[]) {
      if (quotes.length === 0) {
        return
      }

      const instrumentIds = quotes.map(quote => quote.instrument.id)

      await db.transaction(async tx => {
        await tx
          .insert(schema.marketQuoteSnapshot)
          .values(
            quotes.map(quote => ({
              instrumentId: quote.instrument.id,
              label: quote.instrument.label,
              symbol: quote.instrument.symbol,
              providerSymbol: quote.instrument.eodhdSymbol,
              assetClass: quote.instrument.assetClass,
              region: quote.instrument.region,
              exchange: quote.instrument.exchange,
              currency: quote.instrument.currency,
              sourceProvider: quote.sourceProvider,
              baselineProvider: quote.baselineProvider,
              ...(quote.overlayProvider ? { overlayProvider: quote.overlayProvider } : {}),
              sourceMode: quote.sourceMode,
              sourceDelayLabel: quote.sourceDelayLabel,
              sourceReason: quote.sourceReason,
              quoteDate: quote.quoteDate,
              ...(quote.quoteAsOf ? { quoteAsOf: quote.quoteAsOf } : {}),
              capturedAt: quote.capturedAt,
              marketState: quote.marketState,
              marketOpen: quote.marketOpen,
              isDelayed: quote.isDelayed,
              ...(quote.freshnessMinutes !== null
                ? { freshnessMinutes: quote.freshnessMinutes }
                : {}),
              price: String(quote.price),
              ...(quote.previousClose !== null
                ? { previousClose: String(quote.previousClose) }
                : {}),
              ...(quote.dayChangePct !== null
                ? { dayChangePct: String(quote.dayChangePct) }
                : {}),
              ...(quote.weekChangePct !== null
                ? { weekChangePct: String(quote.weekChangePct) }
                : {}),
              ...(quote.monthChangePct !== null
                ? { monthChangePct: String(quote.monthChangePct) }
                : {}),
              ...(quote.ytdChangePct !== null
                ? { ytdChangePct: String(quote.ytdChangePct) }
                : {}),
              history: quote.history,
              ...(quote.metadata ? { metadata: quote.metadata } : {}),
            }))
          )
          .onConflictDoUpdate({
            target: schema.marketQuoteSnapshot.instrumentId,
            set: {
              label: sql`excluded.label`,
              symbol: sql`excluded.symbol`,
              providerSymbol: sql`excluded.provider_symbol`,
              assetClass: sql`excluded.asset_class`,
              region: sql`excluded.region`,
              exchange: sql`excluded.exchange`,
              currency: sql`excluded.currency`,
              sourceProvider: sql`excluded.source_provider`,
              baselineProvider: sql`excluded.baseline_provider`,
              overlayProvider: sql`excluded.overlay_provider`,
              sourceMode: sql`excluded.source_mode`,
              sourceDelayLabel: sql`excluded.source_delay_label`,
              sourceReason: sql`excluded.source_reason`,
              quoteDate: sql`excluded.quote_date`,
              quoteAsOf: sql`excluded.quote_as_of`,
              capturedAt: sql`excluded.captured_at`,
              marketState: sql`excluded.market_state`,
              marketOpen: sql`excluded.market_open`,
              isDelayed: sql`excluded.is_delayed`,
              freshnessMinutes: sql`excluded.freshness_minutes`,
              price: sql`excluded.price`,
              previousClose: sql`excluded.previous_close`,
              dayChangePct: sql`excluded.day_change_pct`,
              weekChangePct: sql`excluded.week_change_pct`,
              monthChangePct: sql`excluded.month_change_pct`,
              ytdChangePct: sql`excluded.ytd_change_pct`,
              history: sql`excluded.history`,
              metadata: sql`excluded.metadata`,
              updatedAt: new Date(),
            },
          })

        await tx
          .delete(schema.marketQuoteSnapshot)
          .where(notInArray(schema.marketQuoteSnapshot.instrumentId, instrumentIds))
      })
    },

    async listMacroObservations() {
      return db
        .select({
          seriesId: schema.marketMacroObservation.seriesId,
          observationDate: schema.marketMacroObservation.observationDate,
          value: schema.marketMacroObservation.value,
        })
        .from(schema.marketMacroObservation)
        .orderBy(schema.marketMacroObservation.seriesId, schema.marketMacroObservation.observationDate)
        .then(rows =>
          rows.map(row => ({
            ...row,
            value: safeNumber(row.value) ?? 0,
          }))
        )
    },

    async upsertMacroObservations(observations: MarketMacroObservationPersistInput[]) {
      if (observations.length === 0) {
        return
      }

      await db
        .insert(schema.marketMacroObservation)
        .values(
          observations.map(observation => ({
            seriesId: observation.series.id,
            observationDate: observation.observationDate,
            sourceProvider: 'fred',
            value: String(observation.value),
            ...(observation.metadata ? { metadata: observation.metadata } : {}),
          }))
        )
        .onConflictDoUpdate({
          target: [
            schema.marketMacroObservation.seriesId,
            schema.marketMacroObservation.observationDate,
          ],
          set: {
            sourceProvider: sql`excluded.source_provider`,
            value: sql`excluded.value`,
            metadata: sql`excluded.metadata`,
            updatedAt: new Date(),
          },
        })
    },

    async getMarketCacheState() {
      const [row] = await db
        .select({
          lastSuccessAt: schema.marketCacheState.lastSuccessAt,
          lastAttemptAt: schema.marketCacheState.lastAttemptAt,
          lastFailureAt: schema.marketCacheState.lastFailureAt,
          lastErrorCode: schema.marketCacheState.lastErrorCode,
          lastErrorMessage: schema.marketCacheState.lastErrorMessage,
          refreshCount: schema.marketCacheState.refreshCount,
          providerFailureCount: schema.marketCacheState.providerFailureCount,
          lastInstrumentCount: schema.marketCacheState.lastInstrumentCount,
          lastMacroObservationCount: schema.marketCacheState.lastMacroObservationCount,
          lastSignalCount: schema.marketCacheState.lastSignalCount,
          lastRefreshDurationMs: schema.marketCacheState.lastRefreshDurationMs,
        })
        .from(schema.marketCacheState)
        .where(eq(schema.marketCacheState.singleton, true))
        .limit(1)

      return row ?? null
    },

    async upsertMarketCacheState(input: {
      lastSuccessAt?: Date | null
      lastAttemptAt?: Date | null
      lastFailureAt?: Date | null
      lastErrorCode?: string | null
      lastErrorMessage?: string | null
      lastRequestId?: string | null
      refreshCountIncrement?: number
      providerFailureCountIncrement?: number
      lastInstrumentCount?: number | null
      lastMacroObservationCount?: number | null
      lastSignalCount?: number | null
      lastRefreshDurationMs?: number | null
    }) {
      await db
        .insert(schema.marketCacheState)
        .values({
          singleton: true,
          ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
          ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
          ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
          ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
          ...(input.lastErrorMessage !== undefined
            ? { lastErrorMessage: input.lastErrorMessage }
            : {}),
          ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
          ...(input.lastInstrumentCount !== undefined
            ? { lastInstrumentCount: input.lastInstrumentCount }
            : {}),
          ...(input.lastMacroObservationCount !== undefined
            ? { lastMacroObservationCount: input.lastMacroObservationCount }
            : {}),
          ...(input.lastSignalCount !== undefined ? { lastSignalCount: input.lastSignalCount } : {}),
          ...(input.lastRefreshDurationMs !== undefined
            ? { lastRefreshDurationMs: input.lastRefreshDurationMs }
            : {}),
          ...(input.refreshCountIncrement !== undefined
            ? { refreshCount: input.refreshCountIncrement }
            : {}),
          ...(input.providerFailureCountIncrement !== undefined
            ? { providerFailureCount: input.providerFailureCountIncrement }
            : {}),
        })
        .onConflictDoUpdate({
          target: schema.marketCacheState.singleton,
          set: {
            ...(input.lastSuccessAt !== undefined ? { lastSuccessAt: input.lastSuccessAt } : {}),
            ...(input.lastAttemptAt !== undefined ? { lastAttemptAt: input.lastAttemptAt } : {}),
            ...(input.lastFailureAt !== undefined ? { lastFailureAt: input.lastFailureAt } : {}),
            ...(input.lastErrorCode !== undefined ? { lastErrorCode: input.lastErrorCode } : {}),
            ...(input.lastErrorMessage !== undefined
              ? { lastErrorMessage: input.lastErrorMessage }
              : {}),
            ...(input.lastRequestId !== undefined ? { lastRequestId: input.lastRequestId } : {}),
            ...(input.lastInstrumentCount !== undefined
              ? { lastInstrumentCount: input.lastInstrumentCount }
              : {}),
            ...(input.lastMacroObservationCount !== undefined
              ? { lastMacroObservationCount: input.lastMacroObservationCount }
              : {}),
            ...(input.lastSignalCount !== undefined ? { lastSignalCount: input.lastSignalCount } : {}),
            ...(input.lastRefreshDurationMs !== undefined
              ? { lastRefreshDurationMs: input.lastRefreshDurationMs }
              : {}),
            ...(input.refreshCountIncrement !== undefined
              ? {
                  refreshCount: sql`${schema.marketCacheState.refreshCount} + ${input.refreshCountIncrement}`,
                }
              : {}),
            ...(input.providerFailureCountIncrement !== undefined
              ? {
                  providerFailureCount: sql`${schema.marketCacheState.providerFailureCount} + ${input.providerFailureCountIncrement}`,
                }
              : {}),
            updatedAt: new Date(),
          },
        })
    },

    async upsertMarketProviderState(input: MarketProviderRunResult & { enabled: boolean }) {
      await db
        .insert(schema.marketProviderState)
        .values({
          provider: input.provider,
          enabled: input.enabled,
          ...(input.status === 'success' ? { lastSuccessAt: new Date() } : {}),
          lastAttemptAt: new Date(),
          ...(input.status === 'failed' ? { lastFailureAt: new Date() } : {}),
          lastErrorCode: input.errorCode,
          lastErrorMessage: input.errorMessage,
          lastRequestId: input.requestId,
          lastFetchedCount: input.fetchedCount,
          successCount: input.status === 'success' ? 1 : 0,
          failureCount: input.status === 'failed' ? 1 : 0,
          skippedCount: input.status === 'skipped' ? 1 : 0,
          lastDurationMs: input.durationMs,
        })
        .onConflictDoUpdate({
          target: schema.marketProviderState.provider,
          set: {
            enabled: input.enabled,
            ...(input.status === 'success' ? { lastSuccessAt: new Date() } : {}),
            lastAttemptAt: new Date(),
            ...(input.status === 'failed' ? { lastFailureAt: new Date() } : {}),
            lastErrorCode: input.errorCode,
            lastErrorMessage: input.errorMessage,
            lastRequestId: input.requestId,
            lastFetchedCount: input.fetchedCount,
            successCount:
              input.status === 'success'
                ? sql`${schema.marketProviderState.successCount} + 1`
                : schema.marketProviderState.successCount,
            failureCount:
              input.status === 'failed'
                ? sql`${schema.marketProviderState.failureCount} + 1`
                : schema.marketProviderState.failureCount,
            skippedCount:
              input.status === 'skipped'
                ? sql`${schema.marketProviderState.skippedCount} + 1`
                : schema.marketProviderState.skippedCount,
            lastDurationMs: input.durationMs,
            updatedAt: new Date(),
          },
        })
    },

    async listMarketProviderHealth(): Promise<DashboardMarketProviderHealth[]> {
      const rows = await db
        .select({
          provider: schema.marketProviderState.provider,
          enabled: schema.marketProviderState.enabled,
          lastSuccessAt: schema.marketProviderState.lastSuccessAt,
          lastAttemptAt: schema.marketProviderState.lastAttemptAt,
          lastFailureAt: schema.marketProviderState.lastFailureAt,
          lastErrorCode: schema.marketProviderState.lastErrorCode,
          lastErrorMessage: schema.marketProviderState.lastErrorMessage,
          lastFetchedCount: schema.marketProviderState.lastFetchedCount,
          successCount: schema.marketProviderState.successCount,
          failureCount: schema.marketProviderState.failureCount,
          skippedCount: schema.marketProviderState.skippedCount,
        })
        .from(schema.marketProviderState)
        .orderBy(schema.marketProviderState.provider)

      return rows.map(row => {
        const provider = row.provider as DashboardMarketProviderHealth['provider']
        const status =
          row.failureCount > row.successCount && row.failureCount > 0
            ? 'failing'
            : row.lastFailureAt && (!row.lastSuccessAt || row.lastFailureAt > row.lastSuccessAt)
              ? 'degraded'
              : row.lastSuccessAt
                ? 'healthy'
                : 'idle'

        return {
          provider,
          label: MARKET_PROVIDER_LABELS[provider],
          role: provider === 'fred' ? 'macro' : provider === 'twelve_data' ? 'overlay' : 'prices',
          enabled: row.enabled,
          status,
          lastSuccessAt: toIsoOrNull(row.lastSuccessAt),
          lastAttemptAt: toIsoOrNull(row.lastAttemptAt),
          lastFailureAt: toIsoOrNull(row.lastFailureAt),
          lastErrorCode: row.lastErrorCode,
          lastErrorMessage: row.lastErrorMessage,
          lastFetchedCount: row.lastFetchedCount ?? 0,
          successCount: row.successCount,
          failureCount: row.failureCount,
          skippedCount: row.skippedCount,
          freshnessLabel: toProviderFreshnessLabel({
            provider,
            successAt: row.lastSuccessAt,
          }),
        }
      })
    },

    async saveContextBundle(input: {
      generatedAt: Date
      schemaVersion: string
      bundle: MarketContextBundle
    }) {
      await db
        .insert(schema.marketContextBundleSnapshot)
        .values({
          singleton: true,
          generatedAt: input.generatedAt,
          schemaVersion: input.schemaVersion,
          bundle: input.bundle as unknown as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: schema.marketContextBundleSnapshot.singleton,
          set: {
            generatedAt: input.generatedAt,
            schemaVersion: input.schemaVersion,
            bundle: input.bundle as unknown as Record<string, unknown>,
            updatedAt: new Date(),
          },
        })
    },

    async getContextBundle() {
      const [row] = await db
        .select({
          generatedAt: schema.marketContextBundleSnapshot.generatedAt,
          schemaVersion: schema.marketContextBundleSnapshot.schemaVersion,
          bundle: schema.marketContextBundleSnapshot.bundle,
        })
        .from(schema.marketContextBundleSnapshot)
        .where(eq(schema.marketContextBundleSnapshot.singleton, true))
        .limit(1)

      if (!row) {
        return null
      }

      return {
        generatedAt: row.generatedAt.toISOString(),
        schemaVersion: row.schemaVersion,
        bundle: row.bundle as unknown as MarketContextBundle,
      }
    },
  }
}
