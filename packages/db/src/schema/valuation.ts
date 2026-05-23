import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export type AssetClass = 'stock' | 'etf' | 'crypto' | 'cash' | 'fund' | 'other'
export type PriceSourceType =
  | 'realtime'
  | 'delayed'
  | 'eod'
  | 'broker'
  | 'exchange'
  | 'computed'
  | 'fallback'

export const assetPriceSnapshot = pgTable(
  'asset_price_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    assetId: text('asset_id'),
    instrumentId: text('instrument_id'),
    symbol: text('symbol').notNull(),
    isin: text('isin'),
    figi: text('figi'),
    conid: text('conid'),
    exchange: text('exchange'),
    mic: text('mic'),
    assetClass: text('asset_class').notNull().$type<AssetClass>(),
    provider: text('provider').notNull(),
    providerPriority: integer('provider_priority').notNull().default(100),
    sourceType: text('source_type').notNull().$type<PriceSourceType>(),
    price: numeric('price', { precision: 24, scale: 10 }).notNull(),
    currency: text('currency').notNull(),
    bid: numeric('bid', { precision: 24, scale: 10 }),
    ask: numeric('ask', { precision: 24, scale: 10 }),
    last: numeric('last', { precision: 24, scale: 10 }),
    close: numeric('close', { precision: 24, scale: 10 }),
    previousClose: numeric('previous_close', { precision: 24, scale: 10 }),
    volume: numeric('volume', { precision: 28, scale: 6 }),
    marketTimestamp: timestamp('market_timestamp', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    delaySeconds: integer('delay_seconds').notNull().default(0),
    staleAfterSeconds: integer('stale_after_seconds').notNull(),
    isStale: boolean('is_stale').notNull().default(false),
    staleReason: text('stale_reason'),
    isMarketOpen: boolean('is_market_open'),
    confidence: doublePrecision('confidence').notNull().default(0),
    rawPayloadHash: text('raw_payload_hash'),
    rawPayloadRedacted: jsonb('raw_payload_redacted').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('asset_price_snapshot_symbol_idx').on(table.symbol),
    index('asset_price_snapshot_instrument_idx').on(table.instrumentId),
    index('asset_price_snapshot_provider_idx').on(table.provider),
    index('asset_price_snapshot_market_ts_idx').on(table.marketTimestamp),
    index('asset_price_snapshot_created_at_idx').on(table.createdAt),
  ]
)

export const assetValuationSnapshot = pgTable(
  'asset_valuation_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    accountId: text('account_id'),
    assetId: text('asset_id'),
    instrumentId: text('instrument_id'),
    quantity: numeric('quantity', { precision: 28, scale: 10 }).notNull(),
    price: numeric('price', { precision: 24, scale: 10 }).notNull(),
    priceCurrency: text('price_currency').notNull(),
    baseCurrency: text('base_currency').notNull(),
    fxRate: numeric('fx_rate', { precision: 24, scale: 12 }),
    fxRateSource: text('fx_rate_source'),
    fxRateTimestamp: timestamp('fx_rate_timestamp', { withTimezone: true }),
    valueBase: numeric('value_base', { precision: 28, scale: 10 }).notNull(),
    priceSnapshotId: integer('price_snapshot_id').references(() => assetPriceSnapshot.id, {
      onDelete: 'set null',
    }),
    valuationTimestamp: timestamp('valuation_timestamp', { withTimezone: true }).notNull(),
    confidence: doublePrecision('confidence').notNull().default(0),
    staleReason: text('stale_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('asset_valuation_snapshot_account_idx').on(table.accountId),
    index('asset_valuation_snapshot_instrument_idx').on(table.instrumentId),
    index('asset_valuation_snapshot_price_snapshot_idx').on(table.priceSnapshotId),
    index('asset_valuation_snapshot_created_at_idx').on(table.createdAt),
  ]
)

export const providerHealthSnapshot = pgTable(
  'provider_health_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    assetClass: text('asset_class').notNull().$type<AssetClass | 'all'>(),
    status: text('status').notNull().$type<'ok' | 'degraded' | 'down' | 'stale' | 'rate_limited'>(),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    rateLimitRemaining: integer('rate_limit_remaining'),
    errorCode: text('error_code'),
    details: jsonb('details').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('provider_health_snapshot_provider_idx').on(table.provider),
    index('provider_health_snapshot_status_idx').on(table.status),
    index('provider_health_snapshot_created_at_idx').on(table.createdAt),
  ]
)

export const fxRateSnapshot = pgTable(
  'fx_rate_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    baseCurrency: text('base_currency').notNull(),
    quoteCurrency: text('quote_currency').notNull(),
    provider: text('provider').notNull(),
    sourceType: text('source_type')
      .notNull()
      .$type<'daily' | 'intraday' | 'computed' | 'fallback'>(),
    rate: numeric('rate', { precision: 24, scale: 12 }).notNull(),
    rateTimestamp: timestamp('rate_timestamp', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    staleAfterSeconds: integer('stale_after_seconds')
      .notNull()
      .default(36 * 60 * 60),
    isStale: boolean('is_stale').notNull().default(false),
    confidence: doublePrecision('confidence').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>().default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('fx_rate_snapshot_pair_idx').on(table.baseCurrency, table.quoteCurrency),
    index('fx_rate_snapshot_provider_idx').on(table.provider),
    index('fx_rate_snapshot_rate_ts_idx').on(table.rateTimestamp),
  ]
)
