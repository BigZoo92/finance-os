import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
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

export const powensConnectionStatusEnum = pgEnum('powens_connection_status', [
  'connected',
  'syncing',
  'error',
  'reconnect_required',
])

export const powensConnection = pgTable(
  'powens_connection',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    powensConnectionId: text('powens_connection_id').notNull(),
    accessTokenEncrypted: text('access_token_encrypted').notNull(),
    status: powensConnectionStatusEnum('status').notNull().default('connected'),
    lastSyncAt: timestamp('last_sync_at', { withTimezone: true }),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastError: text('last_error'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [uniqueIndex('powens_connection_powens_connection_id_unique').on(table.powensConnectionId)]
)

export const bankAccount = pgTable(
  'bank_account',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    powensAccountId: text('powens_account_id').notNull(),
    powensConnectionId: text('powens_connection_id').notNull(),
    name: text('name').notNull(),
    iban: text('iban'),
    currency: text('currency').notNull(),
    type: text('type'),
    enabled: boolean('enabled').notNull().default(true),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('bank_account_powens_account_id_unique').on(table.powensAccountId),
    index('bank_account_powens_connection_id_idx').on(table.powensConnectionId),
  ]
)

export const transaction = pgTable(
  'transaction',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    powensTransactionId: text('powens_transaction_id'),
    powensConnectionId: text('powens_connection_id').notNull(),
    powensAccountId: text('powens_account_id').notNull(),
    bookingDate: date('booking_date').notNull(),
    amount: numeric('amount', { precision: 18, scale: 2 }).notNull(),
    currency: text('currency').notNull(),
    label: text('label').notNull(),
    labelHash: text('label_hash').notNull(),
    raw: jsonb('raw'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('transaction_powens_connection_id_idx').on(table.powensConnectionId),
    index('transaction_powens_account_id_idx').on(table.powensAccountId),
    uniqueIndex('transaction_powens_transaction_unique')
      .on(table.powensConnectionId, table.powensTransactionId)
      .where(sql`${table.powensTransactionId} is not null`),
    uniqueIndex('transaction_fallback_unique')
      .on(
        table.powensConnectionId,
        table.powensAccountId,
        table.bookingDate,
        table.amount,
        table.labelHash
      )
      .where(sql`${table.powensTransactionId} is null`),
  ]
)
