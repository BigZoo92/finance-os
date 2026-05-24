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
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { aiRun } from './ai'
import { advisorMarketHypothesis, advisorMarketPostMortem } from './advisor-learning'
import { assetPriceSnapshot, assetValuationSnapshot } from './valuation'

export type InvestmentStrategyStatus = 'active' | 'draft' | 'archived'
export type InvestmentRiskProfile = 'conservative' | 'balanced' | 'growth' | 'aggressive' | 'custom'
export type InvestmentBucketKey = 'core' | 'growth' | 'asymmetric'
export type InvestmentRiskLevel = 'low' | 'medium' | 'high' | 'very_high'
export type AccountStrategyType = 'pea' | 'brokerage' | 'crypto' | 'cash' | 'unknown'
export type AssetUniverseEligibilityStatus =
  | 'approved'
  | 'candidate_needs_review'
  | 'approved_by_default_policy'
  | 'candidate_auto_suggested'
  | 'rejected'
  | 'watch_only'
  | 'unknown'
export type PeaEligibilityStatus = 'eligible' | 'ineligible' | 'unknown' | 'not_applicable'
export type AssetPriceabilityStatus = 'priceable' | 'stale' | 'missing' | 'unsupported'
export type AssetRecommendabilityStatus =
  | 'recommendable'
  | 'watch_only'
  | 'blocked_missing_price'
  | 'blocked_stale_price'
  | 'blocked_ineligible_account'
  | 'blocked_unknown_pea_eligibility'
  | 'blocked_risk_policy'
  | 'blocked_strategy_cap'
  | 'rejected_by_user'
export type UserAssetInterestLevel = 'none' | 'watching' | 'interested' | 'high_interest'
export type UserAssetIntent = 'watch' | 'analyze' | 'compare' | 'consider_buy' | 'exclude'
export type AssetRecommendationTier =
  | 'core_candidate'
  | 'growth_candidate'
  | 'asymmetric_candidate'
  | 'speculative_watch'
  | 'user_watchlist'
  | 'avoid'
export type AssetRecommendationMode =
  | 'action_now'
  | 'prepare_contribution'
  | 'watch'
  | 'research_more'
  | 'avoid'
export type AdvisorActionPlanStatus = 'draft' | 'active' | 'superseded' | 'archived'
export type AdvisorActionPlanItemAction =
  | 'buy'
  | 'hold'
  | 'watch'
  | 'avoid'
  | 'rebalance'
  | 'contribute_cash'
  | 'insufficient_data'
export type StrategyLessonStatus = 'candidate' | 'approved' | 'rejected' | 'archived'

export const investmentStrategyProfile = pgTable(
  'investment_strategy_profile',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    name: text('name').notNull(),
    version: text('version').notNull(),
    status: text('status').notNull().$type<InvestmentStrategyStatus>().default('draft'),
    description: text('description').notNull(),
    riskProfile: text('risk_profile').notNull().$type<InvestmentRiskProfile>(),
    horizonYears: integer('horizon_years').notNull(),
    baseCurrency: text('base_currency').notNull().default('EUR'),
    monthlyContributionTarget: numeric('monthly_contribution_target', {
      precision: 18,
      scale: 2,
    }),
    rebalanceThresholdPct: doublePrecision('rebalance_threshold_pct').notNull().default(5),
    reviewFrequency: text('review_frequency').notNull().default('daily_monitoring'),
    noAutoTrade: boolean('no_auto_trade').notNull().default(true),
    humanValidationRequired: boolean('human_validation_required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('investment_strategy_profile_name_version_unique').on(table.name, table.version),
    index('investment_strategy_profile_status_idx').on(table.status),
  ]
)

export const investmentStrategyBucket = pgTable(
  'investment_strategy_bucket',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    bucketKey: text('bucket_key').notNull().$type<InvestmentBucketKey>(),
    targetPct: doublePrecision('target_pct').notNull(),
    minPct: doublePrecision('min_pct').notNull(),
    maxPct: doublePrecision('max_pct').notNull(),
    riskLevel: text('risk_level').notNull().$type<InvestmentRiskLevel>(),
    description: text('description').notNull(),
    defaultHorizon: text('default_horizon').notNull(),
    rulesJson: jsonb('rules_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('investment_strategy_bucket_strategy_key_unique').on(
      table.strategyId,
      table.bucketKey
    ),
    index('investment_strategy_bucket_strategy_idx').on(table.strategyId),
  ]
)

export const accountStrategyPolicy = pgTable(
  'account_strategy_policy',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    accountId: text('account_id'),
    provider: text('provider').notNull(),
    accountType: text('account_type').notNull().$type<AccountStrategyType>(),
    label: text('label').notNull(),
    allowedBucketsJson: jsonb('allowed_buckets_json')
      .$type<InvestmentBucketKey[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    preferredBucket: text('preferred_bucket').$type<InvestmentBucketKey | null>(),
    maxAllocationPct: doublePrecision('max_allocation_pct').notNull(),
    maxSingleAssetPct: doublePrecision('max_single_asset_pct').notNull(),
    minOrderAmount: numeric('min_order_amount', { precision: 18, scale: 2 }),
    tradingCurrency: text('trading_currency').notNull().default('EUR'),
    taxWrapper: text('tax_wrapper'),
    eligibilityRulesJson: jsonb('eligibility_rules_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    restrictedAssetsJson: jsonb('restricted_assets_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    humanReadablePolicy: text('human_readable_policy').notNull(),
    noAutoTrade: boolean('no_auto_trade').notNull().default(true),
    humanValidationRequired: boolean('human_validation_required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('account_strategy_policy_strategy_provider_label_unique').on(
      table.strategyId,
      table.provider,
      table.label
    ),
    index('account_strategy_policy_strategy_idx').on(table.strategyId),
    index('account_strategy_policy_provider_idx').on(table.provider),
    index('account_strategy_policy_account_type_idx').on(table.accountType),
  ]
)

export const assetUniverseCandidate = pgTable(
  'asset_universe_candidate',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    assetClass: text('asset_class').notNull(),
    bucket: text('bucket').notNull().$type<InvestmentBucketKey>(),
    accountTypesAllowedJson: jsonb('account_types_allowed_json')
      .$type<AccountStrategyType[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    providerSymbolsJson: jsonb('provider_symbols_json')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    isin: text('isin'),
    exchange: text('exchange'),
    currency: text('currency').notNull().default('EUR'),
    eligibilityStatus: text('eligibility_status')
      .notNull()
      .$type<AssetUniverseEligibilityStatus>()
      .default('unknown'),
    peaEligibilityStatus: text('pea_eligibility_status')
      .notNull()
      .$type<PeaEligibilityStatus>()
      .default('unknown'),
    riskLevel: text('risk_level').notNull().$type<InvestmentRiskLevel>(),
    liquidityScore: doublePrecision('liquidity_score'),
    notes: text('notes'),
    source: text('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('asset_universe_candidate_symbol_bucket_unique').on(table.symbol, table.bucket),
    index('asset_universe_candidate_bucket_idx').on(table.bucket),
    index('asset_universe_candidate_eligibility_idx').on(table.eligibilityStatus),
    index('asset_universe_candidate_pea_eligibility_idx').on(table.peaEligibilityStatus),
  ]
)

export const userAssetInterest = pgTable(
  'user_asset_interest',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    normalizedSymbol: text('normalized_symbol').notNull(),
    symbol: text('symbol').notNull(),
    name: text('name').notNull(),
    assetClass: text('asset_class').notNull(),
    providerSymbolsJson: jsonb('provider_symbols_json')
      .$type<Record<string, string>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    iconUrl: text('icon_url'),
    logoUrl: text('logo_url'),
    isin: text('isin'),
    exchange: text('exchange'),
    currency: text('currency').notNull().default('EUR'),
    userInterestLevel: text('user_interest_level')
      .notNull()
      .$type<UserAssetInterestLevel>()
      .default('watching'),
    userIntent: text('user_intent').notNull().$type<UserAssetIntent>().default('watch'),
    note: text('note'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('user_asset_interest_symbol_asset_class_unique').on(
      table.normalizedSymbol,
      table.assetClass
    ),
    index('user_asset_interest_symbol_idx').on(table.normalizedSymbol),
    index('user_asset_interest_intent_idx').on(table.userIntent),
    index('user_asset_interest_level_idx').on(table.userInterestLevel),
  ]
)

export const portfolioAllocationSnapshot = pgTable(
  'portfolio_allocation_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    snapshotAt: timestamp('snapshot_at', { withTimezone: true }).notNull(),
    baseCurrency: text('base_currency').notNull().default('EUR'),
    totalValue: numeric('total_value', { precision: 28, scale: 10 }).notNull(),
    coreValue: numeric('core_value', { precision: 28, scale: 10 }).notNull(),
    growthValue: numeric('growth_value', { precision: 28, scale: 10 }).notNull(),
    asymmetricValue: numeric('asymmetric_value', { precision: 28, scale: 10 }).notNull(),
    cashValue: numeric('cash_value', { precision: 28, scale: 10 }).notNull(),
    unknownValue: numeric('unknown_value', { precision: 28, scale: 10 }).notNull(),
    corePct: doublePrecision('core_pct').notNull(),
    growthPct: doublePrecision('growth_pct').notNull(),
    asymmetricPct: doublePrecision('asymmetric_pct').notNull(),
    driftJson: jsonb('drift_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    dataQualityJson: jsonb('data_quality_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('portfolio_allocation_snapshot_strategy_idx').on(table.strategyId),
    index('portfolio_allocation_snapshot_at_idx').on(table.snapshotAt),
  ]
)

export const strategyDriftSnapshot = pgTable(
  'strategy_drift_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => portfolioAllocationSnapshot.id, { onDelete: 'cascade' }),
    bucket: text('bucket').notNull().$type<InvestmentBucketKey>(),
    targetPct: doublePrecision('target_pct').notNull(),
    actualPct: doublePrecision('actual_pct').notNull(),
    driftPct: doublePrecision('drift_pct').notNull(),
    severity: text('severity').notNull().$type<'ok' | 'watch' | 'alert' | 'hard_limit'>(),
    recommendedContribution: numeric('recommended_contribution', { precision: 18, scale: 2 }),
    recommendedAction: text('recommended_action').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('strategy_drift_snapshot_strategy_idx').on(table.strategyId),
    index('strategy_drift_snapshot_snapshot_idx').on(table.snapshotId),
    index('strategy_drift_snapshot_bucket_idx').on(table.bucket),
  ]
)

export const advisorActionPlan = pgTable(
  'advisor_action_plan',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    status: text('status').notNull().$type<AdvisorActionPlanStatus>().default('draft'),
    topActionId: integer('top_action_id'),
    summary: text('summary').notNull(),
    globalRisk: text('global_risk').notNull(),
    globalConfidence: doublePrecision('global_confidence').notNull().default(0),
    dataQualityStatus: text('data_quality_status').notNull(),
    noAutoTrade: boolean('no_auto_trade').notNull().default(true),
    humanValidationRequired: boolean('human_validation_required').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_action_plan_strategy_idx').on(table.strategyId),
    index('advisor_action_plan_status_generated_idx').on(table.status, table.generatedAt),
    index('advisor_action_plan_run_idx').on(table.runId),
  ]
)

export const advisorActionPlanItem = pgTable(
  'advisor_action_plan_item',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    planId: integer('plan_id')
      .notNull()
      .references(() => advisorActionPlan.id, { onDelete: 'cascade' }),
    accountPolicyId: integer('account_policy_id').references(() => accountStrategyPolicy.id, {
      onDelete: 'set null',
    }),
    accountLabel: text('account_label').notNull(),
    accountType: text('account_type').notNull().$type<AccountStrategyType>(),
    bucket: text('bucket').notNull().$type<InvestmentBucketKey>(),
    symbol: text('symbol'),
    assetName: text('asset_name'),
    action: text('action').notNull().$type<AdvisorActionPlanItemAction>(),
    amountValue: numeric('amount_value', { precision: 18, scale: 2 }),
    amountCurrency: text('amount_currency').notNull().default('EUR'),
    targetWeightPct: doublePrecision('target_weight_pct'),
    currentWeightPct: doublePrecision('current_weight_pct'),
    confidence: doublePrecision('confidence').notNull().default(0),
    riskLevel: text('risk_level').notNull().$type<InvestmentRiskLevel>(),
    horizon: text('horizon').notNull(),
    thesis: text('thesis').notNull(),
    argumentsForJson: jsonb('arguments_for_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    argumentsAgainstJson: jsonb('arguments_against_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    invalidationCriteriaJson: jsonb('invalidation_criteria_json')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    priceSnapshotId: integer('price_snapshot_id').references(() => assetPriceSnapshot.id, {
      onDelete: 'set null',
    }),
    valuationSnapshotId: integer('valuation_snapshot_id').references(() => assetValuationSnapshot.id, {
      onDelete: 'set null',
    }),
    dataFreshnessJson: jsonb('data_freshness_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    humanValidationRequired: boolean('human_validation_required').notNull().default(true),
    noAutoTrade: boolean('no_auto_trade').notNull().default(true),
    createsHypothesis: boolean('creates_hypothesis').notNull().default(false),
    createdHypothesisId: integer('created_hypothesis_id').references(() => advisorMarketHypothesis.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_action_plan_item_plan_idx').on(table.planId),
    index('advisor_action_plan_item_policy_idx').on(table.accountPolicyId),
    index('advisor_action_plan_item_action_idx').on(table.action),
    index('advisor_action_plan_item_symbol_idx').on(table.symbol),
  ]
)

export const strategyLesson = pgTable(
  'strategy_lesson',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    sourceHypothesisId: integer('source_hypothesis_id').references(() => advisorMarketHypothesis.id, {
      onDelete: 'set null',
    }),
    sourcePostMortemId: integer('source_post_mortem_id').references(() => advisorMarketPostMortem.id, {
      onDelete: 'set null',
    }),
    lessonType: text('lesson_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    confidenceImpact: doublePrecision('confidence_impact').notNull().default(0),
    ruleCandidateJson: jsonb('rule_candidate_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    status: text('status').notNull().$type<StrategyLessonStatus>().default('candidate'),
    requiresHumanReview: boolean('requires_human_review').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('strategy_lesson_strategy_idx').on(table.strategyId),
    index('strategy_lesson_status_idx').on(table.status),
    index('strategy_lesson_source_hypothesis_idx').on(table.sourceHypothesisId),
  ]
)

export const advisorCalibrationSnapshot = pgTable(
  'advisor_calibration_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    strategyId: integer('strategy_id')
      .notNull()
      .references(() => investmentStrategyProfile.id, { onDelete: 'cascade' }),
    generatedAt: timestamp('generated_at', { withTimezone: true }).notNull(),
    horizon: text('horizon').notNull(),
    sampleSize: integer('sample_size').notNull().default(0),
    hitRate: doublePrecision('hit_rate').notNull().default(0),
    brierScore: doublePrecision('brier_score'),
    averageConfidence: doublePrecision('average_confidence').notNull().default(0),
    calibrationBucketsJson: jsonb('calibration_buckets_json')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    byBucketJson: jsonb('by_bucket_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    byAccountJson: jsonb('by_account_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    byAssetClassJson: jsonb('by_asset_class_json')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('advisor_calibration_snapshot_strategy_idx').on(table.strategyId),
    index('advisor_calibration_snapshot_generated_idx').on(table.generatedAt),
    index('advisor_calibration_snapshot_horizon_idx').on(table.horizon),
  ]
)
