import { sql } from 'drizzle-orm'
import { index, integer, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { aiRecommendation, aiRun } from './ai'

export const advisorDecisionJournal = pgTable(
  'advisor_decision_journal',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    recommendationId: integer('recommendation_id').references(() => aiRecommendation.id, {
      onDelete: 'set null',
    }),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    recommendationKey: text('recommendation_key'),
    decision: text('decision').notNull(),
    reasonCode: text('reason_code').notNull(),
    freeNote: text('free_note'),
    decidedBy: text('decided_by').notNull().default('admin'),
    decidedAt: timestamp('decided_at', { withTimezone: true }).notNull().defaultNow(),
    expectedOutcomeAt: timestamp('expected_outcome_at', { withTimezone: true }),
    scope: text('scope').notNull().default('admin'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_decision_journal_recommendation_id_idx').on(table.recommendationId),
    index('advisor_decision_journal_run_id_idx').on(table.runId),
    index('advisor_decision_journal_recommendation_key_idx').on(table.recommendationKey),
    index('advisor_decision_journal_decision_idx').on(table.decision),
    index('advisor_decision_journal_decided_at_idx').on(table.decidedAt),
    index('advisor_decision_journal_scope_idx').on(table.scope),
  ]
)

export const advisorDecisionOutcome = pgTable(
  'advisor_decision_outcome',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    decisionId: integer('decision_id')
      .notNull()
      .references(() => advisorDecisionJournal.id, { onDelete: 'cascade' }),
    observedAt: timestamp('observed_at', { withTimezone: true }).notNull().defaultNow(),
    outcomeKind: text('outcome_kind').notNull(),
    deltaMetrics: jsonb('delta_metrics').$type<Record<string, unknown> | null>(),
    learningTags: jsonb('learning_tags')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    freeNote: text('free_note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_decision_outcome_decision_id_idx').on(table.decisionId),
    index('advisor_decision_outcome_observed_at_idx').on(table.observedAt),
    index('advisor_decision_outcome_outcome_kind_idx').on(table.outcomeKind),
  ]
)
