import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const assetTypeEnum = pgEnum('asset_type', ['cash', 'investment', 'manual'])

export const assetOriginEnum = pgEnum('asset_origin', ['provider', 'manual'])

export const investmentPositionCostBasisSourceEnum = pgEnum('investment_position_cost_basis_source', [
  'minimal',
  'provider',
  'manual',
  'unknown',
])

export const asset = pgTable(
  'asset',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    assetType: assetTypeEnum('asset_type').notNull(),
    origin: assetOriginEnum('origin').notNull(),
    source: text('source').notNull().default('manual'),
    provider: text('provider'),
    providerConnectionId: text('provider_connection_id'),
    providerExternalAssetId: text('provider_external_asset_id'),
    powensConnectionId: text('powens_connection_id'),
    powensAccountId: text('powens_account_id'),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    valuation: numeric('valuation', { precision: 18, scale: 2 }),
    valuationAsOf: timestamp('valuation_as_of', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('asset_provider_external_unique').on(
      table.provider,
      table.providerConnectionId,
      table.providerExternalAssetId
    ),
    index('asset_type_idx').on(table.assetType),
    index('asset_origin_idx').on(table.origin),
    index('asset_powens_connection_id_idx').on(table.powensConnectionId),
    index('asset_powens_account_id_idx').on(table.powensAccountId),
  ]
)

export const investmentPosition = pgTable(
  'investment_position',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    positionKey: text('position_key').notNull(),
    assetId: integer('asset_id').references(() => asset.id, { onDelete: 'set null' }),
    powensAccountId: text('powens_account_id'),
    powensConnectionId: text('powens_connection_id'),
    source: text('source').notNull().default('manual'),
    provider: text('provider'),
    providerConnectionId: text('provider_connection_id'),
    providerPositionId: text('provider_position_id'),
    name: text('name').notNull(),
    currency: text('currency').notNull(),
    quantity: numeric('quantity', { precision: 24, scale: 8 }),
    costBasis: numeric('cost_basis', { precision: 18, scale: 2 }),
    costBasisSource: investmentPositionCostBasisSourceEnum('cost_basis_source')
      .notNull()
      .default('unknown'),
    currentValue: numeric('current_value', { precision: 18, scale: 2 }),
    lastKnownValue: numeric('last_known_value', { precision: 18, scale: 2 }),
    openedAt: timestamp('opened_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    valuedAt: timestamp('valued_at', { withTimezone: true }),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('investment_position_key_unique').on(table.positionKey),
    index('investment_position_asset_id_idx').on(table.assetId),
    index('investment_position_powens_account_id_idx').on(table.powensAccountId),
    index('investment_position_powens_connection_id_idx').on(table.powensConnectionId),
    index('investment_position_provider_position_idx').on(
      table.provider,
      table.providerConnectionId,
      table.providerPositionId
    ),
    index('investment_position_valued_at_idx').on(table.valuedAt),
  ]
)
