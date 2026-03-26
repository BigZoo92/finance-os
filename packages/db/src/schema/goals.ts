import { sql } from 'drizzle-orm'
import { date, index, integer, jsonb, numeric, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'

export const personalGoalTypeEnum = pgEnum('personal_goal_type', [
  'emergency_fund',
  'travel',
  'home',
  'education',
  'retirement',
  'custom',
])

export type PersonalGoalProgressSnapshot = {
  recordedAt: string
  amount: number
  note: string | null
}

export const personalGoal = pgTable(
  'personal_goal',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    goalType: personalGoalTypeEnum('goal_type').notNull().default('custom'),
    currency: text('currency').notNull().default('EUR'),
    targetAmount: numeric('target_amount', { precision: 18, scale: 2 }).notNull(),
    currentAmount: numeric('current_amount', { precision: 18, scale: 2 }).notNull().default('0'),
    targetDate: date('target_date'),
    note: text('note'),
    progressSnapshots: jsonb('progress_snapshots')
      .$type<PersonalGoalProgressSnapshot[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('personal_goal_archived_at_idx').on(table.archivedAt),
    index('personal_goal_goal_type_idx').on(table.goalType),
    index('personal_goal_target_date_idx').on(table.targetDate),
  ]
)
