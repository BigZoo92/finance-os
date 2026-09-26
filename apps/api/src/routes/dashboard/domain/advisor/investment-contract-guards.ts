import type {
  InvestmentAccountType,
  InvestmentAction,
  InvestmentBucketKey,
  InvestmentEligibilityStatus,
  InvestmentPeaEligibilityStatus,
  InvestmentPriceability,
  InvestmentRecommendabilityStatus,
  InvestmentRecommendationMode,
  InvestmentRecommendationTier,
  InvestmentRiskLevel,
  InvestmentRiskProfile,
  InvestmentStrategyStatus,
  InvestmentUserIntent,
  InvestmentUserInterestLevel,
} from '@finance-os/api-contract/investments'
import type {
  AccountStrategyType,
  AdvisorActionPlanItemAction,
  AssetPriceabilityStatus,
  AssetRecommendabilityStatus,
  AssetRecommendationMode,
  AssetRecommendationTier,
  AssetUniverseEligibilityStatus,
  InvestmentBucketKey as DbInvestmentBucketKey,
  InvestmentRiskLevel as DbInvestmentRiskLevel,
  InvestmentRiskProfile as DbInvestmentRiskProfile,
  InvestmentStrategyStatus as DbInvestmentStrategyStatus,
  PeaEligibilityStatus,
  UserAssetIntent,
  UserAssetInterestLevel,
} from '@finance-os/db/schema'

/*
 * Compile-time guard: the shared transport enums in `@finance-os/api-contract`
 * mirror the DB schema unions. If either side drifts, `tsc` fails here.
 */
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false
type Guard<T extends true> = T

export type InvestmentContractGuards = [
  Guard<Same<DbInvestmentStrategyStatus, InvestmentStrategyStatus>>,
  Guard<Same<DbInvestmentRiskProfile, InvestmentRiskProfile>>,
  Guard<Same<DbInvestmentBucketKey, InvestmentBucketKey>>,
  Guard<Same<DbInvestmentRiskLevel, InvestmentRiskLevel>>,
  Guard<Same<AccountStrategyType, InvestmentAccountType>>,
  Guard<Same<AssetUniverseEligibilityStatus, InvestmentEligibilityStatus>>,
  Guard<Same<PeaEligibilityStatus, InvestmentPeaEligibilityStatus>>,
  Guard<Same<AssetPriceabilityStatus, InvestmentPriceability>>,
  Guard<Same<AssetRecommendabilityStatus, InvestmentRecommendabilityStatus>>,
  Guard<Same<UserAssetInterestLevel, InvestmentUserInterestLevel>>,
  Guard<Same<UserAssetIntent, InvestmentUserIntent>>,
  Guard<Same<AssetRecommendationTier, InvestmentRecommendationTier>>,
  Guard<Same<AssetRecommendationMode, InvestmentRecommendationMode>>,
  Guard<Same<AdvisorActionPlanItemAction, InvestmentAction>>,
]
