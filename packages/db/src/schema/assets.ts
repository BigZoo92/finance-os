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
