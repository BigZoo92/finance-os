import type {
  AccountStrategyType,
  AdvisorActionPlanItemAction,
  AssetUniverseEligibilityStatus,
  InvestmentBucketKey,
  InvestmentRiskLevel,
  InvestmentRiskProfile,
  PeaEligibilityStatus,
} from '@finance-os/db/schema'
import type { PriceSnapshotContract } from '../../services/valuation-foundation'
import { resolvePriceStaleness } from '../../services/valuation-foundation'

export const DEFAULT_STRATEGY_NAME = 'bigzoo_growth_60_30_10_v1'
export const DEFAULT_STRATEGY_VERSION = 'v1'
export const MIN_BUY_CONFIDENCE = 0.58

export type StrategyProfileDto = {
  id: number
  name: string
  version: string
  status: 'active' | 'draft' | 'archived'
  description: string
  riskProfile: InvestmentRiskProfile
  horizonYears: number
  baseCurrency: string
  monthlyContributionTarget: number | null
  rebalanceThresholdPct: number
  reviewFrequency: string
  noAutoTrade: boolean
  humanValidationRequired: boolean
  createdAt: string
  updatedAt: string
}

export type StrategyBucketDto = {
  id: number
  strategyId: number
  bucketKey: InvestmentBucketKey
  targetPct: number
  minPct: number
  maxPct: number
  riskLevel: InvestmentRiskLevel
  description: string
  defaultHorizon: string
  rules: Record<string, unknown>
}

export type AccountPolicyDto = {
  id: number
  strategyId: number
  accountId: string | null
  provider: string
  accountType: AccountStrategyType
  label: string
  allowedBuckets: InvestmentBucketKey[]
  preferredBucket: InvestmentBucketKey | null
  maxAllocationPct: number
  maxSingleAssetPct: number
  minOrderAmount: number | null
  tradingCurrency: string
  taxWrapper: string | null
  eligibilityRules: Record<string, unknown>
  restrictedAssets: string[]
  humanReadablePolicy: string
  noAutoTrade: boolean
  humanValidationRequired: boolean
}

export type AssetCandidateDto = {
  id: number
  symbol: string
  name: string
  assetClass: string
  bucket: InvestmentBucketKey
  accountTypesAllowed: AccountStrategyType[]
  providerSymbols: Record<string, string>
  isin: string | null
  exchange: string | null
  currency: string
  eligibilityStatus: AssetUniverseEligibilityStatus
  peaEligibilityStatus: PeaEligibilityStatus
  riskLevel: InvestmentRiskLevel
  liquidityScore: number | null
  notes: string | null
  source: string
}

export type StrategyBundle = {
  strategy: StrategyProfileDto
  buckets: StrategyBucketDto[]
  accountPolicies: AccountPolicyDto[]
  candidates: AssetCandidateDto[]
}

export type HoldingInput = {
  provider: string
  accountId: string | null
  accountLabel: string | null
  accountType: AccountStrategyType
  symbol: string | null
  name: string
  assetClass: string
  value: number | null
  currency: string | null
  valueAsOf: string | null
  quantity: number | null
  bucket?: InvestmentBucketKey | 'cash' | 'unknown'
  valueSource?: string
  confidence?: 'high' | 'medium' | 'low' | 'unknown' | number | null
  degradedReasons: string[]
  assumptions: string[]
}

export type PriceFreshness = {
  provider: string | null
  sourceType: string | null
  marketTimestamp: string | null
  fetchedAt: string | null
  delaySeconds: number | null
  ageSeconds: number | null
  isStale: boolean
  confidence: number
  currency: string | null
  price: number | null
  staleReason: string | null
  providerHealth: string | null
  fallbackReason: string | null
}

export type ReliablePriceResult = {
  status: 'fresh' | 'missing' | 'stale' | 'low_confidence'
  canBuy: boolean
  freshness: PriceFreshness
  priceSnapshotId: number | null
  warnings: string[]
}

export type AllocationSnapshotDto = {
  id?: number
  strategyId: number
  snapshotAt: string
  baseCurrency: string
  totalValue: number
  coreValue: number
  growthValue: number
  asymmetricValue: number
  cashValue: number
  unknownValue: number
  corePct: number
  growthPct: number
  asymmetricPct: number
  drift: DriftDto[]
  dataQuality: DataQualityDto
  holdings: HoldingInput[]
}

export type DriftDto = {
  bucket: InvestmentBucketKey
  targetPct: number
  actualPct: number
  driftPct: number
  severity: 'ok' | 'watch' | 'alert' | 'hard_limit'
  recommendedContribution: number | null
  recommendedAction: string
}

export type DataQualityDto = {
  status: 'ready' | 'degraded' | 'insufficient_data'
  confidence: number
  unknownValue: number
  unknownPositionCount: number
  stalePositionCount: number
  missingPriceSymbols: string[]
  stalePriceSymbols: string[]
  providerWarnings: string[]
  fxWarnings: string[]
  graphWarnings: string[]
}

export type ContributionRecommendation = {
  bucket: InvestmentBucketKey
  amount: number
  currency: string
  reason: string
}

export type RiskDecision = {
  allowed: boolean
  action: AdvisorActionPlanItemAction
  confidenceAdjustment: number
  reasons: string[]
}

export type ActionPlanItemDraft = {
  accountPolicyId: number | null
  accountLabel: string
  accountType: AccountStrategyType
  bucket: InvestmentBucketKey
  symbol: string | null
  assetName: string | null
  action: AdvisorActionPlanItemAction
  amountValue: number | null
  amountCurrency: string
  targetWeightPct: number | null
  currentWeightPct: number | null
  confidence: number
  riskLevel: InvestmentRiskLevel
  horizon: string
  thesis: string
  argumentsFor: string[]
  argumentsAgainst: string[]
  invalidationCriteria: string[]
  priceSnapshotId: number | null
  valuationSnapshotId: number | null
  dataFreshness: PriceFreshness
  humanValidationRequired: true
  noAutoTrade: true
  createsHypothesis: boolean
  score: number
}

export type ActionPlanDraft = {
  strategyId: number
  generatedAt: string
  status: 'active'
  summary: string
  globalRisk: InvestmentRiskLevel
  globalConfidence: number
  dataQualityStatus: DataQualityDto['status']
  noAutoTrade: true
  humanValidationRequired: true
  topActionIndex: number
  items: ActionPlanItemDraft[]
  allocation: AllocationSnapshotDto
  contribution: ContributionRecommendation[]
  warnings: string[]
}

export type HypothesisDraft = {
  itemIndex: number
  symbol: string
  accountScope: string
  direction: 'bullish' | 'bearish' | 'neutral' | 'defensive'
  actionSuggested: AdvisorActionPlanItemAction
  horizon: '1d' | '7d' | '30d' | 'long_term'
  probability: number
  confidence: number
  thesis: string
  supportingSignals: Array<Record<string, unknown>>
  contradictingSignals: Array<Record<string, unknown>>
  invalidationCriteria: Array<Record<string, unknown>>
  priceAtPrediction: number | null
  priceSnapshotId: number | null
  priceSource: string | null
  priceSourceType: string | null
  priceFreshness: PriceFreshness
  marketTimestamp: string | null
  fetchedAt: string | null
  reviewSchedule: Array<'J1' | 'J7' | 'J30'>
  outcomeReviews: Array<{ reviewHorizon: 'J1' | 'J7' | 'J30'; reviewDueAt: Date }>
}

export type OutcomeReviewInput = {
  outcomeId: number
  hypothesisId: number
  reviewHorizon: 'J1' | 'J7' | 'J30'
  reviewDueAt: Date
  symbol: string
  accountScope: string
  actionSuggested: AdvisorActionPlanItemAction
  direction: string
  probability: number | null
  confidence: number
  initialPrice: number | null
  reviewPrice: number | null
  benchmarkPrice: number | null
  priceStatus: ReliablePriceResult['status']
}

export type OutcomeScore = {
  outcomeId: number
  hypothesisId: number
  reviewedAt: Date | null
  reviewPrice: number | null
  benchmarkPrice: number | null
  performance: number | null
  performanceVsBenchmark: number | null
  result:
    | 'success'
    | 'failure'
    | 'mixed'
    | 'inconclusive'
    | 'skipped_stale_data'
    | 'skipped_missing_price'
  errorAttribution: string | null
  dataQualityNotes: string | null
  pricingFreshnessNotes: string | null
}

export type CalibrationSnapshotDraft = {
  strategyId: number
  generatedAt: string
  horizon: string
  sampleSize: number
  hitRate: number
  brierScore: number | null
  averageConfidence: number
  calibrationBuckets: Array<{
    range: string
    sampleSize: number
    averageConfidence: number
    hitRate: number
  }>
  byBucket: Record<string, unknown>
  byAccount: Record<string, unknown>
  byAssetClass: Record<string, unknown>
  notes: string | null
}

export type PostMortemDraft = {
  hypothesisId: number
  outcomeId: number
  result: string
  whatWorked: string[]
  whatFailed: string[]
  whyItWorkedOrFailed: string
  lesson: string
  futurePromptHint: string
  reusableRuleCandidate: string
  shouldUpdateStrategy: false
  requiresHumanReview: true
}

export const round = (value: number, digits = 2) => {
  if (!Number.isFinite(value)) return 0
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

export const toNumberOrNull = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const defaultBuckets = (strategyId: number): Omit<StrategyBucketDto, 'id'>[] => [
  {
    strategyId,
    bucketKey: 'core',
    targetPct: 60,
    minPct: 50,
    maxPct: 70,
    riskLevel: 'medium',
    description:
      'Base patrimoniale diversifiee, liquide, long terme. PEA prioritaire si eligibility confirmee.',
    defaultHorizon: 'long_term',
    rules: {
      role: 'stability_and_long_term_growth',
      preferPea: true,
      diversificationRequired: true,
      noBuyIfEligibilityUnknown: true,
    },
  },
  {
    strategyId,
    bucketKey: 'growth',
    targetPct: 30,
    minPct: 20,
    maxPct: 40,
    riskLevel: 'medium',
    description:
      'Rendement potentiel superieur via quality stocks, themes, secteurs et ETF specialises.',
    defaultHorizon: '30d_to_long_term',
    rules: {
      role: 'controlled_growth',
      diversificationRequired: true,
      avoidTechUsdSingleStockConcentration: true,
    },
  },
  {
    strategyId,
    bucketKey: 'asymmetric',
    targetPct: 10,
    minPct: 0,
    maxPct: 10,
    riskLevel: 'very_high',
    description:
      'Poche a risque eleve et potentiel eleve, principalement crypto, sans levier ni produits complexes.',
    defaultHorizon: '30d_to_long_term',
    rules: {
      role: 'high_risk_optional_upside',
      maxGlobalPct: 10,
      noLeverage: true,
      noMargin: true,
      majorAssetsPreferred: true,
    },
  },
]

export const defaultAccountPolicies = (strategyId: number): Omit<AccountPolicyDto, 'id'>[] => [
  {
    strategyId,
    accountId: null,
    provider: 'trade_republic',
    accountType: 'pea',
    label: 'PEA Trade Republic',
    allowedBuckets: ['core', 'growth'],
    preferredBucket: 'core',
    maxAllocationPct: 80,
    maxSingleAssetPct: 12,
    minOrderAmount: 10,
    tradingCurrency: 'EUR',
    taxWrapper: 'PEA',
    eligibilityRules: {
      requiresPeaEligibility: true,
      unknownEligibilityBlocksBuy: true,
      cryptoForbidden: true,
    },
    restrictedAssets: ['crypto', 'derivative', 'leveraged_product'],
    humanReadablePolicy:
      'PEA prioritaire pour le Core long terme et le Growth eligible. Si eligibility PEA inconnue, pas d achat: watch ou insufficient_data uniquement.',
    noAutoTrade: true,
    humanValidationRequired: true,
  },
  {
    strategyId,
    accountId: null,
    provider: 'ibkr',
    accountType: 'brokerage',
    label: 'IBKR',
    allowedBuckets: ['core', 'growth', 'asymmetric'],
    preferredBucket: 'growth',
    maxAllocationPct: 70,
    maxSingleAssetPct: 10,
    minOrderAmount: 25,
    tradingCurrency: 'EUR',
    taxWrapper: null,
    eligibilityRules: {
      noMargin: true,
      noLeverage: true,
      currencyRiskMustBeVisible: true,
      minOrderMustBeatFees: true,
    },
    restrictedAssets: ['leveraged_product', 'derivative', 'margin'],
    humanReadablePolicy:
      'IBKR sert la diversification mondiale et le growth maitrise. Les recommandations doivent rendre visibles frais, devise et concentration.',
    noAutoTrade: true,
    humanValidationRequired: true,
  },
  {
    strategyId,
    accountId: null,
    provider: 'binance',
    accountType: 'crypto',
    label: 'Binance',
    allowedBuckets: ['asymmetric'],
    preferredBucket: 'asymmetric',
    maxAllocationPct: 10,
    maxSingleAssetPct: 6,
    minOrderAmount: 15,
    tradingCurrency: 'EUR',
    taxWrapper: null,
    eligibilityRules: {
      cryptoMaxGlobalPct: 10,
      noFutures: true,
      noLeverage: true,
      stalePriceBlocksBuy: true,
      altcoinNeedsExplicitThesis: true,
    },
    restrictedAssets: ['futures', 'margin', 'leveraged_token', 'staking_lockup'],
    humanReadablePolicy:
      'Binance est limite a la poche Asymmetric. Si crypto >= 10% global, action hold/avoid/rebalance, jamais buy.',
    noAutoTrade: true,
    humanValidationRequired: true,
  },
]

export const defaultCandidateUniverse = (): Omit<AssetCandidateDto, 'id'>[] => [
  {
    symbol: 'CORE_ETF_REVIEW',
    name: 'ETF Core diversifie a approuver',
    assetClass: 'etf',
    bucket: 'core',
    accountTypesAllowed: ['pea', 'brokerage'],
    providerSymbols: {},
    isin: null,
    exchange: null,
    currency: 'EUR',
    eligibilityStatus: 'candidate_needs_review',
    peaEligibilityStatus: 'unknown',
    riskLevel: 'medium',
    liquidityScore: null,
    notes:
      'Placeholder de revue: ne devient achetable qu apres approbation manuelle et eligibility PEA verifiee.',
    source: 'default_seed_needs_review',
  },
  {
    symbol: 'GROWTH_REVIEW',
    name: 'Actif Growth de qualite a approuver',
    assetClass: 'equity_or_etf',
    bucket: 'growth',
    accountTypesAllowed: ['pea', 'brokerage'],
    providerSymbols: {},
    isin: null,
    exchange: null,
    currency: 'EUR',
    eligibilityStatus: 'candidate_needs_review',
    peaEligibilityStatus: 'unknown',
    riskLevel: 'medium',
    liquidityScore: null,
    notes:
      'Candidate non achetable tant que la these, la concentration et la source de prix ne sont pas validees.',
    source: 'default_seed_needs_review',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    assetClass: 'crypto',
    bucket: 'asymmetric',
    accountTypesAllowed: ['crypto'],
    providerSymbols: { binance: 'BTCEUR' },
    isin: null,
    exchange: 'binance_spot',
    currency: 'EUR',
    eligibilityStatus: 'candidate_needs_review',
    peaEligibilityStatus: 'not_applicable',
    riskLevel: 'very_high',
    liquidityScore: 0.8,
    notes:
      'Major crypto candidate. Buy bloque tant que non approuve, prix non frais ou poche crypto proche du cap.',
    source: 'default_seed_needs_review',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    assetClass: 'crypto',
    bucket: 'asymmetric',
    accountTypesAllowed: ['crypto'],
    providerSymbols: { binance: 'ETHEUR' },
    isin: null,
    exchange: 'binance_spot',
    currency: 'EUR',
    eligibilityStatus: 'candidate_needs_review',
    peaEligibilityStatus: 'not_applicable',
    riskLevel: 'very_high',
    liquidityScore: 0.75,
    notes:
      'Major crypto candidate. Buy bloque tant que non approuve, prix non frais ou poche crypto proche du cap.',
    source: 'default_seed_needs_review',
  },
]

export const validateStrategy = (buckets: Pick<StrategyBucketDto, 'bucketKey' | 'targetPct'>[]) => {
  const required: InvestmentBucketKey[] = ['core', 'growth', 'asymmetric']
  const missing = required.filter(bucket => !buckets.some(item => item.bucketKey === bucket))
  const total = round(
    buckets.reduce((sum, bucket) => sum + bucket.targetPct, 0),
    6
  )
  return {
    valid: missing.length === 0 && Math.abs(total - 100) < 0.000001,
    total,
    missing,
    errors: [
      ...(missing.length > 0 ? [`missing_buckets:${missing.join(',')}`] : []),
      ...(Math.abs(total - 100) >= 0.000001 ? [`bucket_total_${total}_not_100`] : []),
    ],
  }
}

export const classifyHoldingBucket = (
  holding: HoldingInput,
  candidates: AssetCandidateDto[]
): InvestmentBucketKey | 'cash' | 'unknown' => {
  if (holding.bucket) return holding.bucket
  const assetClass = holding.assetClass.toLowerCase()
  if (assetClass === 'cash' || assetClass === 'stablecoin') return 'cash'
  if (assetClass === 'crypto') return 'asymmetric'
  const symbol = holding.symbol?.toUpperCase()
  const candidate = symbol
    ? candidates.find(item => item.symbol.toUpperCase() === symbol)
    : null
  if (candidate) return candidate.bucket
  if (assetClass === 'etf' || assetClass === 'fund' || assetClass === 'bond') return 'core'
  if (assetClass === 'equity' || assetClass === 'stock') return 'growth'
  return 'unknown'
}

export const computeStrategyDrift = ({
  buckets,
  actualPct,
  monthlyContributionTarget,
  thresholdPct,
  currency,
}: {
  buckets: StrategyBucketDto[]
  actualPct: Record<InvestmentBucketKey, number>
  monthlyContributionTarget: number | null
  thresholdPct: number
  currency: string
}): DriftDto[] => {
  const underweights = buckets
    .map(bucket => ({
      bucket: bucket.bucketKey,
      gap: Math.max(0, bucket.targetPct - (actualPct[bucket.bucketKey] ?? 0)),
    }))
    .filter(item => item.gap > 0)
  const totalGap = underweights.reduce((sum, item) => sum + item.gap, 0)

  return buckets.map(bucket => {
    const actual = actualPct[bucket.bucketKey] ?? 0
    const drift = round(actual - bucket.targetPct, 2)
    const abs = Math.abs(drift)
    const underweight = underweights.find(item => item.bucket === bucket.bucketKey)
    const contribution =
      monthlyContributionTarget && underweight && totalGap > 0
        ? round(monthlyContributionTarget * (underweight.gap / totalGap), 2)
        : null
    const severity =
      abs >= Math.max(thresholdPct * 2, 10)
        ? 'hard_limit'
        : abs >= thresholdPct
          ? 'alert'
          : abs >= thresholdPct / 2
            ? 'watch'
            : 'ok'
    return {
      bucket: bucket.bucketKey,
      targetPct: bucket.targetPct,
      actualPct: round(actual, 2),
      driftPct: drift,
      severity,
      recommendedContribution: contribution,
      recommendedAction:
        contribution && contribution > 0
          ? `Allouer ${contribution} ${currency} de nouvel apport vers ${bucket.bucketKey}.`
          : abs >= thresholdPct
            ? `Surveiller la derive ${bucket.bucketKey}; privilegier les apports avant toute vente.`
            : `Pas de rebalancing requis pour ${bucket.bucketKey}.`,
    }
  })
}

export const classifyDataQuality = ({
  holdings,
  totalKnownValue,
  priceWarnings,
  fxWarnings = [],
  graphWarnings = [],
}: {
  holdings: HoldingInput[]
  totalKnownValue: number
  priceWarnings: { missing: string[]; stale: string[] }
  fxWarnings?: string[]
  graphWarnings?: string[]
}): DataQualityDto => {
  const unknownPositions = holdings.filter(holding => holding.value === null)
  const degraded = holdings.flatMap(holding => holding.degradedReasons)
  const stalePositions = holdings.filter(holding => {
    if (!holding.valueAsOf) return true
    const valueDate = new Date(holding.valueAsOf)
    return Number.isNaN(valueDate.getTime())
      ? true
      : Date.now() - valueDate.getTime() > 36 * 60 * 60 * 1000
  })
  const warningCount =
    unknownPositions.length +
    stalePositions.length +
    degraded.length +
    priceWarnings.missing.length +
    priceWarnings.stale.length +
    fxWarnings.length +
    graphWarnings.length
  const confidence =
    totalKnownValue <= 0
      ? 0.2
      : Math.max(0.15, Math.min(0.95, 0.9 - Math.min(0.55, warningCount * 0.06)))
  return {
    status:
      totalKnownValue <= 0 || unknownPositions.length >= holdings.length
        ? 'insufficient_data'
        : warningCount > 0
          ? 'degraded'
          : 'ready',
    confidence: round(confidence, 2),
    unknownValue: round(
      unknownPositions.reduce((sum, holding) => sum + (holding.value ?? 0), 0),
      2
    ),
    unknownPositionCount: unknownPositions.length,
    stalePositionCount: stalePositions.length,
    missingPriceSymbols: [...new Set(priceWarnings.missing)].slice(0, 20),
    stalePriceSymbols: [...new Set(priceWarnings.stale)].slice(0, 20),
    providerWarnings: [...new Set(degraded)].slice(0, 20),
    fxWarnings: fxWarnings.slice(0, 20),
    graphWarnings: graphWarnings.slice(0, 20),
  }
}

export const computePortfolioAllocation = ({
  strategy,
  buckets,
  candidates,
  holdings,
  now = new Date(),
}: {
  strategy: StrategyProfileDto
  buckets: StrategyBucketDto[]
  candidates: AssetCandidateDto[]
  holdings: HoldingInput[]
  now?: Date
}): AllocationSnapshotDto => {
  let coreValue = 0
  let growthValue = 0
  let asymmetricValue = 0
  let cashValue = 0
  let unknownValue = 0
  for (const holding of holdings) {
    const value = holding.value
    const bucket = classifyHoldingBucket(holding, candidates)
    if (value === null || bucket === 'unknown') {
      unknownValue += value ?? 0
      continue
    }
    if (bucket === 'cash') cashValue += value
    if (bucket === 'core') coreValue += value
    if (bucket === 'growth') growthValue += value
    if (bucket === 'asymmetric') asymmetricValue += value
  }
  const totalValue = coreValue + growthValue + asymmetricValue + cashValue + unknownValue
  const pct = (value: number) => (totalValue > 0 ? round((value / totalValue) * 100, 2) : 0)
  const actualPct = {
    core: pct(coreValue),
    growth: pct(growthValue),
    asymmetric: pct(asymmetricValue),
  }
  const drift = computeStrategyDrift({
    buckets,
    actualPct,
    monthlyContributionTarget: strategy.monthlyContributionTarget,
    thresholdPct: strategy.rebalanceThresholdPct,
    currency: strategy.baseCurrency,
  })
  const dataQuality = classifyDataQuality({
    holdings,
    totalKnownValue: totalValue - unknownValue,
    priceWarnings: { missing: [], stale: [] },
  })
  return {
    strategyId: strategy.id,
    snapshotAt: now.toISOString(),
    baseCurrency: strategy.baseCurrency,
    totalValue: round(totalValue, 2),
    coreValue: round(coreValue, 2),
    growthValue: round(growthValue, 2),
    asymmetricValue: round(asymmetricValue, 2),
    cashValue: round(cashValue, 2),
    unknownValue: round(unknownValue, 2),
    corePct: actualPct.core,
    growthPct: actualPct.growth,
    asymmetricPct: actualPct.asymmetric,
    drift,
    dataQuality,
    holdings,
  }
}

export const allocateContribution = ({
  strategy,
  allocation,
}: {
  strategy: StrategyProfileDto
  allocation: AllocationSnapshotDto
}): ContributionRecommendation[] => {
  const contribution = strategy.monthlyContributionTarget ?? 0
  if (contribution <= 0) return []
  const underweight = allocation.drift
    .filter(item => item.driftPct < 0)
    .sort((left, right) => left.driftPct - right.driftPct)
  const totalGap = underweight.reduce((sum, item) => sum + Math.abs(item.driftPct), 0)
  if (totalGap <= 0) {
    return [
      {
        bucket: 'core',
        amount: round(contribution, 2),
        currency: allocation.baseCurrency,
        reason: 'Aucune poche sous-ponderee: apport par defaut vers Core pour limiter le risque.',
      },
    ]
  }
  return underweight.map(item => ({
    bucket: item.bucket,
    amount: round(contribution * (Math.abs(item.driftPct) / totalGap), 2),
    currency: allocation.baseCurrency,
    reason: `Corrige une sous-ponderation de ${Math.abs(item.driftPct).toFixed(1)} points sans vendre.`,
  }))
}

export const getReliablePriceForRecommendation = ({
  snapshot,
  providerHealth = null,
  now = new Date(),
}: {
  snapshot: (PriceSnapshotContract & { id?: number | null; staleReason?: string | null }) | null
  providerHealth?: string | null
  now?: Date
}): ReliablePriceResult => {
  if (!snapshot) {
    return {
      status: 'missing',
      canBuy: false,
      priceSnapshotId: null,
      warnings: ['missing_price'],
      freshness: {
        provider: null,
        sourceType: null,
        marketTimestamp: null,
        fetchedAt: null,
        delaySeconds: null,
        ageSeconds: null,
        isStale: true,
        confidence: 0,
        currency: null,
        price: null,
        staleReason: 'missing_price',
        providerHealth,
        fallbackReason: null,
      },
    }
  }
  const stale = resolvePriceStaleness({ snapshot, now })
  const snapshotMarkedStale =
    'isStale' in snapshot && typeof snapshot.isStale === 'boolean' ? snapshot.isStale : false
  const status =
    stale.isStale || snapshotMarkedStale
      ? 'stale'
      : snapshot.confidence < MIN_BUY_CONFIDENCE
        ? 'low_confidence'
        : 'fresh'
  const warnings = [
    ...(status === 'stale' ? [stale.staleReason ?? snapshot.staleReason ?? 'stale_price'] : []),
    ...(status === 'low_confidence' ? ['low_price_confidence'] : []),
  ]
  return {
    status,
    canBuy: status === 'fresh',
    priceSnapshotId: snapshot.id ?? null,
    warnings,
    freshness: {
      provider: snapshot.provider,
      sourceType: snapshot.sourceType,
      marketTimestamp: snapshot.marketTimestamp,
      fetchedAt: snapshot.fetchedAt,
      delaySeconds: snapshot.delaySeconds,
      ageSeconds: stale.ageSeconds,
      isStale: status === 'stale',
      confidence: snapshot.confidence,
      currency: snapshot.currency,
      price: snapshot.price,
      staleReason: warnings[0] ?? null,
      providerHealth,
      fallbackReason: snapshot.sourceType === 'fallback' ? 'fallback_price_source' : null,
    },
  }
}

export const enforceRiskPolicy = ({
  policy,
  candidate,
  allocation,
  price,
  bucket,
  proposedAmount,
}: {
  policy: AccountPolicyDto
  candidate: AssetCandidateDto | null
  allocation: AllocationSnapshotDto
  price: ReliablePriceResult
  bucket: InvestmentBucketKey
  proposedAmount: number | null
}): RiskDecision => {
  const reasons: string[] = []
  let allowed = true
  let confidenceAdjustment = 0

  if (!policy.allowedBuckets.includes(bucket)) {
    allowed = false
    reasons.push(`Poche ${bucket} non autorisee pour ${policy.label}.`)
  }
  if (!price.canBuy) {
    allowed = false
    confidenceAdjustment -= 0.25
    reasons.push(
      price.status === 'missing'
        ? 'Prix manquant: achat interdit.'
        : price.status === 'stale'
          ? 'Prix stale: achat interdit.'
          : 'Confiance prix trop faible: achat interdit.'
    )
  }
  if (!candidate) {
    allowed = false
    reasons.push('Aucun actif approuve dans cet univers pour cette poche.')
  } else {
    if (candidate.eligibilityStatus !== 'approved') {
      allowed = false
      reasons.push(`Actif ${candidate.symbol} non approuve (${candidate.eligibilityStatus}).`)
    }
    if (policy.accountType === 'pea' && candidate.peaEligibilityStatus !== 'eligible') {
      allowed = false
      reasons.push(
        candidate.peaEligibilityStatus === 'unknown'
          ? 'Eligibility PEA inconnue: achat interdit.'
          : 'Actif non eligible PEA: achat interdit.'
      )
    }
    if (policy.accountType === 'pea' && candidate.assetClass.toLowerCase() === 'crypto') {
      allowed = false
      reasons.push('Crypto interdite dans la politique PEA.')
    }
  }
  if (policy.accountType === 'crypto' && allocation.asymmetricPct >= 10) {
    allowed = false
    reasons.push('Poche crypto/asymmetric deja au cap global de 10%.')
  }
  if (proposedAmount !== null && policy.minOrderAmount !== null && proposedAmount < policy.minOrderAmount) {
    allowed = false
    reasons.push(`Montant sous le minimum d ordre (${policy.minOrderAmount} ${policy.tradingCurrency}).`)
  }
  return {
    allowed,
    action: allowed ? 'buy' : candidate ? 'watch' : 'insufficient_data',
    confidenceAdjustment,
    reasons,
  }
}

export const selectCandidateForPolicy = ({
  candidates,
  policy,
  bucket,
}: {
  candidates: AssetCandidateDto[]
  policy: AccountPolicyDto
  bucket: InvestmentBucketKey
}) => {
  const eligible = candidates.filter(
    candidate =>
      candidate.bucket === bucket &&
      candidate.accountTypesAllowed.includes(policy.accountType) &&
      candidate.eligibilityStatus === 'approved' &&
      (policy.accountType !== 'pea' || candidate.peaEligibilityStatus === 'eligible')
  )
  if (eligible.length > 0) {
    return eligible.sort((left, right) => (right.liquidityScore ?? 0) - (left.liquidityScore ?? 0))[0] ?? null
  }
  return (
    candidates.find(
      candidate =>
        candidate.bucket === bucket && candidate.accountTypesAllowed.includes(policy.accountType)
    ) ?? null
  )
}

export const buildActionPlanDraft = ({
  bundle,
  allocation,
  latestPrices,
  providerHealthByProvider = {},
  now = new Date(),
}: {
  bundle: StrategyBundle
  allocation: AllocationSnapshotDto
  latestPrices: Record<string, (PriceSnapshotContract & { id?: number | null }) | null>
  providerHealthByProvider?: Record<string, string | null>
  now?: Date
}): ActionPlanDraft => {
  const contribution = allocateContribution({ strategy: bundle.strategy, allocation })
  const items: ActionPlanItemDraft[] = bundle.accountPolicies.map(policy => {
    const targetBucket = policy.preferredBucket ?? policy.allowedBuckets[0] ?? 'core'
    const contributionForBucket =
      contribution.find(item => item.bucket === targetBucket) ??
      contribution.find(item => policy.allowedBuckets.includes(item.bucket)) ??
      null
    const candidate = selectCandidateForPolicy({
      candidates: bundle.candidates,
      policy,
      bucket: targetBucket,
    })
    const priceSymbol = candidate?.providerSymbols[policy.provider] ?? candidate?.symbol ?? null
    const price = getReliablePriceForRecommendation({
      snapshot: priceSymbol ? (latestPrices[priceSymbol] ?? latestPrices[candidate?.symbol ?? ''] ?? null) : null,
      providerHealth: providerHealthByProvider[policy.provider] ?? null,
      now,
    })
    const amount = contributionForBucket?.amount ?? null
    const risk = enforceRiskPolicy({
      policy,
      candidate,
      allocation,
      price,
      bucket: targetBucket,
      proposedAmount: amount,
    })
    const baseConfidence = Math.min(
      0.88,
      Math.max(0.18, allocation.dataQuality.confidence * (candidate?.eligibilityStatus === 'approved' ? 0.95 : 0.62))
    )
    const confidence = round(Math.max(0, Math.min(1, baseConfidence + risk.confidenceAdjustment)), 2)
    const action =
      confidence < MIN_BUY_CONFIDENCE && risk.allowed
        ? 'watch'
        : risk.allowed
          ? 'buy'
          : risk.action
    const blockedReasons = [
      ...risk.reasons,
      ...(confidence < MIN_BUY_CONFIDENCE ? ['Confiance sous le seuil minimal: achat interdit.'] : []),
    ]
    const canCreateHypothesis = action === 'buy' || action === 'rebalance' || action === 'watch'
    return {
      accountPolicyId: policy.id,
      accountLabel: policy.label,
      accountType: policy.accountType,
      bucket: targetBucket,
      symbol: action === 'insufficient_data' ? null : (candidate?.symbol ?? null),
      assetName: action === 'insufficient_data' ? null : (candidate?.name ?? null),
      action: action === 'buy' && confidence < MIN_BUY_CONFIDENCE ? 'watch' : action,
      amountValue: action === 'buy' ? amount : null,
      amountCurrency: policy.tradingCurrency,
      targetWeightPct:
        bundle.buckets.find(bucket => bucket.bucketKey === targetBucket)?.targetPct ?? null,
      currentWeightPct:
        targetBucket === 'core'
          ? allocation.corePct
          : targetBucket === 'growth'
            ? allocation.growthPct
            : allocation.asymmetricPct,
      confidence,
      riskLevel: candidate?.riskLevel ?? (targetBucket === 'asymmetric' ? 'very_high' : 'medium'),
      horizon:
        bundle.buckets.find(bucket => bucket.bucketKey === targetBucket)?.defaultHorizon ??
        'long_term',
      thesis:
        action === 'buy'
          ? `Apport manuel vers ${targetBucket} via ${policy.label}, car la poche est prioritaire et les garde-fous sont satisfaits.`
          : blockedReasons.length > 0
            ? `Ne pas acheter pour l instant sur ${policy.label}: ${blockedReasons[0]}`
            : `Surveiller ${policy.label} en attendant une donnee plus fiable.`,
      argumentsFor: [
        policy.humanReadablePolicy,
        ...(contributionForBucket
          ? [contributionForBucket.reason]
          : ['Aucun apport mensuel cible configure ou poche non prioritaire.']),
      ],
      argumentsAgainst:
        blockedReasons.length > 0
          ? blockedReasons
          : ['Projection indicative: rendement futur non garanti.'],
      invalidationCriteria: [
        'Prix stale, manquant ou confidence provider sous le seuil.',
        'Changement de cap allocation, devise, concentration ou eligibility.',
        'Decision humaine contraire ou budget mensuel indisponible.',
      ],
      priceSnapshotId: price.priceSnapshotId,
      valuationSnapshotId: null,
      dataFreshness: price.freshness,
      humanValidationRequired: true,
      noAutoTrade: true,
      createsHypothesis: canCreateHypothesis && candidate !== null,
      score:
        (action === 'buy' ? 30 : action === 'watch' ? 18 : action === 'contribute_cash' ? 20 : 8) +
        confidence * 40 -
        blockedReasons.length * 6,
    }
  })

  const sorted = items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => right.item.score - left.item.score)
  const topActionIndex = sorted[0]?.index ?? 0
  const buyCount = items.filter(item => item.action === 'buy').length
  const summary =
    buyCount > 0
      ? `${buyCount} action(s) achetables sous validation humaine; aucun ordre automatique.`
      : 'Aucun achat force: donnees, eligibility ou univers approuve insuffisants. Priorite a la configuration et aux apports prudents.'
  const globalConfidence = round(
    items.length > 0 ? items.reduce((sum, item) => sum + item.confidence, 0) / items.length : 0,
    2
  )
  return {
    strategyId: bundle.strategy.id,
    generatedAt: now.toISOString(),
    status: 'active',
    summary,
    globalRisk: items.some(item => item.riskLevel === 'very_high') ? 'high' : 'medium',
    globalConfidence,
    dataQualityStatus: allocation.dataQuality.status,
    noAutoTrade: true,
    humanValidationRequired: true,
    topActionIndex,
    items,
    allocation,
    contribution,
    warnings: [
      ...allocation.dataQuality.providerWarnings,
      ...allocation.dataQuality.missingPriceSymbols.map(symbol => `missing_price:${symbol}`),
      ...allocation.dataQuality.stalePriceSymbols.map(symbol => `stale_price:${symbol}`),
      ...(items.every(item => item.action !== 'buy') ? ['no_safe_buy_action'] : []),
    ],
  }
}

export const buildHypothesisDrafts = ({
  plan,
  planItemIds,
  now = new Date(),
}: {
  plan: ActionPlanDraft
  planItemIds?: number[]
  now?: Date
}): HypothesisDraft[] =>
  plan.items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => item.createsHypothesis && item.symbol)
    .map(({ item, index }) => {
      const probability = round(Math.max(0.5, Math.min(0.9, item.confidence)), 2)
      const reviewSchedule: Array<'J1' | 'J7' | 'J30'> = ['J1', 'J7', 'J30']
      return {
        itemIndex: planItemIds?.[index] ?? index,
        symbol: item.symbol ?? 'UNKNOWN',
        accountScope: item.accountLabel,
        direction:
          item.action === 'buy'
            ? 'bullish'
            : item.action === 'avoid'
              ? 'defensive'
              : item.action === 'rebalance'
                ? 'neutral'
                : 'neutral',
        actionSuggested: item.action,
        horizon: item.horizon.includes('30') ? '30d' : item.horizon.includes('7') ? '7d' : '1d',
        probability,
        confidence: item.confidence,
        thesis: item.thesis,
        supportingSignals: item.argumentsFor.map(reason => ({ reason })),
        contradictingSignals: item.argumentsAgainst.map(reason => ({ reason })),
        invalidationCriteria: item.invalidationCriteria.map(reason => ({ reason })),
        priceAtPrediction: item.dataFreshness.price,
        priceSnapshotId: item.priceSnapshotId,
        priceSource: item.dataFreshness.provider,
        priceSourceType: item.dataFreshness.sourceType,
        priceFreshness: item.dataFreshness,
        marketTimestamp: item.dataFreshness.marketTimestamp,
        fetchedAt: item.dataFreshness.fetchedAt,
        reviewSchedule,
        outcomeReviews: [
          { reviewHorizon: 'J1', reviewDueAt: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
          { reviewHorizon: 'J7', reviewDueAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          { reviewHorizon: 'J30', reviewDueAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) },
        ],
      }
    })

export const scoreOutcome = (input: OutcomeReviewInput): OutcomeScore => {
  if (input.priceStatus === 'missing' || input.reviewPrice === null || input.initialPrice === null) {
    return {
      outcomeId: input.outcomeId,
      hypothesisId: input.hypothesisId,
      reviewedAt: null,
      reviewPrice: input.reviewPrice,
      benchmarkPrice: input.benchmarkPrice,
      performance: null,
      performanceVsBenchmark: null,
      result: 'skipped_missing_price',
      errorAttribution: 'missing_price',
      dataQualityNotes: 'Review skipped because price was missing.',
      pricingFreshnessNotes: 'No reliable review price.',
    }
  }
  if (input.priceStatus === 'stale') {
    return {
      outcomeId: input.outcomeId,
      hypothesisId: input.hypothesisId,
      reviewedAt: null,
      reviewPrice: input.reviewPrice,
      benchmarkPrice: input.benchmarkPrice,
      performance: null,
      performanceVsBenchmark: null,
      result: 'skipped_stale_data',
      errorAttribution: 'stale_price',
      dataQualityNotes: 'Review skipped because price was stale.',
      pricingFreshnessNotes: 'Stale review price.',
    }
  }
  const performance = (input.reviewPrice - input.initialPrice) / input.initialPrice
  const benchmarkPerformance =
    input.benchmarkPrice && input.benchmarkPrice > 0
      ? (input.reviewPrice - input.benchmarkPrice) / input.benchmarkPrice
      : null
  const performanceVsBenchmark =
    benchmarkPerformance === null ? null : performance - benchmarkPerformance
  const expectedPositive =
    input.direction === 'bullish' ||
    input.actionSuggested === 'buy' ||
    input.actionSuggested === 'rebalance'
  const success = expectedPositive ? performance >= 0 : performance <= 0
  const mixed =
    performanceVsBenchmark !== null &&
    ((success && performanceVsBenchmark < 0) || (!success && performanceVsBenchmark > 0))
  return {
    outcomeId: input.outcomeId,
    hypothesisId: input.hypothesisId,
    reviewedAt: new Date(),
    reviewPrice: input.reviewPrice,
    benchmarkPrice: input.benchmarkPrice,
    performance: round(performance, 6),
    performanceVsBenchmark:
      performanceVsBenchmark === null ? null : round(performanceVsBenchmark, 6),
    result: mixed ? 'mixed' : success ? 'success' : 'failure',
    errorAttribution: success ? null : 'direction_or_timing_error',
    dataQualityNotes: 'Reviewed with reliable persisted price snapshot.',
    pricingFreshnessNotes: `price_status:${input.priceStatus}`,
  }
}

const confidenceBucket = (confidence: number) => {
  const pct = confidence <= 1 ? confidence * 100 : confidence
  if (pct < 60) return '50-60'
  if (pct < 70) return '60-70'
  if (pct < 80) return '70-80'
  if (pct < 90) return '80-90'
  return '90-100'
}

export const buildCalibrationSnapshot = ({
  strategyId,
  outcomes,
  generatedAt = new Date(),
  horizon = 'all',
}: {
  strategyId: number
  outcomes: Array<{ result: string; confidence: number; probability: number | null }>
  generatedAt?: Date
  horizon?: string
}): CalibrationSnapshotDraft => {
  const scored = outcomes.filter(item => ['success', 'failure', 'mixed'].includes(item.result))
  const sampleSize = scored.length
  const successes = scored.filter(item => item.result === 'success').length
  const hitRate = sampleSize > 0 ? successes / sampleSize : 0
  const brier =
    sampleSize > 0
      ? scored.reduce((sum, item) => {
          const p = item.probability ?? item.confidence
          const y = item.result === 'success' ? 1 : 0
          return sum + (p - y) ** 2
        }, 0) / sampleSize
      : null
  const byBucket = new Map<string, typeof scored>()
  for (const item of scored) {
    const key = confidenceBucket(item.confidence)
    byBucket.set(key, [...(byBucket.get(key) ?? []), item])
  }
  const calibrationBuckets = ['50-60', '60-70', '70-80', '80-90', '90-100'].map(range => {
    const entries = byBucket.get(range) ?? []
    return {
      range,
      sampleSize: entries.length,
      averageConfidence:
        entries.length > 0
          ? round(entries.reduce((sum, item) => sum + item.confidence, 0) / entries.length, 2)
          : 0,
      hitRate:
        entries.length > 0
          ? round(entries.filter(item => item.result === 'success').length / entries.length, 2)
          : 0,
    }
  })
  return {
    strategyId,
    generatedAt: generatedAt.toISOString(),
    horizon,
    sampleSize,
    hitRate: round(hitRate, 4),
    brierScore: brier === null ? null : round(brier, 6),
    averageConfidence:
      sampleSize > 0
        ? round(scored.reduce((sum, item) => sum + item.confidence, 0) / sampleSize, 2)
        : 0,
    calibrationBuckets,
    byBucket: {},
    byAccount: {},
    byAssetClass: {},
    notes:
      sampleSize < 10
        ? 'Sample size too small for strong calibration claims; use as weak signal only.'
        : null,
  }
}

export const buildPostMortemFallback = ({
  hypothesisId,
  outcomeId,
  outcome,
  thesis,
}: {
  hypothesisId: number
  outcomeId: number
  outcome: OutcomeScore
  thesis: string
}): PostMortemDraft => {
  const result = outcome.result
  const successful = result === 'success'
  return {
    hypothesisId,
    outcomeId,
    result,
    whatWorked: successful
      ? ['La direction realisee est coherente avec la these initiale.']
      : [],
    whatFailed: successful
      ? []
      : ['La performance realisee ne valide pas clairement la these initiale.'],
    whyItWorkedOrFailed:
      outcome.performance === null
        ? 'Donnees insuffisantes: le post-mortem reste deterministe et faible autorite.'
        : `These: ${thesis}. Performance realisee: ${round(outcome.performance * 100, 2)}%.`,
    lesson: successful
      ? 'Conserver la prudence: un succes ponctuel ne suffit pas a augmenter fortement la confiance.'
      : 'Baisser la confiance quand la these depend de donnees incompletes, stale ou sans benchmark robuste.',
    futurePromptHint:
      'Toujours citer prix initial, prix de revue, benchmark disponible et fraicheur avant de conclure.',
    reusableRuleCandidate: successful
      ? 'Ne pas surponderer un signal gagnant sans repetition et calibration.'
      : 'Si donnees de prix ou eligibility sont faibles, preferer watch/insufficient_data.',
    shouldUpdateStrategy: false,
    requiresHumanReview: true,
  }
}

export const createMemoryPayload = (eventType: string, payload: Record<string, unknown>) => ({
  eventType,
  payload: {
    ...payload,
    advisoryOnly: true,
    noAutoTrade: true,
    redaction: 'secret_safe_compact_payload',
  },
})
