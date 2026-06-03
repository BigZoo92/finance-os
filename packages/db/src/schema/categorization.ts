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

export type UserCategorizationMatcherType =
  | 'label_contains'
  | 'merchant_contains'
  | 'label_regex'
  | 'merchant_regex'
  | 'account_id'
  | 'account_name_contains'

export type UserCategorizationAmountSign = 'income' | 'expense'

export type UserCategorizationIncomeType = 'salary' | 'recurring' | 'exceptional'

export const userCategorizationRule = pgTable(
  'user_categorization_rule',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(100),
    matcherType: text('matcher_type').notNull().$type<UserCategorizationMatcherType>(),
    matcherValue: text('matcher_value').notNull(),
    amountSign: text('amount_sign').$type<UserCategorizationAmountSign>(),
    minAmount: numeric('min_amount', { precision: 18, scale: 2 }),
    maxAmount: numeric('max_amount', { precision: 18, scale: 2 }),
    category: text('category').notNull(),
    subcategory: text('subcategory'),
    incomeType: text('income_type').$type<UserCategorizationIncomeType>(),
    validFrom: date('valid_from'),
    validTo: date('valid_to'),
    notes: text('notes'),
    metadata: jsonb('metadata')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdBy: text('created_by').notNull().default('admin'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('user_categorization_rule_enabled_priority_idx').on(table.enabled, table.priority),
    index('user_categorization_rule_matcher_idx').on(table.matcherType, table.matcherValue),
    index('user_categorization_rule_validity_idx').on(table.validFrom, table.validTo),
  ]
)
