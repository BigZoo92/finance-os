import { index, integer, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const enrichmentTriageStatusEnum = pgEnum('enrichment_triage_status', [
  'pending',
  'accepted',
  'rejected',
  'needs_review',
])

export const enrichmentNote = pgTable(
  'enrichment_note',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    itemKey: text('item_key').notNull(),
    note: text('note'),
    triageStatus: enrichmentTriageStatusEnum('triage_status').notNull().default('pending'),
    version: integer('version').notNull().default(1),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('enrichment_note_item_key_unique').on(table.itemKey),
    index('enrichment_note_status_idx').on(table.triageStatus),
    index('enrichment_note_updated_at_idx').on(table.updatedAt),
  ]
)
