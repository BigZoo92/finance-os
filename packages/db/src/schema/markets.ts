import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export const marketQuoteSnapshot = pgTable(
  'market_quote_snapshot',
  {
    instrumentId: text('instrument_id').primaryKey(),
    label: text('label').notNull(),
    symbol: text('symbol').notNull(),
    providerSymbol: text('provider_symbol').notNull(),
    assetClass: text('asset_class').notNull(),
    region: text('region').notNull(),
    exchange: text('exchange').notNull(),
    currency: text('currency').notNull(),
    sourceProvider: text('source_provider').notNull(),
    baselineProvider: text('baseline_provider').notNull(),
    overlayProvider: text('overlay_provider'),
    sourceMode: text('source_mode').notNull(),
    sourceDelayLabel: text('source_delay_label').notNull(),
    sourceReason: text('source_reason').notNull(),
    quoteDate: text('quote_date').notNull(),
    quoteAsOf: timestamp('quote_as_of', { withTimezone: true }),
    capturedAt: timestamp('captured_at', { withTimezone: true }).notNull(),
    marketState: text('market_state').notNull().default('closed'),
    marketOpen: boolean('market_open'),
    isDelayed: boolean('is_delayed').notNull().default(true),
    freshnessMinutes: integer('freshness_minutes'),
    price: numeric('price', { precision: 18, scale: 6 }).notNull(),
    previousClose: numeric('previous_close', { precision: 18, scale: 6 }),
    dayChangePct: numeric('day_change_pct', { precision: 12, scale: 6 }),
    weekChangePct: numeric('week_change_pct', { precision: 12, scale: 6 }),
    monthChangePct: numeric('month_change_pct', { precision: 12, scale: 6 }),
    ytdChangePct: numeric('ytd_change_pct', { precision: 12, scale: 6 }),
    history: jsonb('history')
      .$type<Array<{ date: string; value: number; provider: string }>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('market_quote_snapshot_region_idx').on(table.region),
    index('market_quote_snapshot_source_provider_idx').on(table.sourceProvider),
    index('market_quote_snapshot_quote_as_of_idx').on(table.quoteAsOf),
  ]
)

export const marketMacroObservation = pgTable(
  'market_macro_observation',
  {
    seriesId: text('series_id').notNull(),
    observationDate: text('observation_date').notNull(),
    sourceProvider: text('source_provider').notNull().default('fred'),
    value: numeric('value', { precision: 18, scale: 6 }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    primaryKey({
      columns: [table.seriesId, table.observationDate],
      name: 'market_macro_observation_pk',
    }),
    index('market_macro_observation_series_id_idx').on(table.seriesId),
    index('market_macro_observation_observation_date_idx').on(table.observationDate),
  ]
)

export const marketCacheState = pgTable(
  'market_cache_state',
  {
    singleton: boolean('singleton').notNull().default(true),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastRequestId: text('last_request_id'),
    refreshCount: integer('refresh_count').notNull().default(0),
    providerFailureCount: integer('provider_failure_count').notNull().default(0),
    lastInstrumentCount: integer('last_instrument_count'),
    lastMacroObservationCount: integer('last_macro_observation_count'),
    lastSignalCount: integer('last_signal_count'),
    lastRefreshDurationMs: integer('last_refresh_duration_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.singleton], name: 'market_cache_state_singleton_pk' })]
)

export const marketProviderState = pgTable(
  'market_provider_state',
  {
    provider: text('provider').primaryKey(),
    enabled: boolean('enabled').notNull().default(true),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastRequestId: text('last_request_id'),
    lastFetchedCount: integer('last_fetched_count'),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    lastDurationMs: integer('last_duration_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [index('market_provider_state_last_attempt_at_idx').on(table.lastAttemptAt)]
)

export const marketContextBundleSnapshot = pgTable(
  'market_context_bundle_snapshot',
  {
    singleton: boolean('singleton').notNull().default(true),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    schemaVersion: text('schema_version').notNull(),
    bundle: jsonb('bundle').$type<Record<string, unknown>>().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    primaryKey({
      columns: [table.singleton],
      name: 'market_context_bundle_snapshot_singleton_pk',
    }),
  ]
)
