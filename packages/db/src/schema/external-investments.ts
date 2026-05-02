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
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const externalInvestmentConnection = pgTable(
  'external_investment_connection',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountAlias: text('account_alias'),
    enabled: boolean('enabled').notNull().default(true),
    status: text('status').notNull().default('configured'),
    credentialStatus: text('credential_status').notNull().default('missing'),
    maskedMetadata: jsonb('masked_metadata').$type<Record<string, unknown> | null>(),
    lastSyncStatus: text('last_sync_status'),
    lastSyncReasonCode: text('last_sync_reason_code'),
    lastSyncAttemptAt: timestamp('last_sync_attempt_at', { withTimezone: true }),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastFailedAt: timestamp('last_failed_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    syncMetadata: jsonb('sync_metadata').$type<Record<string, unknown> | null>(),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    archivedReason: text('archived_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_connection_provider_unique').on(
      table.provider,
      table.providerConnectionId
    ),
    index('external_investment_connection_provider_idx').on(table.provider),
    index('external_investment_connection_status_idx').on(table.status),
    index('external_investment_connection_last_sync_idx').on(table.lastSyncAt),
  ]
)

export const externalInvestmentCredential = pgTable(
  'external_investment_credential',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    kind: text('kind').notNull(),
    encryptedPayload: text('encrypted_payload').notNull(),
    maskedMetadata: jsonb('masked_metadata').$type<Record<string, unknown>>().notNull(),
    version: text('version').notNull().default('v1'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_credential_active_unique')
      .on(table.connectionId, table.provider, table.kind)
      .where(sql`${table.deletedAt} is null`),
    index('external_investment_credential_provider_idx').on(table.provider),
  ]
)

export const externalInvestmentSyncRun = pgTable(
  'external_investment_sync_run',
  {
    id: text('id').primaryKey(),
    requestId: text('request_id'),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id').references(() => externalInvestmentConnection.id, {
      onDelete: 'set null',
    }),
    providerConnectionId: text('provider_connection_id'),
    triggerSource: text('trigger_source').notNull().default('manual'),
    status: text('status').notNull().default('running'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    rowCounts: jsonb('row_counts').$type<Record<string, number> | null>(),
    degradedReasons: jsonb('degraded_reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('external_investment_sync_run_provider_started_idx').on(table.provider, table.startedAt),
    index('external_investment_sync_run_status_idx').on(table.status),
    index('external_investment_sync_run_request_id_idx').on(table.requestId),
  ]
)

export const externalInvestmentProviderHealth = pgTable(
  'external_investment_provider_health',
  {
    provider: text('provider').primaryKey(),
    enabled: boolean('enabled').notNull().default(true),
    status: text('status').notNull().default('idle'),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastRequestId: text('last_request_id'),
    lastDurationMs: integer('last_duration_ms'),
    lastRawImportCount: integer('last_raw_import_count'),
    lastNormalizedRowCount: integer('last_normalized_row_count'),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [index('external_investment_provider_health_attempt_idx').on(table.lastAttemptAt)]
)

export const externalInvestmentRawImport = pgTable(
  'external_investment_raw_import',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id').references(() => externalInvestmentConnection.id, {
      onDelete: 'set null',
    }),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountExternalId: text('account_external_id'),
    objectType: text('object_type').notNull(),
    externalObjectId: text('external_object_id').notNull(),
    parentExternalObjectId: text('parent_external_object_id'),
    importStatus: text('import_status').notNull().default('metadata_only'),
    providerObjectAt: timestamp('provider_object_at', { withTimezone: true }),
    importedAt: timestamp('imported_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    requestId: text('request_id'),
    payloadDigest: text('payload_digest').notNull(),
    payloadBytes: integer('payload_bytes').notNull().default(0),
    payloadPreview: jsonb('payload_preview').$type<Record<string, unknown> | null>(),
    rawStoragePolicy: text('raw_storage_policy').notNull().default('metadata_digest_preview'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_raw_import_object_unique').on(
      table.provider,
      table.providerConnectionId,
      table.objectType,
      table.externalObjectId
    ),
    index('external_investment_raw_import_provider_idx').on(table.provider),
    index('external_investment_raw_import_last_seen_idx').on(table.lastSeenAt),
  ]
)

export const externalInvestmentAccount = pgTable(
  'external_investment_account',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountExternalId: text('account_external_id').notNull(),
    accountType: text('account_type'),
    accountAlias: text('account_alias'),
    baseCurrency: text('base_currency'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    degradedReasons: jsonb('degraded_reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sourceConfidence: text('source_confidence').notNull().default('unknown'),
    rawImportId: integer('raw_import_id').references(() => externalInvestmentRawImport.id, {
      onDelete: 'set null',
    }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_account_external_unique').on(
      table.provider,
      table.providerConnectionId,
      table.accountExternalId
    ),
    index('external_investment_account_connection_idx').on(table.connectionId),
  ]
)

export const externalInvestmentInstrument = pgTable(
  'external_investment_instrument',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    providerConnectionId: text('provider_connection_id').notNull(),
    instrumentKey: text('instrument_key').notNull(),
    symbol: text('symbol'),
    name: text('name').notNull(),
    currency: text('currency'),
    assetClass: text('asset_class').notNull().default('unknown'),
    isin: text('isin'),
    cusip: text('cusip'),
    conid: text('conid'),
    binanceAsset: text('binance_asset'),
    binanceSymbol: text('binance_symbol'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    sourceConfidence: text('source_confidence').notNull().default('unknown'),
    rawImportId: integer('raw_import_id').references(() => externalInvestmentRawImport.id, {
      onDelete: 'set null',
    }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_instrument_key_unique').on(
      table.provider,
      table.providerConnectionId,
      table.instrumentKey
    ),
    index('external_investment_instrument_symbol_idx').on(table.symbol),
    index('external_investment_instrument_asset_class_idx').on(table.assetClass),
  ]
)

export const externalInvestmentPosition = pgTable(
  'external_investment_position',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountExternalId: text('account_external_id').notNull(),
    instrumentKey: text('instrument_key').notNull(),
    positionKey: text('position_key').notNull(),
    providerPositionId: text('provider_position_id').notNull(),
    name: text('name').notNull(),
    symbol: text('symbol'),
    assetClass: text('asset_class').notNull().default('unknown'),
    quantity: numeric('quantity', { precision: 30, scale: 12 }),
    freeQuantity: numeric('free_quantity', { precision: 30, scale: 12 }),
    lockedQuantity: numeric('locked_quantity', { precision: 30, scale: 12 }),
    currency: text('currency'),
    providerValue: numeric('provider_value', { precision: 24, scale: 6 }),
    normalizedValue: numeric('normalized_value', { precision: 24, scale: 6 }),
    valueCurrency: text('value_currency'),
    valueSource: text('value_source').notNull().default('unknown'),
    valueAsOf: timestamp('value_as_of', { withTimezone: true }),
    costBasis: numeric('cost_basis', { precision: 24, scale: 6 }),
    costBasisCurrency: text('cost_basis_currency'),
    realizedPnl: numeric('realized_pnl', { precision: 24, scale: 6 }),
    unrealizedPnl: numeric('unrealized_pnl', { precision: 24, scale: 6 }),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    degradedReasons: jsonb('degraded_reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    sourceConfidence: text('source_confidence').notNull().default('unknown'),
    rawImportId: integer('raw_import_id').references(() => externalInvestmentRawImport.id, {
      onDelete: 'set null',
    }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_position_key_unique').on(table.positionKey),
    index('external_investment_position_connection_idx').on(table.connectionId),
    index('external_investment_position_asset_class_idx').on(table.assetClass),
    index('external_investment_position_value_as_of_idx').on(table.valueAsOf),
  ]
)

export const externalInvestmentTrade = pgTable(
  'external_investment_trade',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountExternalId: text('account_external_id').notNull(),
    instrumentKey: text('instrument_key').notNull(),
    tradeKey: text('trade_key').notNull(),
    providerTradeId: text('provider_trade_id').notNull(),
    symbol: text('symbol'),
    side: text('side').notNull().default('unknown'),
    quantity: numeric('quantity', { precision: 30, scale: 12 }),
    price: numeric('price', { precision: 24, scale: 8 }),
    grossAmount: numeric('gross_amount', { precision: 24, scale: 6 }),
    netAmount: numeric('net_amount', { precision: 24, scale: 6 }),
    currency: text('currency'),
    feeAmount: numeric('fee_amount', { precision: 24, scale: 8 }),
    feeAsset: text('fee_asset'),
    tradedAt: timestamp('traded_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    sourceConfidence: text('source_confidence').notNull().default('unknown'),
    rawImportId: integer('raw_import_id').references(() => externalInvestmentRawImport.id, {
      onDelete: 'set null',
    }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_trade_key_unique').on(table.tradeKey),
    index('external_investment_trade_connection_idx').on(table.connectionId),
    index('external_investment_trade_traded_at_idx').on(table.tradedAt),
  ]
)

export const externalInvestmentCashFlow = pgTable(
  'external_investment_cash_flow',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id')
      .notNull()
      .references(() => externalInvestmentConnection.id, { onDelete: 'cascade' }),
    providerConnectionId: text('provider_connection_id').notNull(),
    accountExternalId: text('account_external_id').notNull(),
    cashFlowKey: text('cash_flow_key').notNull(),
    providerCashFlowId: text('provider_cash_flow_id').notNull(),
    type: text('type').notNull().default('unknown'),
    asset: text('asset'),
    amount: numeric('amount', { precision: 30, scale: 12 }),
    currency: text('currency'),
    feeAmount: numeric('fee_amount', { precision: 24, scale: 8 }),
    feeAsset: text('fee_asset'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    sourceConfidence: text('source_confidence').notNull().default('unknown'),
    rawImportId: integer('raw_import_id').references(() => externalInvestmentRawImport.id, {
      onDelete: 'set null',
    }),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_cash_flow_key_unique').on(table.cashFlowKey),
    index('external_investment_cash_flow_connection_idx').on(table.connectionId),
    index('external_investment_cash_flow_occurred_at_idx').on(table.occurredAt),
    index('external_investment_cash_flow_type_idx').on(table.type),
  ]
)

export const externalInvestmentValuationSnapshot = pgTable(
  'external_investment_valuation_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    connectionId: integer('connection_id').references(() => externalInvestmentConnection.id, {
      onDelete: 'cascade',
    }),
    providerConnectionId: text('provider_connection_id').notNull(),
    positionKey: text('position_key').notNull(),
    value: numeric('value', { precision: 24, scale: 6 }),
    currency: text('currency'),
    source: text('source').notNull().default('unknown'),
    confidence: text('confidence').notNull().default('unknown'),
    asOf: timestamp('as_of', { withTimezone: true }).notNull(),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    degradedReasons: jsonb('degraded_reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('external_investment_valuation_snapshot_unique').on(
      table.positionKey,
      table.asOf,
      table.source
    ),
    index('external_investment_valuation_snapshot_as_of_idx').on(table.asOf),
  ]
)

export const advisorInvestmentContextBundle = pgTable(
  'advisor_investment_context_bundle',
  {
    singleton: boolean('singleton').notNull().default(true),
    schemaVersion: text('schema_version').notNull(),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    requestId: text('request_id'),
    bundle: jsonb('bundle').$type<Record<string, unknown>>().notNull(),
    staleAfterMinutes: integer('stale_after_minutes').notNull(),
    providerCoverage: jsonb('provider_coverage')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    primaryKey({
      columns: [table.singleton],
      name: 'advisor_investment_context_bundle_singleton_pk',
    }),
  ]
)
