import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { aiRecommendation, aiRun } from './ai'
import { assetPriceSnapshot } from './valuation'

export type AdvisorAccountScope = 'PEA' | 'IBKR' | 'Binance' | 'global'
export type AdvisorInvestmentAction =
  | 'buy'
  | 'hold'
  | 'watch'
  | 'avoid'
  | 'rebalance'
  | 'insufficient_data'
export type AdvisorInvestmentHorizon = 'intraday' | '1d' | '7d' | '30d' | '90d' | 'long_term'

export const advisorInvestmentRecommendation = pgTable(
  'advisor_investment_recommendation',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    legacyRecommendationId: integer('legacy_recommendation_id').references(
      () => aiRecommendation.id,
      { onDelete: 'set null' }
    ),
    accountScope: text('account_scope').notNull().$type<AdvisorAccountScope>(),
    assetId: text('asset_id'),
    instrumentId: text('instrument_id'),
    symbol: text('symbol').notNull(),
    action: text('action').notNull().$type<AdvisorInvestmentAction>(),
    horizon: text('horizon').notNull().$type<AdvisorInvestmentHorizon>(),
    thesis: text('thesis').notNull(),
    supportingSignals: jsonb('supporting_signals')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contradictingSignals: jsonb('contradicting_signals')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    riskLevel: text('risk_level').notNull(),
    confidence: doublePrecision('confidence').notNull().default(0),
    priceUsed: numeric('price_used', { precision: 24, scale: 10 }),
    priceSnapshotId: integer('price_snapshot_id').references(() => assetPriceSnapshot.id, {
      onDelete: 'set null',
    }),
    priceSource: text('price_source'),
    priceSourceType: text('price_source_type'),
    marketTimestamp: timestamp('market_timestamp', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    delaySeconds: integer('delay_seconds'),
    isPriceStale: boolean('is_price_stale').notNull().default(false),
    staleReason: text('stale_reason'),
    invalidationCriteria: jsonb('invalidation_criteria')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    expectedMove: doublePrecision('expected_move'),
    probability: doublePrecision('probability'),
    reviewDates: jsonb('review_dates')
      .$type<Array<'J1' | 'J7' | 'J30'>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    missingData: jsonb('missing_data').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    humanValidationRequired: boolean('human_validation_required').notNull().default(true),
    noAutoTrade: boolean('no_auto_trade').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('advisor_investment_recommendation_run_idx').on(table.runId),
    index('advisor_investment_recommendation_scope_idx').on(table.accountScope),
    index('advisor_investment_recommendation_symbol_idx').on(table.symbol),
    index('advisor_investment_recommendation_action_idx').on(table.action),
    index('advisor_investment_recommendation_price_snapshot_idx').on(table.priceSnapshotId),
  ]
)

export const advisorMarketHypothesis = pgTable(
  'advisor_market_hypothesis',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    recommendationId: integer('recommendation_id').references(
      () => advisorInvestmentRecommendation.id,
      { onDelete: 'set null' }
    ),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    assetId: text('asset_id'),
    symbol: text('symbol').notNull(),
    accountScope: text('account_scope').notNull().$type<AdvisorAccountScope>(),
    direction: text('direction')
      .notNull()
      .$type<'bullish' | 'bearish' | 'neutral' | 'volatile' | 'defensive'>(),
    actionSuggested: text('action_suggested').notNull().$type<AdvisorInvestmentAction>(),
    horizon: text('horizon').notNull().$type<AdvisorInvestmentHorizon>(),
    expectedMove: doublePrecision('expected_move'),
    probability: doublePrecision('probability'),
    confidence: doublePrecision('confidence').notNull().default(0),
    thesis: text('thesis').notNull(),
    supportingSignals: jsonb('supporting_signals')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    contradictingSignals: jsonb('contradicting_signals')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    invalidationCriteria: jsonb('invalidation_criteria')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    priceAtPrediction: numeric('price_at_prediction', { precision: 24, scale: 10 }),
    priceSnapshotId: integer('price_snapshot_id').references(() => assetPriceSnapshot.id, {
      onDelete: 'set null',
    }),
    priceSource: text('price_source'),
    priceSourceType: text('price_source_type'),
    priceFreshness: jsonb('price_freshness').$type<Record<string, unknown> | null>(),
    marketTimestamp: timestamp('market_timestamp', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }),
    reviewSchedule: jsonb('review_schedule')
      .$type<Array<'J1' | 'J7' | 'J30'>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    status: text('status')
      .notNull()
      .default('open')
      .$type<'open' | 'partially_reviewed' | 'closed' | 'invalidated' | 'expired'>(),
    createdByModel: text('created_by_model'),
    promptVersion: text('prompt_version'),
    strategyVersion: text('strategy_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('advisor_market_hypothesis_recommendation_idx').on(table.recommendationId),
    index('advisor_market_hypothesis_run_idx').on(table.runId),
    index('advisor_market_hypothesis_symbol_idx').on(table.symbol),
    index('advisor_market_hypothesis_status_idx').on(table.status),
    index('advisor_market_hypothesis_created_at_idx').on(table.createdAt),
  ]
)

export const advisorPredictionOutcome = pgTable(
  'advisor_prediction_outcome',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    hypothesisId: integer('hypothesis_id')
      .notNull()
      .references(() => advisorMarketHypothesis.id, { onDelete: 'cascade' }),
    reviewHorizon: text('review_horizon').notNull().$type<'J1' | 'J7' | 'J30'>(),
    reviewDueAt: timestamp('review_due_at', { withTimezone: true }).notNull(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    initialPrice: numeric('initial_price', { precision: 24, scale: 10 }),
    reviewPrice: numeric('review_price', { precision: 24, scale: 10 }),
    benchmarkPrice: numeric('benchmark_price', { precision: 24, scale: 10 }),
    performance: doublePrecision('performance'),
    performanceVsBenchmark: doublePrecision('performance_vs_benchmark'),
    maxFavorableExcursion: doublePrecision('max_favorable_excursion'),
    maxAdverseExcursion: doublePrecision('max_adverse_excursion'),
    result: text('result')
      .notNull()
      .default('inconclusive')
      .$type<'success' | 'failure' | 'mixed' | 'inconclusive' | 'skipped'>(),
    errorAttribution: text('error_attribution'),
    dataQualityNotes: text('data_quality_notes'),
    pricingFreshnessNotes: text('pricing_freshness_notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('advisor_prediction_outcome_hypothesis_idx').on(table.hypothesisId),
    index('advisor_prediction_outcome_due_idx').on(table.reviewDueAt),
    index('advisor_prediction_outcome_result_idx').on(table.result),
  ]
)

export const advisorMarketPostMortem = pgTable(
  'advisor_market_post_mortem',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    hypothesisId: integer('hypothesis_id')
      .notNull()
      .references(() => advisorMarketHypothesis.id, { onDelete: 'cascade' }),
    outcomeId: integer('outcome_id').references(() => advisorPredictionOutcome.id, {
      onDelete: 'set null',
    }),
    result: text('result').notNull(),
    whatWorked: jsonb('what_worked').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    whatFailed: jsonb('what_failed').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    whyItWorkedOrFailed: text('why_it_worked_or_failed').notNull(),
    lesson: text('lesson').notNull(),
    futurePromptHint: text('future_prompt_hint'),
    reusableRuleCandidate: text('reusable_rule_candidate'),
    shouldUpdateStrategy: boolean('should_update_strategy').notNull().default(false),
    requiresHumanReview: boolean('requires_human_review').notNull().default(true),
    memoryWriteStatus: text('memory_write_status').notNull().default('pending'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('advisor_market_post_mortem_hypothesis_idx').on(table.hypothesisId),
    index('advisor_market_post_mortem_outcome_idx').on(table.outcomeId),
    index('advisor_market_post_mortem_created_at_idx').on(table.createdAt),
  ]
)

export const advisorMemoryEvent = pgTable(
  'advisor_memory_event',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    hypothesisId: integer('hypothesis_id').references(() => advisorMarketHypothesis.id, {
      onDelete: 'set null',
    }),
    eventType: text('event_type')
      .notNull()
      .$type<
        | 'action_plan_created'
        | 'recommendation_created'
        | 'hypothesis_created'
        | 'hypothesis_review_due'
        | 'outcome_success'
        | 'outcome_failure'
        | 'outcome_mixed'
        | 'hypothesis_reviewed'
        | 'hypothesis_success'
        | 'hypothesis_failure'
        | 'post_mortem_created'
        | 'strategy_lesson_candidate_created'
        | 'strategy_lesson_learned'
        | 'data_quality_issue_detected'
        | 'provider_stale_detected'
        | 'risk_limit_triggered'
        | 'pricing_issue_detected'
      >(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    graphWriteStatus: text('graph_write_status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'sent' | 'skipped' | 'failed'>(),
    graphWriteError: text('graph_write_error'),
    nodesWritten: integer('nodes_written').notNull().default(0),
    edgesWritten: integer('edges_written').notNull().default(0),
    vectorsWritten: integer('vectors_written').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('advisor_memory_event_run_idx').on(table.runId),
    index('advisor_memory_event_hypothesis_idx').on(table.hypothesisId),
    index('advisor_memory_event_type_idx').on(table.eventType),
    index('advisor_memory_event_graph_status_idx').on(table.graphWriteStatus),
    index('advisor_memory_event_created_at_idx').on(table.createdAt),
  ]
)
