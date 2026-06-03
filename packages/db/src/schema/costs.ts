import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'

export type RecurringProviderCostCadence =
  | 'daily'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'one_time'

export const recurringProviderCost = pgTable(
  'recurring_provider_cost',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    label: text('label').notNull(),
    amount: numeric('amount', { precision: 18, scale: 6 }).notNull(),
    currency: text('currency').notNull().default('EUR'),
    cadence: text('cadence').notNull().default('monthly').$type<RecurringProviderCostCadence>(),
    startDate: date('start_date'),
    endDate: date('end_date'),
    active: boolean('active').notNull().default(true),
    category: text('category').notNull().default('provider_subscription'),
    source: text('source').notNull().default('manual_admin'),
    owner: text('owner').notNull().default('admin'),
    notes: text('notes'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('recurring_provider_cost_active_idx').on(table.active),
    index('recurring_provider_cost_provider_idx').on(table.provider),
    index('recurring_provider_cost_category_idx').on(table.category),
  ]
)
