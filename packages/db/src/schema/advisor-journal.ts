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

// PR4 — Advisor Post-Mortem.
// Persists structured retrospective findings keyed off an aiRun + recommendation + decision.
// Findings, learning actions, calibration are jsonb so the LLM-validated schema can evolve
// without column migrations. All entries are advisory-only.
export const advisorPostMortem = pgTable(
  'advisor_post_mortem',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    recommendationId: integer('recommendation_id').references(() => aiRecommendation.id, {
      onDelete: 'set null',
    }),
    decisionId: integer('decision_id').references(() => advisorDecisionJournal.id, {
      onDelete: 'set null',
    }),
    recommendationKey: text('recommendation_key'),
    status: text('status').notNull().default('pending'),
    horizonDays: integer('horizon_days'),
    evaluatedAt: timestamp('evaluated_at', { withTimezone: true }),
    expectedOutcomeAt: timestamp('expected_outcome_at', { withTimezone: true }),
    inputSummary: jsonb('input_summary').$type<Record<string, unknown> | null>(),
    findings: jsonb('findings').$type<Record<string, unknown> | null>(),
    learningActions: jsonb('learning_actions').$type<Array<Record<string, unknown>> | null>(),
    calibration: jsonb('calibration').$type<Record<string, unknown> | null>(),
    riskNotes: jsonb('risk_notes').$type<Record<string, unknown> | null>(),
    skippedReason: text('skipped_reason'),
    errorCode: text('error_code'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_post_mortem_status_idx').on(table.status),
    index('advisor_post_mortem_recommendation_id_idx').on(table.recommendationId),
    index('advisor_post_mortem_decision_id_idx').on(table.decisionId),
    index('advisor_post_mortem_recommendation_key_idx').on(table.recommendationKey),
    index('advisor_post_mortem_expected_outcome_at_idx').on(table.expectedOutcomeAt),
    index('advisor_post_mortem_evaluated_at_idx').on(table.evaluatedAt),
  ]
)
