import { boolean, index, integer, numeric, pgEnum, pgTable, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

export const recurringCommitmentKindEnum = pgEnum('recurring_commitment_kind', [
  'fixed_charge',
  'subscription',
])

export const recurringCommitmentPeriodicityEnum = pgEnum('recurring_commitment_periodicity', [
  'weekly',
  'monthly',
  'quarterly',
  'yearly',
  'unknown',
])

export const recurringCommitmentValidationStatusEnum = pgEnum('recurring_commitment_validation_status', [
  'suggested',
  'validated',
  'rejected',
])

export const recurringCommitment = pgTable(
  'recurring_commitment',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    kind: recurringCommitmentKindEnum('kind').notNull(),
    canonicalLabel: text('canonical_label').notNull(),
    merchant: text('merchant'),
    currency: text('currency').notNull(),
    estimatedPeriodicity: recurringCommitmentPeriodicityEnum('estimated_periodicity').notNull().default('unknown'),
    lastAmount: numeric('last_amount', { precision: 18, scale: 2 }),
    lastObservedAt: timestamp('last_observed_at', { withTimezone: true }),
    active: boolean('active').notNull().default(true),
    validationStatus: recurringCommitmentValidationStatusEnum('validation_status').notNull().default('suggested'),
    validatedAt: timestamp('validated_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('recurring_commitment_kind_label_currency_unique').on(
      table.kind,
      table.canonicalLabel,
      table.currency
    ),
    index('recurring_commitment_status_active_idx').on(table.validationStatus, table.active),
  ]
)

export const recurringCommitmentTransactionLink = pgTable(
  'recurring_commitment_transaction_link',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    recurringCommitmentId: integer('recurring_commitment_id')
      .notNull()
      .references(() => recurringCommitment.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id').notNull(),
    linkType: text('link_type').notNull().default('transaction'),
    confidence: numeric('confidence', { precision: 5, scale: 2 }),
    source: text('source').notNull().default('auto_detection'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('recurring_commitment_transaction_link_unique').on(
      table.recurringCommitmentId,
      table.transactionId
    ),
    index('recurring_commitment_link_transaction_idx').on(table.transactionId),
  ]
)
