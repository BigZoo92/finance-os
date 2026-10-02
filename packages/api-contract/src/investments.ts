import { z } from 'zod'

/*
 * Investment strategy transport contract (advisor investment engine DTOs).
 *
 * The enums mirror the `@finance-os/db` schema unions; the API keeps a
 * compile-time guard so the two cannot drift. Monetary fields typed
 * `.nullable()` mean "unknown" when null, never 0.
 */

export const investmentStrategyStatusSchema = z.enum(['active', 'draft', 'archived'])
export type InvestmentStrategyStatus = z.infer<typeof investmentStrategyStatusSchema>

export const investmentRiskProfileSchema = z.enum([
  'conservative',
  'balanced',
  'growth',
  'aggressive',
  'custom',
])
export type InvestmentRiskProfile = z.infer<typeof investmentRiskProfileSchema>

export const investmentBucketKeySchema = z.enum(['core', 'growth', 'asymmetric'])
export type InvestmentBucketKey = z.infer<typeof investmentBucketKeySchema>

export const investmentRiskLevelSchema = z.enum(['low', 'medium', 'high', 'very_high'])
export type InvestmentRiskLevel = z.infer<typeof investmentRiskLevelSchema>

export const investmentAccountTypeSchema = z.enum(['pea', 'brokerage', 'crypto', 'cash', 'unknown'])
export type InvestmentAccountType = z.infer<typeof investmentAccountTypeSchema>

export const investmentEligibilityStatusSchema = z.enum([
  'approved',
  'candidate_needs_review',
  'approved_by_default_policy',
  'candidate_auto_suggested',
  'rejected',
  'watch_only',
  'unknown',
])
export type InvestmentEligibilityStatus = z.infer<typeof investmentEligibilityStatusSchema>

export const investmentPeaEligibilityStatusSchema = z.enum([
  'eligible',
  'ineligible',
  'unknown',
  'not_applicable',
])
export type InvestmentPeaEligibilityStatus = z.infer<typeof investmentPeaEligibilityStatusSchema>

export const investmentPriceabilitySchema = z.enum(['priceable', 'stale', 'missing', 'unsupported'])
export type InvestmentPriceability = z.infer<typeof investmentPriceabilitySchema>

export const investmentRecommendabilityStatusSchema = z.enum([
  'recommendable',
  'watch_only',
  'blocked_missing_price',
  'blocked_stale_price',
  'blocked_ineligible_account',
  'blocked_unknown_pea_eligibility',
  'blocked_risk_policy',
  'blocked_strategy_cap',
  'rejected_by_user',
])
export type InvestmentRecommendabilityStatus = z.infer<
  typeof investmentRecommendabilityStatusSchema
>

export const investmentUserInterestLevelSchema = z.enum([
  'none',
  'watching',
  'interested',
  'high_interest',
])
export type InvestmentUserInterestLevel = z.infer<typeof investmentUserInterestLevelSchema>

export const investmentUserIntentSchema = z.enum([
  'watch',
  'analyze',
  'compare',
  'consider_buy',
  'exclude',
])
export type InvestmentUserIntent = z.infer<typeof investmentUserIntentSchema>

export const investmentRecommendationTierSchema = z.enum([
  'core_candidate',
  'growth_candidate',
  'asymmetric_candidate',
  'speculative_watch',
  'user_watchlist',
  'avoid',
])
export type InvestmentRecommendationTier = z.infer<typeof investmentRecommendationTierSchema>

export const investmentRecommendationModeSchema = z.enum([
  'action_now',
  'prepare_contribution',
  'watch',
  'research_more',
  'avoid',
])
export type InvestmentRecommendationMode = z.infer<typeof investmentRecommendationModeSchema>

export const investmentActionSchema = z.enum([
  'buy',
  'hold',
  'watch',
  'avoid',
  'rebalance',
  'contribute_cash',
  'insufficient_data',
])
export type InvestmentAction = z.infer<typeof investmentActionSchema>

export const investmentDriftSeveritySchema = z.enum(['ok', 'watch', 'alert', 'hard_limit'])
export type InvestmentDriftSeverity = z.infer<typeof investmentDriftSeveritySchema>

export const investmentDataQualityStatusSchema = z.enum(['ready', 'degraded', 'insufficient_data'])
export type InvestmentDataQualityStatus = z.infer<typeof investmentDataQualityStatusSchema>

export const investmentActionableStepTypeSchema = z.enum([
  'no_trade_today',
  'allocate_contribution',
  'connect_price_source',
  'resolve_asset_eligibility',
  'review_user_watchlist',
  'do_not_reinforce_overweight_bucket',
])
export type InvestmentActionableStepType = z.infer<typeof investmentActionableStepTypeSchema>

export const investmentActionableStepPrioritySchema = z.enum(['high', 'medium', 'low'])
export type InvestmentActionableStepPriority = z.infer<
  typeof investmentActionableStepPrioritySchema
>

const jsonRecordSchema = z.record(z.string(), z.unknown())

// --- Strategy bundle ---------------------------------------------------------

export const investmentStrategyProfileSchema = z.object({
  id: z.number(),
  name: z.string(),
  version: z.string(),
  status: investmentStrategyStatusSchema,
  description: z.string(),
  riskProfile: investmentRiskProfileSchema,
  horizonYears: z.number(),
  baseCurrency: z.string(),
  monthlyContributionTarget: z.number().nullable(),
  rebalanceThresholdPct: z.number(),
  reviewFrequency: z.string(),
  noAutoTrade: z.boolean(),
  humanValidationRequired: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type InvestmentStrategyProfile = z.infer<typeof investmentStrategyProfileSchema>

export const investmentStrategyBucketSchema = z.object({
  id: z.number(),
  strategyId: z.number(),
  bucketKey: investmentBucketKeySchema,
  targetPct: z.number(),
  minPct: z.number(),
  maxPct: z.number(),
  riskLevel: investmentRiskLevelSchema,
  description: z.string(),
  defaultHorizon: z.string(),
  rules: jsonRecordSchema,
})
export type InvestmentStrategyBucket = z.infer<typeof investmentStrategyBucketSchema>

export const investmentAccountPolicySchema = z.object({
  id: z.number(),
  strategyId: z.number(),
  accountId: z.string().nullable(),
  provider: z.string(),
  accountType: investmentAccountTypeSchema,
  label: z.string(),
  allowedBuckets: z.array(investmentBucketKeySchema),
  preferredBucket: investmentBucketKeySchema.nullable(),
  maxAllocationPct: z.number(),
  maxSingleAssetPct: z.number(),
  minOrderAmount: z.number().nullable(),
  tradingCurrency: z.string(),
  taxWrapper: z.string().nullable(),
  eligibilityRules: jsonRecordSchema,
  restrictedAssets: z.array(z.string()),
  humanReadablePolicy: z.string(),
  noAutoTrade: z.boolean(),
  humanValidationRequired: z.boolean(),
})
export type InvestmentAccountPolicy = z.infer<typeof investmentAccountPolicySchema>

export const investmentAssetCandidateSchema = z.object({
  id: z.number(),
  symbol: z.string(),
  name: z.string(),
  assetClass: z.string(),
  bucket: investmentBucketKeySchema,
  accountTypesAllowed: z.array(investmentAccountTypeSchema),
  providerSymbols: z.record(z.string(), z.string()),
  isin: z.string().nullable(),
  exchange: z.string().nullable(),
  currency: z.string(),
  eligibilityStatus: investmentEligibilityStatusSchema,
  peaEligibilityStatus: investmentPeaEligibilityStatusSchema,
  riskLevel: investmentRiskLevelSchema,
  liquidityScore: z.number().nullable(),
  notes: z.string().nullable(),
  source: z.string(),
  userInterestLevel: investmentUserInterestLevelSchema,
  userIntent: investmentUserIntentSchema,
  iconUrl: z.string().nullable(),
  logoUrl: z.string().nullable(),
})
export type InvestmentAssetCandidate = z.infer<typeof investmentAssetCandidateSchema>

// --- Allocation ---------------------------------------------------------------

export const investmentHoldingSchema = z.object({
  provider: z.string(),
  accountId: z.string().nullable(),
  accountLabel: z.string().nullable(),
  accountType: investmentAccountTypeSchema,
  symbol: z.string().nullable(),
  name: z.string(),
  assetClass: z.string(),
  /** Null when the holding has no usable valuation; never 0. */
  value: z.number().nullable(),
  currency: z.string().nullable(),
  valueAsOf: z.string().nullable(),
  quantity: z.number().nullable(),
  bucket: z.union([investmentBucketKeySchema, z.literal(['cash', 'unknown'])]).optional(),
  valueSource: z.string().optional(),
  confidence: z
    .union([z.enum(['high', 'medium', 'low', 'unknown']), z.number()])
    .nullable()
    .optional(),
  degradedReasons: z.array(z.string()),
  assumptions: z.array(z.string()),
})
export type InvestmentHolding = z.infer<typeof investmentHoldingSchema>

export const investmentPriceFreshnessSchema = z.object({
  provider: z.string().nullable(),
  sourceType: z.string().nullable(),
  marketTimestamp: z.string().nullable(),
  fetchedAt: z.string().nullable(),
  delaySeconds: z.number().nullable(),
  ageSeconds: z.number().nullable(),
  isStale: z.boolean(),
  confidence: z.number(),
  currency: z.string().nullable(),
  /** Null when no price is known; never 0. */
  price: z.number().nullable(),
  staleReason: z.string().nullable(),
  providerHealth: z.string().nullable(),
  fallbackReason: z.string().nullable(),
})
export type InvestmentPriceFreshness = z.infer<typeof investmentPriceFreshnessSchema>

export const investmentDriftSchema = z.object({
  bucket: investmentBucketKeySchema,
  targetPct: z.number(),
  actualPct: z.number(),
  driftPct: z.number(),
  severity: investmentDriftSeveritySchema,
  recommendedContribution: z.number().nullable(),
  recommendedAction: z.string(),
})
export type InvestmentDrift = z.infer<typeof investmentDriftSchema>

export const investmentDataQualitySchema = z.object({
  status: investmentDataQualityStatusSchema,
  confidence: z.number(),
  /**
   * Value of the positions without a valuation. It is by definition unknown
   * (null) as soon as one such position exists; 0 only when every position is
   * valued. Use `unknownPositionCount` to size the gap.
   */
  unknownValue: z.number().nullable(),
  unknownPositionCount: z.number(),
  stalePositionCount: z.number(),
  missingPriceSymbols: z.array(z.string()),
  stalePriceSymbols: z.array(z.string()),
  providerWarnings: z.array(z.string()),
  fxWarnings: z.array(z.string()),
  graphWarnings: z.array(z.string()),
})
export type InvestmentDataQuality = z.infer<typeof investmentDataQualitySchema>

export const investmentAllocationSnapshotSchema = z.object({
  id: z.number().optional(),
  strategyId: z.number(),
  snapshotAt: z.string(),
  baseCurrency: z.string(),
  totalValue: z.number(),
  coreValue: z.number(),
  growthValue: z.number(),
  asymmetricValue: z.number(),
  cashValue: z.number(),
  unknownValue: z.number(),
  corePct: z.number(),
  growthPct: z.number(),
  asymmetricPct: z.number(),
  drift: z.array(investmentDriftSchema),
  dataQuality: investmentDataQualitySchema,
  holdings: z.array(investmentHoldingSchema),
})
export type InvestmentAllocationSnapshot = z.infer<typeof investmentAllocationSnapshotSchema>

export const investmentActionableStepSchema = z.object({
  type: investmentActionableStepTypeSchema,
  priority: investmentActionableStepPrioritySchema,
  accountLabel: z.string().optional(),
  bucket: investmentBucketKeySchema.optional(),
  amountValue: z.number().optional(),
  amountCurrency: z.string().optional(),
  message: z.string(),
  reason: z.string(),
  blockingReasons: z.array(z.string()).optional(),
})
export type InvestmentActionableStep = z.infer<typeof investmentActionableStepSchema>
