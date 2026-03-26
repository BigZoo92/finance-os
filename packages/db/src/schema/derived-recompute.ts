import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { providerRawImport, transaction } from './powens'

export const derivedRecomputeRunStatusEnum = pgEnum('derived_recompute_run_status', [
  'running',
  'completed',
  'failed',
])

export const derivedRecomputeTriggerSourceEnum = pgEnum('derived_recompute_trigger_source', [
  'admin',
  'internal',
])

export interface DerivedRecomputeRowCounts {
  rawTransactionCount: number
  transactionMatchedCount: number
  transactionUpdatedCount: number
  transactionUnchangedCount: number
  transactionSkippedCount: number
  rawImportTimestampUpdatedCount: number
  snapshotRowCount: number
}

export const derivedRecomputeRun = pgTable(
  'derived_recompute_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    snapshotVersion: text('snapshot_version').notNull(),
    status: derivedRecomputeRunStatusEnum('status').notNull().default('running'),
    triggerSource: derivedRecomputeTriggerSourceEnum('trigger_source').notNull(),
    requestId: text('request_id').notNull(),
    stage: text('stage'),
    rowCounts: jsonb('row_counts').$type<DerivedRecomputeRowCounts | null>(),
    safeErrorCode: text('safe_error_code'),
    safeErrorMessage: text('safe_error_message'),
    isCurrentSnapshot: boolean('is_current_snapshot').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
  },
  table => [
    uniqueIndex('derived_recompute_run_snapshot_version_unique').on(table.snapshotVersion),
    index('derived_recompute_run_status_idx').on(table.status),
    index('derived_recompute_run_started_at_idx').on(table.startedAt),
    index('derived_recompute_run_current_snapshot_idx').on(table.isCurrentSnapshot),
  ]
)

export const derivedTransactionSnapshot = pgTable(
  'derived_transaction_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => derivedRecomputeRun.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id')
      .notNull()
      .references(() => transaction.id, { onDelete: 'cascade' }),
    providerRawImportId: integer('provider_raw_import_id').references(() => providerRawImport.id, {
      onDelete: 'set null',
    }),
    label: text('label').notNull(),
    labelHash: text('label_hash').notNull(),
    category: text('category'),
    merchant: text('merchant'),
    providerObjectAt: timestamp('provider_object_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('derived_transaction_snapshot_run_transaction_unique').on(
      table.runId,
      table.transactionId
    ),
    index('derived_transaction_snapshot_transaction_idx').on(table.transactionId),
    index('derived_transaction_snapshot_provider_raw_import_idx').on(table.providerRawImportId),
  ]
)
