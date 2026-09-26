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
  uniqueIndex,
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

export type AssetValuationStatus =
  | 'priced'
  | 'derived'
  | 'estimated'
  | 'manual'
  | 'stale'
  | 'unresolved'
  | 'unavailable'

export const assetValuationSnapshot = pgTable(
  'asset_valuation_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    accountId: text('account_id'),
    assetId: text('asset_id'),
    instrumentId: text('instrument_id'),
    quantity: numeric('quantity', { precision: 28, scale: 10 }).notNull(),
    // DATA-01: an unknown price or value is stored as NULL, never as 0; `status`
    // (unresolved/unavailable) and `error_code` explain why.
    price: numeric('price', { precision: 24, scale: 10 }),
    priceCurrency: text('price_currency').notNull(),
    baseCurrency: text('base_currency').notNull(),
    fxRate: numeric('fx_rate', { precision: 24, scale: 12 }),
    fxRateSource: text('fx_rate_source'),
    fxRateTimestamp: timestamp('fx_rate_timestamp', { withTimezone: true }),
    valueBase: numeric('value_base', { precision: 28, scale: 10 }),
    priceSnapshotId: integer('price_snapshot_id').references(() => assetPriceSnapshot.id, {
      onDelete: 'set null',
    }),
    valuationTimestamp: timestamp('valuation_timestamp', { withTimezone: true }).notNull(),
    confidence: doublePrecision('confidence').notNull().default(0),
    staleReason: text('stale_reason'),
    // Financial Data Core additions (0037): canonical status/provenance per snapshot.
    runId: integer('run_id'),
    itemKey: text('item_key'),
    kind: text('kind').$type<'cash' | 'investment' | 'manual' | 'position'>(),
    status: text('status').$type<AssetValuationStatus>(),
    valuationSource: text('valuation_source'),
    provider: text('provider'),
    valueOriginal: numeric('value_original', { precision: 28, scale: 10 }),
    costBasisBase: numeric('cost_basis_base', { precision: 28, scale: 10 }),
    unrealizedPnlBase: numeric('unrealized_pnl_base', { precision: 28, scale: 10 }),
    unrealizedPnlPct: numeric('unrealized_pnl_pct', { precision: 12, scale: 6 }),
    asOf: timestamp('as_of', { withTimezone: true }),
    errorCode: text('error_code'),
    safeErrorMessage: text('safe_error_message'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('asset_valuation_snapshot_account_idx').on(table.accountId),
    index('asset_valuation_snapshot_instrument_idx').on(table.instrumentId),
    index('asset_valuation_snapshot_price_snapshot_idx').on(table.priceSnapshotId),
    index('asset_valuation_snapshot_created_at_idx').on(table.createdAt),
    index('asset_valuation_snapshot_run_idx').on(table.runId),
    uniqueIndex('asset_valuation_snapshot_run_item_unique')
      .on(table.runId, table.itemKey)
      .where(sql`${table.runId} is not null and ${table.itemKey} is not null`),
  ]
)

export const assetValuationRun = pgTable(
  'asset_valuation_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    status: text('status').notNull().$type<'running' | 'completed' | 'failed'>(),
    triggerSource: text('trigger_source').notNull().$type<'admin' | 'internal'>(),
    requestId: text('request_id').notNull(),
    dryRun: boolean('dry_run').notNull().default(false),
    coverage: jsonb('coverage').$type<Record<string, unknown> | null>(),
    totals: jsonb('totals').$type<Record<string, unknown> | null>(),
    itemCount: integer('item_count'),
    snapshotCount: integer('snapshot_count'),
    providerFailures: jsonb('provider_failures').$type<Array<Record<string, unknown>> | null>(),
    safeErrorCode: text('safe_error_code'),
    safeErrorMessage: text('safe_error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('asset_valuation_run_started_at_idx').on(table.startedAt),
    index('asset_valuation_run_status_idx').on(table.status),
    // Concurrency guard: at most one running row. Session-scoped advisory
    // locks are unreliable behind the pooled postgres-js client.
    uniqueIndex('asset_valuation_run_single_running')
      .on(table.status)
      .where(sql`${table.status} = 'running'`),
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
    // 0037: idempotent FX ingestion — one row per (pair, provider, rate timestamp).
    uniqueIndex('fx_rate_snapshot_pair_provider_ts_unique').on(
      table.baseCurrency,
      table.quoteCurrency,
      table.provider,
      table.rateTimestamp
    ),
  ]
)
