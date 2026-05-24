import type { PriceSourceType } from '@finance-os/db/schema'
import type { InvestmentStrategyRepository } from '../../repositories/investment-strategy-repository'
import type { PriceSnapshotContract } from '../../services/valuation-foundation'
import type { InvestmentPositionRow } from '../../types'
import {
  type AccountPolicyDto,
  type ActionPlanDraft,
  type AllocationSnapshotDto,
  type AssetCandidateDto,
  buildActionPlanDraft,
  buildCalibrationSnapshot,
  buildHypothesisDrafts,
  buildInvestmentActionableSteps,
  buildPostMortemFallback,
  computePortfolioAllocation,
  createMemoryPayload,
  DEFAULT_STRATEGY_NAME,
  DEFAULT_STRATEGY_VERSION,
  defaultAccountPolicies,
  defaultBuckets,
  defaultCandidateUniverse,
  normalizeAssetSymbol,
  getReliablePriceForRecommendation,
  type HoldingInput,
  type InvestmentActionableStep,
  type StrategyBucketDto,
  type StrategyBundle,
  type StrategyProfileDto,
  scoreOutcome,
  toNumberOrNull,
  validateStrategy,
} from './investment-strategy-engine'

type Mode = 'demo' | 'admin'

type ExternalPositionRow = Record<string, unknown>

export type InvestmentStrategyUpdateInput = {
  monthlyContributionTarget?: number | null
  rebalanceThresholdPct?: number
  horizonYears?: number
  riskProfile?: 'conservative' | 'balanced' | 'growth' | 'aggressive' | 'custom'
  description?: string
}

export type GenerateActionPlanInput = {
  mode: Mode
  requestId: string
  triggerSource: string
  dryRun?: boolean
}

export type AssetSearchInput = {
  mode: Mode
  requestId: string
  query: string
}

export type WatchlistAssetInput = {
  symbol: string
  name: string
  assetClass: string
  providerSymbols?: Record<string, string>
  iconUrl?: string | null
  logoUrl?: string | null
  isin?: string | null
  exchange?: string | null
  currency: string
  userInterestLevel?: 'none' | 'watching' | 'interested' | 'high_interest'
  userIntent?: 'watch' | 'analyze' | 'compare' | 'consider_buy' | 'exclude'
  note?: string | null
}

export type WatchlistAssetPatchInput = Partial<
  Pick<
    WatchlistAssetInput,
    | 'name'
    | 'assetClass'
    | 'providerSymbols'
    | 'iconUrl'
    | 'logoUrl'
    | 'isin'
    | 'exchange'
    | 'currency'
    | 'userInterestLevel'
    | 'userIntent'
    | 'note'
  >
>

export type ReviewDueInput = {
  mode: Mode
  requestId: string
  triggerSource: string
  dryRun?: boolean
  limit?: number
}

export type InvestmentStrategyUseCaseDeps = {
  repository: InvestmentStrategyRepository
  listExternalPositions: () => Promise<ExternalPositionRow[]>
  listPowensInvestmentPositions: () => Promise<InvestmentPositionRow[]>
  knowledgeConfig: {
    enabled: boolean
    url: string
    timeoutMs: number
  }
  advisorGraphIngestEnabled: boolean
}

const toIso = (value: Date | string | null | undefined) => {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

const toJsonRecord = (value: unknown): Record<string, unknown> => {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>
  }
  return {}
}

const toStringArray = (value: unknown): string[] =>
  Array.isArray(value) ? value.map(String).filter(Boolean) : []

const toBucketArray = (value: unknown): Array<'core' | 'growth' | 'asymmetric'> =>
  Array.isArray(value)
    ? value.filter(
        (item): item is 'core' | 'growth' | 'asymmetric' =>
          item === 'core' || item === 'growth' || item === 'asymmetric'
      )
    : []

const toAccountTypeArray = (
  value: unknown
): Array<'pea' | 'brokerage' | 'crypto' | 'cash' | 'unknown'> =>
  Array.isArray(value)
    ? value.filter(
        (item): item is 'pea' | 'brokerage' | 'crypto' | 'cash' | 'unknown' =>
          item === 'pea' ||
          item === 'brokerage' ||
          item === 'crypto' ||
          item === 'cash' ||
          item === 'unknown'
      )
    : []

const mapStrategyRow = (row: {
  id: number
  name: string
  version: string
  status: string
  description: string
  riskProfile: string
  horizonYears: number
  baseCurrency: string
  monthlyContributionTarget: string | null
  rebalanceThresholdPct: number
  reviewFrequency: string
  noAutoTrade: boolean
  humanValidationRequired: boolean
  createdAt: Date
  updatedAt: Date
}): StrategyProfileDto => ({
  id: row.id,
  name: row.name,
  version: row.version,
  status:
    row.status === 'active' || row.status === 'draft' || row.status === 'archived'
      ? row.status
      : 'draft',
  description: row.description,
  riskProfile:
    row.riskProfile === 'conservative' ||
    row.riskProfile === 'balanced' ||
    row.riskProfile === 'growth' ||
    row.riskProfile === 'aggressive' ||
    row.riskProfile === 'custom'
      ? row.riskProfile
      : 'growth',
  horizonYears: row.horizonYears,
  baseCurrency: row.baseCurrency,
  monthlyContributionTarget: toNumberOrNull(row.monthlyContributionTarget),
  rebalanceThresholdPct: row.rebalanceThresholdPct,
  reviewFrequency: row.reviewFrequency,
  noAutoTrade: row.noAutoTrade,
  humanValidationRequired: row.humanValidationRequired,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
})

const mapBucketRow = (row: {
  id: number
  strategyId: number
  bucketKey: string
  targetPct: number
  minPct: number
  maxPct: number
  riskLevel: string
  description: string
  defaultHorizon: string
  rulesJson: Record<string, unknown>
}): StrategyBucketDto => ({
  id: row.id,
  strategyId: row.strategyId,
  bucketKey:
    row.bucketKey === 'core' || row.bucketKey === 'growth' || row.bucketKey === 'asymmetric'
      ? row.bucketKey
      : 'core',
  targetPct: row.targetPct,
  minPct: row.minPct,
  maxPct: row.maxPct,
  riskLevel:
    row.riskLevel === 'low' ||
    row.riskLevel === 'medium' ||
    row.riskLevel === 'high' ||
    row.riskLevel === 'very_high'
      ? row.riskLevel
      : 'medium',
  description: row.description,
  defaultHorizon: row.defaultHorizon,
  rules: toJsonRecord(row.rulesJson),
})

const mapPolicyRow = (row: {
  id: number
  strategyId: number
  accountId: string | null
  provider: string
  accountType: string
  label: string
  allowedBucketsJson: unknown
  preferredBucket: string | null
  maxAllocationPct: number
  maxSingleAssetPct: number
  minOrderAmount: string | null
  tradingCurrency: string
  taxWrapper: string | null
  eligibilityRulesJson: Record<string, unknown>
  restrictedAssetsJson: unknown
  humanReadablePolicy: string
  noAutoTrade: boolean
  humanValidationRequired: boolean
}): AccountPolicyDto => ({
  id: row.id,
  strategyId: row.strategyId,
  accountId: row.accountId,
  provider: row.provider,
  accountType:
    row.accountType === 'pea' ||
    row.accountType === 'brokerage' ||
    row.accountType === 'crypto' ||
    row.accountType === 'cash'
      ? row.accountType
      : 'unknown',
  label: row.label,
  allowedBuckets: toBucketArray(row.allowedBucketsJson),
  preferredBucket:
    row.preferredBucket === 'core' ||
    row.preferredBucket === 'growth' ||
    row.preferredBucket === 'asymmetric'
      ? row.preferredBucket
      : null,
  maxAllocationPct: row.maxAllocationPct,
  maxSingleAssetPct: row.maxSingleAssetPct,
  minOrderAmount: toNumberOrNull(row.minOrderAmount),
  tradingCurrency: row.tradingCurrency,
  taxWrapper: row.taxWrapper,
  eligibilityRules: toJsonRecord(row.eligibilityRulesJson),
  restrictedAssets: toStringArray(row.restrictedAssetsJson),
  humanReadablePolicy: row.humanReadablePolicy,
  noAutoTrade: row.noAutoTrade,
  humanValidationRequired: row.humanValidationRequired,
})

const mapCandidateRow = (row: {
  id: number
  symbol: string
  name: string
  assetClass: string
  bucket: string
  accountTypesAllowedJson: unknown
  providerSymbolsJson: Record<string, string>
  isin: string | null
  exchange: string | null
  currency: string
  eligibilityStatus: string
  peaEligibilityStatus: string
  riskLevel: string
  liquidityScore: number | null
  notes: string | null
  source: string
}): AssetCandidateDto => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name,
  assetClass: row.assetClass,
  bucket:
    row.bucket === 'core' || row.bucket === 'growth' || row.bucket === 'asymmetric'
      ? row.bucket
      : 'core',
  accountTypesAllowed: toAccountTypeArray(row.accountTypesAllowedJson),
  providerSymbols: toJsonRecord(row.providerSymbolsJson) as Record<string, string>,
  isin: row.isin,
  exchange: row.exchange,
  currency: row.currency,
  eligibilityStatus:
    row.eligibilityStatus === 'approved' ||
    row.eligibilityStatus === 'candidate_needs_review' ||
    row.eligibilityStatus === 'approved_by_default_policy' ||
    row.eligibilityStatus === 'candidate_auto_suggested' ||
    row.eligibilityStatus === 'rejected' ||
    row.eligibilityStatus === 'watch_only' ||
    row.eligibilityStatus === 'unknown'
      ? row.eligibilityStatus
      : 'unknown',
  peaEligibilityStatus:
    row.peaEligibilityStatus === 'eligible' ||
    row.peaEligibilityStatus === 'ineligible' ||
    row.peaEligibilityStatus === 'unknown' ||
    row.peaEligibilityStatus === 'not_applicable'
      ? row.peaEligibilityStatus
      : 'unknown',
  riskLevel:
    row.riskLevel === 'low' ||
    row.riskLevel === 'medium' ||
    row.riskLevel === 'high' ||
    row.riskLevel === 'very_high'
      ? row.riskLevel
      : 'medium',
  liquidityScore: row.liquidityScore,
  notes: row.notes,
  source: row.source,
  userInterestLevel: 'none',
  userIntent: 'analyze',
  iconUrl: null,
  logoUrl: null,
})

const createDemoStrategyBundle = (): StrategyBundle => {
  const createdAt = '2026-05-23T07:30:00.000Z'
  const strategy: StrategyProfileDto = {
    id: 0,
    name: DEFAULT_STRATEGY_NAME,
    version: DEFAULT_STRATEGY_VERSION,
    status: 'active',
    description: 'Strategie demo deterministe 60 / 30 / 10, sans DB ni provider.',
    riskProfile: 'growth',
    horizonYears: 12,
    baseCurrency: 'EUR',
    monthlyContributionTarget: 300,
    rebalanceThresholdPct: 5,
    reviewFrequency: 'daily_monitoring',
    noAutoTrade: true,
    humanValidationRequired: true,
    createdAt,
    updatedAt: createdAt,
  }
  return {
    strategy,
    buckets: defaultBuckets(0).map((bucket, index) => ({ ...bucket, id: index + 1 })),
    accountPolicies: defaultAccountPolicies(0).map((policy, index) => ({
      ...policy,
      id: index + 1,
    })),
    candidates: defaultCandidateUniverse().map((candidate, index) => ({
      ...candidate,
      id: index + 1,
    })),
  }
}

const createDemoHoldings = (): HoldingInput[] => [
  {
    provider: 'trade_republic',
    accountId: 'demo-pea',
    accountLabel: 'PEA Trade Republic',
    accountType: 'pea',
    symbol: 'CORE_ETF_REVIEW',
    name: 'ETF Core a analyser',
    assetClass: 'etf',
    value: 6000,
    currency: 'EUR',
    valueAsOf: '2026-05-23T07:00:00.000Z',
    quantity: 10,
    degradedReasons: ['demo_fixture'],
    assumptions: ['Mode demo: instrument sans prix frais ni eligibility PEA confirmee.'],
  },
  {
    provider: 'ibkr',
    accountId: 'demo-ibkr',
    accountLabel: 'IBKR',
    accountType: 'brokerage',
    symbol: 'GROWTH_REVIEW',
    name: 'Growth candidate',
    assetClass: 'equity',
    value: 3000,
    currency: 'EUR',
    valueAsOf: '2026-05-23T07:00:00.000Z',
    quantity: 5,
    degradedReasons: ['demo_fixture'],
    assumptions: ['Mode demo: candidate analysee sans prix frais.'],
  },
  {
    provider: 'binance',
    accountId: 'demo-binance',
    accountLabel: 'Binance',
    accountType: 'crypto',
    symbol: 'BTC',
    name: 'Bitcoin',
    assetClass: 'crypto',
    value: 800,
    currency: 'EUR',
    valueAsOf: '2026-05-23T07:00:00.000Z',
    quantity: 0.01,
    degradedReasons: ['demo_fixture'],
    assumptions: ['Mode demo: crypto analysee, cap de risque et prix frais restent prioritaires.'],
  },
]

const demoPlan = (requestId: string) => {
  const bundle = createDemoStrategyBundle()
  const allocation = computePortfolioAllocation({
    strategy: bundle.strategy,
    buckets: bundle.buckets,
    candidates: bundle.candidates,
    holdings: createDemoHoldings(),
    now: new Date('2026-05-23T07:30:00.000Z'),
  })
  const plan = buildActionPlanDraft({
    bundle,
    allocation,
    latestPrices: {},
    providerHealthByProvider: {
      trade_republic: 'demo',
      ibkr: 'demo',
      binance: 'demo',
    },
    now: new Date('2026-05-23T07:30:00.000Z'),
  })
  return {
    requestId,
    mode: 'demo' as const,
    source: 'demo_fixture' as const,
    strategy: bundle.strategy,
    buckets: bundle.buckets,
    accountPolicies: bundle.accountPolicies,
    plan: {
      id: 0,
      ...plan,
      topAction: plan.items[plan.topActionIndex] ?? null,
    },
    hypotheses: [],
    calibration: {
      strategyId: 0,
      generatedAt: '2026-05-23T07:30:00.000Z',
      horizon: 'all',
      sampleSize: 0,
      hitRate: 0,
      brierScore: null,
      averageConfidence: 0,
      calibrationBuckets: [],
      byBucket: {},
      byAccount: {},
      byAssetClass: {},
      notes: 'Mode demo: aucun historique reel.',
    },
    warnings: ['demo_fixture', 'priceable_and_eligible_required'],
  }
}

const mapExternalPosition = (row: ExternalPositionRow): HoldingInput => {
  const provider = String(row.provider ?? 'unknown')
  const assetClass = String(row.assetClass ?? 'unknown')
  const sourceConfidence = row.sourceConfidence
  return {
    provider,
    accountId: row.accountExternalId ? String(row.accountExternalId) : null,
    accountLabel: row.accountAlias ? String(row.accountAlias) : null,
    accountType: provider === 'binance' ? 'crypto' : 'brokerage',
    symbol: row.symbol ? String(row.symbol) : null,
    name: String(row.name ?? row.symbol ?? 'Unknown external position'),
    assetClass,
    value: toNumberOrNull(row.normalizedValue ?? row.value),
    currency: row.valueCurrency
      ? String(row.valueCurrency)
      : row.currency
        ? String(row.currency)
        : null,
    valueAsOf: typeof row.valueAsOf === 'string' ? row.valueAsOf : null,
    quantity: toNumberOrNull(row.quantity),
    ...(row.valueSource ? { valueSource: String(row.valueSource) } : {}),
    confidence:
      typeof sourceConfidence === 'number'
        ? sourceConfidence
        : sourceConfidence === 'high' ||
            sourceConfidence === 'medium' ||
            sourceConfidence === 'low' ||
            sourceConfidence === 'unknown'
          ? sourceConfidence
          : 'unknown',
    degradedReasons: toStringArray(row.degradedReasons),
    assumptions: toStringArray(row.assumptions),
  }
}

const inferPowensAccountType = (
  position: InvestmentPositionRow
): 'pea' | 'brokerage' | 'unknown' => {
  const text =
    `${position.provider ?? ''} ${position.accountName ?? ''} ${position.assetName ?? ''}`.toLowerCase()
  if (text.includes('pea') || text.includes('trade republic')) return 'pea'
  return position.provider ? 'brokerage' : 'unknown'
}

const mapPowensPosition = (row: InvestmentPositionRow): HoldingInput => {
  const value = toNumberOrNull(row.currentValue) ?? toNumberOrNull(row.lastKnownValue)
  return {
    provider: row.provider ?? row.source,
    accountId: row.powensAccountId,
    accountLabel: row.accountName,
    accountType: inferPowensAccountType(row),
    symbol: row.providerPositionId ?? row.positionKey,
    name: row.name,
    assetClass: 'investment',
    value,
    currency: row.currency,
    valueAsOf: toIso(row.valuedAt),
    quantity: toNumberOrNull(row.quantity),
    confidence: value === null ? 'low' : 'medium',
    degradedReasons: value === null ? ['missing_position_valuation'] : [],
    assumptions: ['Powens investment position mapped for strategy allocation only.'],
  }
}

const priceRowToContract = (row: {
  id: number
  assetId: string | null
  instrumentId: string | null
  symbol: string
  assetClass: string
  provider: string
  sourceType: string
  price: string
  currency: string
  marketTimestamp: Date
  fetchedAt: Date
  delaySeconds: number
  staleAfterSeconds: number
  isMarketOpen: boolean | null
  confidence: number
}): PriceSnapshotContract & { id: number } => ({
  id: row.id,
  assetId: row.assetId,
  instrumentId: row.instrumentId,
  symbol: row.symbol,
  assetClass:
    row.assetClass === 'stock' ||
    row.assetClass === 'etf' ||
    row.assetClass === 'crypto' ||
    row.assetClass === 'cash' ||
    row.assetClass === 'fund' ||
    row.assetClass === 'other'
      ? row.assetClass
      : 'other',
  provider: row.provider,
  sourceType: row.sourceType as PriceSourceType,
  price: Number(row.price),
  currency: row.currency,
  marketTimestamp: row.marketTimestamp.toISOString(),
  fetchedAt: row.fetchedAt.toISOString(),
  delaySeconds: row.delaySeconds,
  staleAfterSeconds: row.staleAfterSeconds,
  isMarketOpen: row.isMarketOpen,
  confidence: row.confidence,
})

type AssetSearchResultDto = {
  id: string
  symbol: string
  name: string
  assetClass: string
  isin: string | null
  exchange: string | null
  currency: string
  iconUrl: string | null
  logoUrl: string | null
  providerSymbols: Record<string, string>
  priceability: 'priceable' | 'stale' | 'missing' | 'unsupported'
  eligibilityByAccount: Record<
    'pea' | 'brokerage' | 'crypto',
    'eligible' | 'ineligible' | 'unknown' | 'not_applicable'
  >
  suggestedBucket: 'core' | 'growth' | 'asymmetric'
  riskLevel: 'low' | 'medium' | 'high' | 'very_high'
  lastPrice: number | null
  lastPriceCurrency: string | null
  lastPriceAt: string | null
  priceSource: string | null
  isAlreadyWatched: boolean
  userInterestLevel: 'none' | 'watching' | 'interested' | 'high_interest'
  userIntent: 'watch' | 'analyze' | 'compare' | 'consider_buy' | 'exclude'
  warnings: string[]
}

type CuratedAsset = Omit<
  AssetSearchResultDto,
  | 'id'
  | 'priceability'
  | 'lastPrice'
  | 'lastPriceCurrency'
  | 'lastPriceAt'
  | 'priceSource'
  | 'isAlreadyWatched'
  | 'userInterestLevel'
  | 'userIntent'
  | 'warnings'
>

const CURATED_ASSET_UNIVERSE: CuratedAsset[] = [
  {
    symbol: 'NVDA',
    name: 'NVIDIA',
    assetClass: 'stock',
    isin: 'US67066G1040',
    exchange: 'NASDAQ',
    currency: 'USD',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { ibkr: 'NVDA' },
    eligibilityByAccount: { pea: 'ineligible', brokerage: 'eligible', crypto: 'not_applicable' },
    suggestedBucket: 'growth',
    riskLevel: 'high',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    assetClass: 'crypto',
    isin: null,
    exchange: 'binance_spot',
    currency: 'EUR',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { binance: 'BTCEUR' },
    eligibilityByAccount: { pea: 'not_applicable', brokerage: 'not_applicable', crypto: 'eligible' },
    suggestedBucket: 'asymmetric',
    riskLevel: 'very_high',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    assetClass: 'crypto',
    isin: null,
    exchange: 'binance_spot',
    currency: 'EUR',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { binance: 'ETHEUR' },
    eligibilityByAccount: { pea: 'not_applicable', brokerage: 'not_applicable', crypto: 'eligible' },
    suggestedBucket: 'asymmetric',
    riskLevel: 'very_high',
  },
  {
    symbol: 'SOL',
    name: 'Solana',
    assetClass: 'crypto',
    isin: null,
    exchange: 'binance_spot',
    currency: 'EUR',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { binance: 'SOLEUR' },
    eligibilityByAccount: { pea: 'not_applicable', brokerage: 'not_applicable', crypto: 'eligible' },
    suggestedBucket: 'asymmetric',
    riskLevel: 'very_high',
  },
  {
    symbol: 'CW8',
    name: 'Amundi MSCI World PEA',
    assetClass: 'etf',
    isin: 'LU1681043599',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { trade_republic: 'CW8', ibkr: 'CW8' },
    eligibilityByAccount: { pea: 'eligible', brokerage: 'eligible', crypto: 'not_applicable' },
    suggestedBucket: 'core',
    riskLevel: 'medium',
  },
  {
    symbol: 'AI',
    name: 'Air Liquide',
    assetClass: 'stock',
    isin: 'FR0000120073',
    exchange: 'Euronext Paris',
    currency: 'EUR',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { trade_republic: 'AI', ibkr: 'AI' },
    eligibilityByAccount: { pea: 'eligible', brokerage: 'eligible', crypto: 'not_applicable' },
    suggestedBucket: 'growth',
    riskLevel: 'medium',
  },
  {
    symbol: 'SMH',
    name: 'VanEck Semiconductor ETF',
    assetClass: 'etf',
    isin: 'US92189F6768',
    exchange: 'NASDAQ',
    currency: 'USD',
    iconUrl: null,
    logoUrl: null,
    providerSymbols: { ibkr: 'SMH' },
    eligibilityByAccount: { pea: 'ineligible', brokerage: 'eligible', crypto: 'not_applicable' },
    suggestedBucket: 'growth',
    riskLevel: 'high',
  },
]

const inferBucketForAsset = (assetClass: string): 'core' | 'growth' | 'asymmetric' => {
  const normalized = assetClass.toLowerCase()
  if (normalized.includes('crypto')) return 'asymmetric'
  if (normalized.includes('etf') || normalized.includes('fund')) return 'core'
  return 'growth'
}

const inferRiskForAsset = (assetClass: string): 'low' | 'medium' | 'high' | 'very_high' => {
  const normalized = assetClass.toLowerCase()
  if (normalized.includes('crypto')) return 'very_high'
  if (normalized.includes('stock') || normalized.includes('equity')) return 'high'
  return 'medium'
}

const accountEligibilityForAsset = (
  asset: Pick<CuratedAsset, 'assetClass' | 'eligibilityByAccount'>
) => asset.eligibilityByAccount

const priceabilityFromPrice = (
  price: ReturnType<typeof priceRowToContract> | null,
  now = new Date()
): {
  priceability: AssetSearchResultDto['priceability']
  lastPrice: number | null
  lastPriceCurrency: string | null
  lastPriceAt: string | null
  priceSource: string | null
  warnings: string[]
} => {
  const reliable = getReliablePriceForRecommendation({ snapshot: price, now })
  return {
    priceability:
      reliable.status === 'fresh'
        ? 'priceable'
        : reliable.status === 'missing'
          ? 'missing'
          : 'stale',
    lastPrice: reliable.freshness.price,
    lastPriceCurrency: reliable.freshness.currency,
    lastPriceAt: reliable.freshness.fetchedAt ?? reliable.freshness.marketTimestamp,
    priceSource: reliable.freshness.provider,
    warnings: reliable.warnings,
  }
}

const accountScope = (label: string): 'PEA' | 'IBKR' | 'Binance' | 'global' => {
  const lower = label.toLowerCase()
  if (lower.includes('pea')) return 'PEA'
  if (lower.includes('ibkr')) return 'IBKR'
  if (lower.includes('binance')) return 'Binance'
  return 'global'
}

const mapActionForRecommendation = (
  action: string
): 'buy' | 'hold' | 'watch' | 'avoid' | 'rebalance' | 'insufficient_data' => {
  if (
    action === 'buy' ||
    action === 'hold' ||
    action === 'watch' ||
    action === 'avoid' ||
    action === 'rebalance' ||
    action === 'insufficient_data'
  ) {
    return action
  }
  return 'rebalance'
}

const mapHorizon = (value: string): 'intraday' | '1d' | '7d' | '30d' | '90d' | 'long_term' => {
  if (
    value === 'intraday' ||
    value === '1d' ||
    value === '7d' ||
    value === '30d' ||
    value === '90d'
  ) {
    return value
  }
  return 'long_term'
}

const safeError = (error: unknown) =>
  (error instanceof Error ? error.message : String(error))
    .replace(/(token|secret|password|api[_-]?key|code)=([^&\s]+)/gi, '$1=[redacted]')
    .slice(0, 300)

const graphFailureReason = async (response: Response) => {
  const fallback = `knowledge_service_status_${response.status}`
  try {
    const payload = (await response.json()) as { code?: unknown }
    return typeof payload.code === 'string' && payload.code.trim() ? payload.code.trim() : fallback
  } catch {
    return fallback
  }
}

type GraphMemoryStats = {
  rows: Array<{ status: 'pending' | 'sent' | 'skipped' | 'failed'; count: number }>
  latestFailure: { graphWriteError: string | null } | null
}

const graphStatusFromMemoryStats = ({
  lastRun,
  historical,
}: {
  lastRun: GraphMemoryStats
  historical: GraphMemoryStats
}) => {
  const count = (stats: GraphMemoryStats, status: 'pending' | 'sent' | 'skipped' | 'failed') =>
    stats.rows.find(row => row.status === status)?.count ?? 0
  const toStatus = (stats: GraphMemoryStats) => {
    const pending = count(stats, 'pending')
    const skipped = count(stats, 'skipped')
    const succeeded = count(stats, 'sent')
    const failed = count(stats, 'failed')
    const attempted = succeeded + failed
    const warnings =
      failed > 0 && stats.latestFailure?.graphWriteError
        ? [stats.latestFailure.graphWriteError]
        : []
    return {
      attempted,
      succeeded,
      failed,
      pending,
      skipped,
      warnings,
      lastError: stats.latestFailure?.graphWriteError ?? null,
    }
  }
  const lastRunStatus = toStatus(lastRun)
  const historicalStatus = toStatus(historical)
  return {
    lastRun: lastRunStatus,
    historical: historicalStatus,
    resolvedHistoricalFailures:
      lastRunStatus.failed === 0 ? Math.max(0, historicalStatus.failed - lastRunStatus.failed) : 0,
  }
}

const activeGraphWarnings = (graph: ReturnType<typeof graphStatusFromMemoryStats>) =>
  graph.lastRun.failed > 0 ? graph.lastRun.warnings : []

const dataQualityFromJson = (
  value: Record<string, unknown>
): AllocationSnapshotDto['dataQuality'] => ({
  status:
    value.status === 'ready' || value.status === 'degraded' || value.status === 'insufficient_data'
      ? value.status
      : 'degraded',
  confidence: toNumberOrNull(value.confidence) ?? 0,
  unknownValue: toNumberOrNull(value.unknownValue) ?? 0,
  unknownPositionCount: toNumberOrNull(value.unknownPositionCount) ?? 0,
  stalePositionCount: toNumberOrNull(value.stalePositionCount) ?? 0,
  missingPriceSymbols: toStringArray(value.missingPriceSymbols),
  stalePriceSymbols: toStringArray(value.stalePriceSymbols),
  providerWarnings: toStringArray(value.providerWarnings),
  fxWarnings: toStringArray(value.fxWarnings),
  graphWarnings: toStringArray(value.graphWarnings),
})

const priceFreshnessFromJson = (
  value: Record<string, unknown>
): ActionPlanDraft['items'][number]['dataFreshness'] => ({
  provider: typeof value.provider === 'string' ? value.provider : null,
  sourceType: typeof value.sourceType === 'string' ? value.sourceType : null,
  marketTimestamp: typeof value.marketTimestamp === 'string' ? value.marketTimestamp : null,
  fetchedAt: typeof value.fetchedAt === 'string' ? value.fetchedAt : null,
  delaySeconds: toNumberOrNull(value.delaySeconds),
  ageSeconds: toNumberOrNull(value.ageSeconds),
  isStale: value.isStale === true,
  confidence: toNumberOrNull(value.confidence) ?? 0,
  currency: typeof value.currency === 'string' ? value.currency : null,
  price: toNumberOrNull(value.price),
  staleReason: typeof value.staleReason === 'string' ? value.staleReason : null,
  providerHealth: typeof value.providerHealth === 'string' ? value.providerHealth : null,
  fallbackReason: typeof value.fallbackReason === 'string' ? value.fallbackReason : null,
})

const mapPersistedAllocation = (latest: {
  snapshot: {
    id: number
    strategyId: number
    snapshotAt: Date
    baseCurrency: string
    totalValue: string
    coreValue: string
    growthValue: string
    asymmetricValue: string
    cashValue: string
    unknownValue: string
    corePct: number
    growthPct: number
    asymmetricPct: number
    dataQualityJson: Record<string, unknown>
  }
  drift: Array<{
    bucket: 'core' | 'growth' | 'asymmetric'
    targetPct: number
    actualPct: number
    driftPct: number
    severity: 'ok' | 'watch' | 'alert' | 'hard_limit'
    recommendedContribution: string | null
    recommendedAction: string
  }>
}): AllocationSnapshotDto => ({
  id: latest.snapshot.id,
  strategyId: latest.snapshot.strategyId,
  snapshotAt: latest.snapshot.snapshotAt.toISOString(),
  baseCurrency: latest.snapshot.baseCurrency,
  totalValue: toNumberOrNull(latest.snapshot.totalValue) ?? 0,
  coreValue: toNumberOrNull(latest.snapshot.coreValue) ?? 0,
  growthValue: toNumberOrNull(latest.snapshot.growthValue) ?? 0,
  asymmetricValue: toNumberOrNull(latest.snapshot.asymmetricValue) ?? 0,
  cashValue: toNumberOrNull(latest.snapshot.cashValue) ?? 0,
  unknownValue: toNumberOrNull(latest.snapshot.unknownValue) ?? 0,
  corePct: latest.snapshot.corePct,
  growthPct: latest.snapshot.growthPct,
  asymmetricPct: latest.snapshot.asymmetricPct,
  drift: latest.drift.map(item => ({
    bucket: item.bucket,
    targetPct: item.targetPct,
    actualPct: item.actualPct,
    driftPct: item.driftPct,
    severity: item.severity,
    recommendedContribution: toNumberOrNull(item.recommendedContribution),
    recommendedAction: item.recommendedAction,
  })),
  dataQuality: dataQualityFromJson(toJsonRecord(latest.snapshot.dataQualityJson)),
  holdings: [],
})

const contributionFromAllocation = (
  allocation: AllocationSnapshotDto
): ActionPlanDraft['contribution'] =>
  allocation.drift
    .filter(item => item.recommendedContribution !== null && item.recommendedContribution > 0)
    .map(item => ({
      bucket: item.bucket,
      amount: item.recommendedContribution ?? 0,
      currency: allocation.baseCurrency,
      reason: `Corrige une sous-ponderation de ${Math.abs(item.driftPct).toFixed(1)} points sans vendre.`,
    }))

const buildActionableStepsFromPersistedPlan = ({
  items,
  allocation,
  contribution,
}: {
  items: ActionPlanDraft['items']
  allocation: AllocationSnapshotDto
  contribution: ActionPlanDraft['contribution']
}): InvestmentActionableStep[] => {
  const bucketMax = { core: 70, growth: 40, asymmetric: 10 } as const
  const bucketTarget = { core: 60, growth: 30, asymmetric: 10 } as const
  return buildInvestmentActionableSteps({
    items,
    allocation,
    contribution,
    buckets: (['core', 'growth', 'asymmetric'] as const).map((bucket, index) => ({
      id: index,
      strategyId: allocation.strategyId,
      bucketKey: bucket,
      targetPct: bucketTarget[bucket],
      minPct: 0,
      maxPct: bucketMax[bucket],
      riskLevel: bucket === 'asymmetric' ? 'very_high' : 'medium',
      description: '',
      defaultHorizon: 'long_term',
      rules: {},
    })),
  })
}

export const createInvestmentStrategyUseCases = ({
  repository,
  listExternalPositions,
  listPowensInvestmentPositions,
  knowledgeConfig,
  advisorGraphIngestEnabled,
}: InvestmentStrategyUseCaseDeps) => {
  const candidateFromInterestRow = (row: {
    id: number
    symbol: string
    name: string
    assetClass: string
    providerSymbolsJson: Record<string, string>
    iconUrl: string | null
    logoUrl: string | null
    isin: string | null
    exchange: string | null
    currency: string
    userInterestLevel: string
    userIntent: string
    note: string | null
  }): AssetCandidateDto => {
    const curated = CURATED_ASSET_UNIVERSE.find(
      item => normalizeAssetSymbol(item.symbol) === normalizeAssetSymbol(row.symbol)
    )
    const assetClass = row.assetClass || curated?.assetClass || 'stock'
    const bucket = curated?.suggestedBucket ?? inferBucketForAsset(assetClass)
    const accountTypesAllowed =
      assetClass.toLowerCase().includes('crypto') || bucket === 'asymmetric'
        ? (['crypto'] as const)
        : (['pea', 'brokerage'] as const)
    const providerSymbols = {
      ...(curated?.providerSymbols ?? {}),
      ...toJsonRecord(row.providerSymbolsJson),
    } as Record<string, string>
    const userIntent =
      row.userIntent === 'watch' ||
      row.userIntent === 'analyze' ||
      row.userIntent === 'compare' ||
      row.userIntent === 'consider_buy' ||
      row.userIntent === 'exclude'
        ? row.userIntent
        : 'watch'
    const userInterestLevel =
      row.userInterestLevel === 'none' ||
      row.userInterestLevel === 'watching' ||
      row.userInterestLevel === 'interested' ||
      row.userInterestLevel === 'high_interest'
        ? row.userInterestLevel
        : 'watching'
    return {
      id: -row.id,
      symbol: normalizeAssetSymbol(row.symbol),
      name: row.name,
      assetClass,
      bucket,
      accountTypesAllowed: [...accountTypesAllowed],
      providerSymbols,
      isin: row.isin ?? curated?.isin ?? null,
      exchange: row.exchange ?? curated?.exchange ?? null,
      currency: row.currency || curated?.currency || 'EUR',
      eligibilityStatus: userIntent === 'exclude' ? 'rejected' : 'candidate_auto_suggested',
      peaEligibilityStatus:
        curated?.eligibilityByAccount.pea === 'eligible'
          ? 'eligible'
          : curated?.eligibilityByAccount.pea === 'ineligible'
            ? 'ineligible'
            : assetClass.toLowerCase().includes('crypto')
              ? 'not_applicable'
              : 'unknown',
      riskLevel: curated?.riskLevel ?? inferRiskForAsset(assetClass),
      liquidityScore: curated ? 0.78 : userInterestLevel === 'high_interest' ? 0.55 : 0.45,
      notes:
        row.note ??
        'Ajoute par l utilisateur: signal d interet, pas priorite automatique de recommandation.',
      source: 'user_watchlist',
      userInterestLevel,
      userIntent,
      iconUrl: row.iconUrl,
      logoUrl: row.logoUrl,
    }
  }

  const mergeUserInterestCandidates = async (candidates: AssetCandidateDto[]) => {
    const interests = await repository.listUserAssetInterests()
    if (interests.length === 0) return candidates
    const byKey = new Map<string, AssetCandidateDto>()
    for (const candidate of candidates) {
      byKey.set(`${normalizeAssetSymbol(candidate.symbol)}:${candidate.bucket}`, candidate)
    }
    for (const row of interests) {
      const candidate = candidateFromInterestRow(row)
      const key = `${normalizeAssetSymbol(candidate.symbol)}:${candidate.bucket}`
      const existing = byKey.get(key)
      if (existing) {
        byKey.set(key, {
          ...existing,
          userInterestLevel: candidate.userInterestLevel,
          userIntent: candidate.userIntent,
          notes: candidate.notes ?? existing.notes,
          source: existing.source === 'default_seed_needs_review' ? 'user_watchlist' : existing.source,
          iconUrl: candidate.iconUrl,
          logoUrl: candidate.logoUrl,
        })
      } else {
        byKey.set(key, candidate)
      }
    }
    return [...byKey.values()]
  }

  const bundleFromRows = async (strategyId: number): Promise<StrategyBundle | null> => {
    const rows = await repository.getStrategyBundle(strategyId)
    if (!rows.strategy) return null
    const candidates = await mergeUserInterestCandidates(rows.candidates.map(mapCandidateRow))
    return {
      strategy: mapStrategyRow(rows.strategy),
      buckets: rows.buckets.map(mapBucketRow),
      accountPolicies: rows.accountPolicies.map(mapPolicyRow),
      candidates,
    }
  }

  const getActiveStrategyBundle = async () => {
    const active = await repository.getActiveStrategy()
    if (!active) return null
    return bundleFromRows(active.id)
  }

  const seedDefaultStrategyIfMissing = async (): Promise<StrategyBundle> => {
    const existing = await getActiveStrategyBundle()
    if (existing) return existing
    const now = new Date()
    const strategy = await repository.createStrategy({
      name: DEFAULT_STRATEGY_NAME,
      version: DEFAULT_STRATEGY_VERSION,
      status: 'active',
      description:
        'Strategie personnelle 60 / 30 / 10: Core long terme, Growth maitrise, Asymmetric plafonne.',
      riskProfile: 'growth',
      horizonYears: 12,
      baseCurrency: 'EUR',
      monthlyContributionTarget: '300.00',
      rebalanceThresholdPct: 5,
      reviewFrequency: 'daily_monitoring',
      noAutoTrade: true,
      humanValidationRequired: true,
      createdAt: now,
      updatedAt: now,
    })
    await repository.archiveOtherActiveStrategies(strategy.id)
    await repository.insertBuckets(
      defaultBuckets(strategy.id).map(bucket => ({
        strategyId: bucket.strategyId,
        bucketKey: bucket.bucketKey,
        targetPct: bucket.targetPct,
        minPct: bucket.minPct,
        maxPct: bucket.maxPct,
        riskLevel: bucket.riskLevel,
        description: bucket.description,
        defaultHorizon: bucket.defaultHorizon,
        rulesJson: bucket.rules,
        createdAt: now,
        updatedAt: now,
      }))
    )
    await repository.insertAccountPolicies(
      defaultAccountPolicies(strategy.id).map(policy => ({
        strategyId: policy.strategyId,
        accountId: policy.accountId,
        provider: policy.provider,
        accountType: policy.accountType,
        label: policy.label,
        allowedBucketsJson: policy.allowedBuckets,
        preferredBucket: policy.preferredBucket,
        maxAllocationPct: policy.maxAllocationPct,
        maxSingleAssetPct: policy.maxSingleAssetPct,
        minOrderAmount: policy.minOrderAmount === null ? null : policy.minOrderAmount.toFixed(2),
        tradingCurrency: policy.tradingCurrency,
        taxWrapper: policy.taxWrapper,
        eligibilityRulesJson: policy.eligibilityRules,
        restrictedAssetsJson: policy.restrictedAssets,
        humanReadablePolicy: policy.humanReadablePolicy,
        noAutoTrade: true,
        humanValidationRequired: true,
        createdAt: now,
        updatedAt: now,
      }))
    )
    await repository.upsertCandidates(
      defaultCandidateUniverse().map(candidate => ({
        symbol: candidate.symbol,
        name: candidate.name,
        assetClass: candidate.assetClass,
        bucket: candidate.bucket,
        accountTypesAllowedJson: candidate.accountTypesAllowed,
        providerSymbolsJson: candidate.providerSymbols,
        isin: candidate.isin,
        exchange: candidate.exchange,
        currency: candidate.currency,
        eligibilityStatus: candidate.eligibilityStatus,
        peaEligibilityStatus: candidate.peaEligibilityStatus,
        riskLevel: candidate.riskLevel,
        liquidityScore: candidate.liquidityScore,
        notes: candidate.notes,
        source: candidate.source,
        createdAt: now,
        updatedAt: now,
      }))
    )
    const bundle = await bundleFromRows(strategy.id)
    if (!bundle) throw new Error('DEFAULT_STRATEGY_SEED_FAILED')
    return bundle
  }

  const getInvestmentStrategy = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    const bundle = mode === 'demo' ? createDemoStrategyBundle() : await getActiveStrategyBundle()
    const resolved = bundle ?? createDemoStrategyBundle()
    return {
      requestId,
      mode,
      source: mode === 'demo' ? 'demo_fixture' : bundle ? 'db' : 'default_unpersisted',
      strategy: resolved.strategy,
      buckets: resolved.buckets,
      accountPolicies: resolved.accountPolicies,
      candidateUniverse: {
        total: resolved.candidates.length,
        approved: resolved.candidates.filter(item => item.eligibilityStatus === 'approved').length,
        needsReview: resolved.candidates.filter(
          item => item.eligibilityStatus === 'candidate_needs_review'
        ).length,
        userWatched: resolved.candidates.filter(item => item.source === 'user_watchlist').length,
        excluded: resolved.candidates.filter(
          item => item.eligibilityStatus === 'rejected' || item.userIntent === 'exclude'
        ).length,
        recommendableRule:
          'priceable + eligible for target account + fresh price + risk-policy-compliant',
        candidates: resolved.candidates,
      },
      validation: validateStrategy(resolved.buckets),
      safety: {
        noAutoTrade: true,
        humanValidationRequired: true,
        buyRequiresFreshPrice: true,
        buyRequiresKnownEligibility: true,
        approvedRequired: false,
      },
    }
  }

  const updateInvestmentStrategy = async ({
    mode,
    requestId,
    input,
  }: {
    mode: Mode
    requestId: string
    input: InvestmentStrategyUpdateInput
  }) => {
    if (mode !== 'admin') {
      throw new Error('DEMO_MODE_FORBIDDEN')
    }
    const bundle = await seedDefaultStrategyIfMissing()
    const updated = await repository.updateStrategyProfile(bundle.strategy.id, {
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.horizonYears !== undefined ? { horizonYears: input.horizonYears } : {}),
      ...(input.riskProfile !== undefined ? { riskProfile: input.riskProfile } : {}),
      ...(input.monthlyContributionTarget !== undefined
        ? {
            monthlyContributionTarget:
              input.monthlyContributionTarget === null
                ? null
                : input.monthlyContributionTarget.toFixed(2),
          }
        : {}),
      ...(input.rebalanceThresholdPct !== undefined
        ? { rebalanceThresholdPct: input.rebalanceThresholdPct }
        : {}),
    })
    if (!updated) throw new Error('STRATEGY_NOT_FOUND')
    return getInvestmentStrategy({ mode, requestId })
  }

  const collectHoldings = async (): Promise<HoldingInput[]> => {
    const [external, powens] = await Promise.all([
      listExternalPositions().catch(() => []),
      listPowensInvestmentPositions().catch(() => []),
    ])
    return [...external.map(mapExternalPosition), ...powens.map(mapPowensPosition)]
  }

  const computeCurrentAllocation = async (bundle: StrategyBundle) => {
    const holdings = await collectHoldings()
    return computePortfolioAllocation({
      strategy: bundle.strategy,
      buckets: bundle.buckets,
      candidates: bundle.candidates,
      holdings,
    })
  }

  const persistMemoryEvent = async ({
    runId,
    hypothesisId,
    eventType,
    payload,
    requestId,
  }: {
    runId?: number | null
    hypothesisId?: number | null
    eventType: string
    payload: Record<string, unknown>
    requestId: string
  }) => {
    const compact = createMemoryPayload(eventType, payload)
    const row = await repository.insertMemoryEvent({
      ...(runId !== undefined && runId !== null ? { runId } : {}),
      ...(hypothesisId !== undefined && hypothesisId !== null ? { hypothesisId } : {}),
      eventType: compact.eventType as never,
      payload: compact.payload,
      graphWriteStatus:
        knowledgeConfig.enabled && advisorGraphIngestEnabled ? 'pending' : 'skipped',
    })
    if (!row) return null
    if (!knowledgeConfig.enabled || !advisorGraphIngestEnabled) return row
    try {
      const controller = new AbortController()
      const timer = setTimeout(() => controller.abort(), knowledgeConfig.timeoutMs)
      const response = await fetch(`${knowledgeConfig.url}/knowledge/ingest/advisor`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-request-id': requestId,
        },
        body: JSON.stringify({
          mode: 'admin',
          source: 'finance-os-advisor',
          recommendations: [
            {
              id: `investment-memory:${row.id}`,
              title: eventType,
              summary: JSON.stringify(compact.payload).slice(0, 480),
              category: 'investment_memory',
              confidence: 0.6,
              tags: ['investment-strategy', 'advisor-brain', 'advisory-only'],
            },
          ],
        }),
        signal: controller.signal,
      })
      clearTimeout(timer)
      const failureReason = response.ok ? null : await graphFailureReason(response)
      await repository.updateMemoryEventGraphStatus(row.id, {
        graphWriteStatus: response.ok ? 'sent' : 'failed',
        graphWriteError: failureReason,
        nodesWritten: response.ok ? 1 : 0,
      })
    } catch (error) {
      await repository.updateMemoryEventGraphStatus(row.id, {
        graphWriteStatus: 'failed',
        graphWriteError: safeError(error),
      })
    }
    return row
  }

  const persistContextBundle = async ({
    requestId,
    bundle,
    allocation,
    plan,
    calibration,
  }: {
    requestId: string
    bundle: StrategyBundle
    allocation: AllocationSnapshotDto
    plan: ActionPlanDraft
    calibration: Record<string, unknown> | null
  }) => {
    const existing = await repository.getLatestContextBundleRow()
    const previousBundle = toJsonRecord(existing?.bundle)
    await repository.upsertContextBundle({
      requestId,
      generatedAt: new Date(),
      staleAfterMinutes: existing?.staleAfterMinutes ?? 1440,
      providerCoverage: existing?.providerCoverage ?? [],
      bundle: {
        ...previousBundle,
        investmentStrategy: {
          activeStrategy: bundle.strategy,
          buckets: bundle.buckets,
          accountPolicies: bundle.accountPolicies.map(policy => ({
            label: policy.label,
            provider: policy.provider,
            accountType: policy.accountType,
            preferredBucket: policy.preferredBucket,
            allowedBuckets: policy.allowedBuckets,
            humanReadablePolicy: policy.humanReadablePolicy,
          })),
        },
        allocation: {
          totalValue: allocation.totalValue,
          baseCurrency: allocation.baseCurrency,
          current: {
            corePct: allocation.corePct,
            growthPct: allocation.growthPct,
            asymmetricPct: allocation.asymmetricPct,
          },
          drift: allocation.drift,
          dataQuality: allocation.dataQuality,
        },
        actionPlan: {
          generatedAt: plan.generatedAt,
          summary: plan.summary,
          globalRisk: plan.globalRisk,
          globalConfidence: plan.globalConfidence,
          topAction: plan.items[plan.topActionIndex] ?? null,
          warnings: plan.warnings,
        },
        learning: calibration,
      },
    })
  }

  const persistActionPlan = async ({
    requestId,
    bundle,
    plan,
  }: {
    requestId: string
    bundle: StrategyBundle
    plan: ActionPlanDraft
  }) => {
    const allocation = await repository.insertAllocationSnapshot({
      strategyId: bundle.strategy.id,
      snapshotAt: new Date(plan.allocation.snapshotAt),
      baseCurrency: plan.allocation.baseCurrency,
      totalValue: plan.allocation.totalValue.toFixed(10),
      coreValue: plan.allocation.coreValue.toFixed(10),
      growthValue: plan.allocation.growthValue.toFixed(10),
      asymmetricValue: plan.allocation.asymmetricValue.toFixed(10),
      cashValue: plan.allocation.cashValue.toFixed(10),
      unknownValue: plan.allocation.unknownValue.toFixed(10),
      corePct: plan.allocation.corePct,
      growthPct: plan.allocation.growthPct,
      asymmetricPct: plan.allocation.asymmetricPct,
      driftJson: { items: plan.allocation.drift },
      dataQualityJson: plan.allocation.dataQuality,
    })
    await repository.insertDriftSnapshots(
      plan.allocation.drift.map(item => ({
        strategyId: bundle.strategy.id,
        snapshotId: allocation.id,
        bucket: item.bucket,
        targetPct: item.targetPct,
        actualPct: item.actualPct,
        driftPct: item.driftPct,
        severity: item.severity,
        recommendedContribution:
          item.recommendedContribution === null ? null : item.recommendedContribution.toFixed(2),
        recommendedAction: item.recommendedAction,
      }))
    )
    await repository.supersedeActivePlans(bundle.strategy.id)
    const planRow = await repository.insertActionPlan({
      strategyId: bundle.strategy.id,
      generatedAt: new Date(plan.generatedAt),
      status: 'active',
      summary: plan.summary,
      globalRisk: plan.globalRisk,
      globalConfidence: plan.globalConfidence,
      dataQualityStatus: plan.dataQualityStatus,
      noAutoTrade: true,
      humanValidationRequired: true,
    })
    const itemRows = await repository.insertActionPlanItems(
      plan.items.map(item => ({
        planId: planRow.id,
        ...(item.accountPolicyId !== null ? { accountPolicyId: item.accountPolicyId } : {}),
        accountLabel: item.accountLabel,
        accountType: item.accountType,
        bucket: item.bucket,
        ...(item.symbol ? { symbol: item.symbol } : {}),
        ...(item.assetName ? { assetName: item.assetName } : {}),
        action: item.action,
        amountValue: item.amountValue === null ? null : item.amountValue.toFixed(2),
        amountCurrency: item.amountCurrency,
        targetWeightPct: item.targetWeightPct,
        currentWeightPct: item.currentWeightPct,
        confidence: item.confidence,
        riskLevel: item.riskLevel,
        horizon: item.horizon,
        thesis: item.thesis,
        argumentsForJson: item.argumentsFor,
        argumentsAgainstJson: item.argumentsAgainst,
        invalidationCriteriaJson: item.invalidationCriteria,
        ...(item.priceSnapshotId !== null ? { priceSnapshotId: item.priceSnapshotId } : {}),
        dataFreshnessJson: item.dataFreshness,
        humanValidationRequired: true,
        noAutoTrade: true,
        createsHypothesis: item.createsHypothesis,
      }))
    )
    const topRow = itemRows[plan.topActionIndex] ?? itemRows[0] ?? null
    await repository.updateActionPlanTopAction(planRow.id, topRow?.id ?? null)

    for (const [index, item] of plan.items.entries()) {
      const recommendation = await repository.insertInvestmentRecommendation({
        accountScope: accountScope(item.accountLabel),
        symbol: item.symbol ?? `${item.bucket.toUpperCase()}_UNSPECIFIED`,
        action: mapActionForRecommendation(item.action),
        horizon: mapHorizon(item.horizon),
        thesis: item.thesis,
        supportingSignals: item.argumentsFor.map(reason => ({ reason })),
        contradictingSignals: item.argumentsAgainst.map(reason => ({ reason })),
        riskLevel: item.riskLevel,
        confidence: item.confidence,
        ...(item.dataFreshness.price !== null
          ? { priceUsed: item.dataFreshness.price.toFixed(10) }
          : {}),
        ...(item.priceSnapshotId !== null ? { priceSnapshotId: item.priceSnapshotId } : {}),
        priceSource: item.dataFreshness.provider,
        priceSourceType: item.dataFreshness.sourceType,
        marketTimestamp: item.dataFreshness.marketTimestamp
          ? new Date(item.dataFreshness.marketTimestamp)
          : null,
        fetchedAt: item.dataFreshness.fetchedAt ? new Date(item.dataFreshness.fetchedAt) : null,
        delaySeconds: item.dataFreshness.delaySeconds,
        isPriceStale: item.dataFreshness.isStale,
        staleReason: item.dataFreshness.staleReason,
        invalidationCriteria: item.invalidationCriteria.map(reason => ({ reason })),
        probability: item.confidence,
        reviewDates: ['J1', 'J7', 'J30'],
        missingData: item.argumentsAgainst.filter(reason =>
          /manquant|inconnue|stale|insuffisant/i.test(reason)
        ),
        humanValidationRequired: true,
        noAutoTrade: true,
      })
      await persistMemoryEvent({
        requestId,
        eventType: 'recommendation_created',
        payload: {
          planId: planRow.id,
          itemId: itemRows[index]?.id ?? null,
          recommendationId: recommendation?.id ?? null,
          action: item.action,
          account: item.accountLabel,
          symbol: item.symbol,
        },
      })
    }

    const hypotheses = buildHypothesisDrafts({
      plan,
      planItemIds: itemRows.map(item => item.id),
      now: new Date(plan.generatedAt),
    })
    for (const hypothesis of hypotheses) {
      const itemRow = itemRows[hypothesis.itemIndex]
      const persisted = await repository.insertHypothesis({
        symbol: hypothesis.symbol,
        accountScope: accountScope(hypothesis.accountScope),
        direction: hypothesis.direction,
        actionSuggested: mapActionForRecommendation(hypothesis.actionSuggested),
        horizon: mapHorizon(hypothesis.horizon),
        probability: hypothesis.probability,
        confidence: hypothesis.confidence,
        thesis: hypothesis.thesis,
        supportingSignals: hypothesis.supportingSignals,
        contradictingSignals: hypothesis.contradictingSignals,
        invalidationCriteria: hypothesis.invalidationCriteria,
        ...(hypothesis.priceAtPrediction !== null
          ? { priceAtPrediction: hypothesis.priceAtPrediction.toFixed(10) }
          : {}),
        ...(hypothesis.priceSnapshotId !== null
          ? { priceSnapshotId: hypothesis.priceSnapshotId }
          : {}),
        priceSource: hypothesis.priceSource,
        priceSourceType: hypothesis.priceSourceType,
        priceFreshness: hypothesis.priceFreshness,
        marketTimestamp: hypothesis.marketTimestamp ? new Date(hypothesis.marketTimestamp) : null,
        fetchedAt: hypothesis.fetchedAt ? new Date(hypothesis.fetchedAt) : null,
        reviewSchedule: hypothesis.reviewSchedule,
        status: 'open',
        createdByModel: 'deterministic_strategy_engine',
        promptVersion: 'none',
        strategyVersion: `${bundle.strategy.name}:${bundle.strategy.version}`,
      })
      if (!persisted) continue
      if (itemRow) await repository.updateActionPlanItemHypothesis(itemRow.id, persisted.id)
      await repository.insertPredictionOutcomes(
        hypothesis.outcomeReviews.map(review => ({
          hypothesisId: persisted.id,
          reviewHorizon: review.reviewHorizon,
          reviewDueAt: review.reviewDueAt,
          initialPrice:
            hypothesis.priceAtPrediction === null ? null : hypothesis.priceAtPrediction.toFixed(10),
          result: 'inconclusive',
        }))
      )
      await persistMemoryEvent({
        requestId,
        hypothesisId: persisted.id,
        eventType: 'hypothesis_created',
        payload: {
          planId: planRow.id,
          itemId: itemRow?.id ?? null,
          symbol: hypothesis.symbol,
          action: hypothesis.actionSuggested,
          reviewSchedule: hypothesis.reviewSchedule,
        },
      })
    }

    await persistMemoryEvent({
      requestId,
      eventType: 'action_plan_created',
      payload: {
        planId: planRow.id,
        itemCount: itemRows.length,
        topActionId: topRow?.id ?? null,
        noAutoTrade: true,
      },
    })
    return { planRow, itemRows, allocationRow: allocation, hypotheses }
  }

  const buildPlan = async (bundle: StrategyBundle) => {
    const allocation = await computeCurrentAllocation(bundle)
    const symbols = [
      ...bundle.candidates.map(candidate => candidate.symbol),
      ...bundle.candidates.flatMap(candidate => Object.values(candidate.providerSymbols)),
      ...allocation.holdings.map(holding => holding.symbol ?? '').filter(Boolean),
    ]
    const [priceRows, healthRows] = await Promise.all([
      repository.latestPricesForSymbols(symbols),
      repository.latestProviderHealth(bundle.accountPolicies.map(policy => policy.provider)),
    ])
    const prices: Record<string, ReturnType<typeof priceRowToContract> | null> = {}
    for (const row of priceRows) {
      const price = priceRowToContract(row)
      prices[row.symbol] = price
      prices[normalizeAssetSymbol(row.symbol)] = price
      if (row.instrumentId) prices[normalizeAssetSymbol(row.instrumentId)] = price
      if (row.assetId) prices[normalizeAssetSymbol(row.assetId)] = price
    }
    const health: Record<string, string | null> = {}
    for (const row of healthRows) {
      health[row.provider] = row.status
    }
    return buildActionPlanDraft({
      bundle,
      allocation,
      latestPrices: prices,
      providerHealthByProvider: health,
    })
  }

  const assetsForSearch = async (mode: Mode) => {
    const bundle = mode === 'demo' ? createDemoStrategyBundle() : await seedDefaultStrategyIfMissing()
    const interests = mode === 'demo' ? [] : await repository.listUserAssetInterests()
    const interestSymbols = new Map(
      interests.map(row => [`${normalizeAssetSymbol(row.symbol)}:${row.assetClass}`, row])
    )
    const rows = new Map<string, CuratedAsset | AssetCandidateDto>()
    for (const curated of CURATED_ASSET_UNIVERSE) {
      rows.set(`${normalizeAssetSymbol(curated.symbol)}:${curated.assetClass}`, curated)
    }
    for (const candidate of bundle.candidates) {
      rows.set(`${normalizeAssetSymbol(candidate.symbol)}:${candidate.assetClass}`, candidate)
    }
    return { rows: [...rows.values()], interests, interestSymbols }
  }

  const searchResultFromAsset = ({
    asset,
    price,
    watched,
    now,
  }: {
    asset: CuratedAsset | AssetCandidateDto
    price: ReturnType<typeof priceRowToContract> | null
    watched: Map<string, Awaited<ReturnType<InvestmentStrategyRepository['listUserAssetInterests']>>[number]>
    now: Date
  }): AssetSearchResultDto => {
    const isCandidate = 'bucket' in asset
    const key = `${normalizeAssetSymbol(asset.symbol)}:${asset.assetClass}`
    const interest = watched.get(key) ?? null
    const priceState = priceabilityFromPrice(price, now)
    const eligibilityByAccount: AssetSearchResultDto['eligibilityByAccount'] = isCandidate
      ? {
          pea:
            asset.peaEligibilityStatus === 'eligible'
              ? 'eligible'
              : asset.peaEligibilityStatus === 'ineligible'
                ? 'ineligible'
                : asset.peaEligibilityStatus === 'not_applicable'
                  ? 'not_applicable'
                  : 'unknown',
          brokerage: asset.accountTypesAllowed.includes('brokerage') ? 'eligible' : 'ineligible',
          crypto: asset.accountTypesAllowed.includes('crypto') ? 'eligible' : 'not_applicable',
        }
      : asset.eligibilityByAccount
    const warnings = [
      ...priceState.warnings,
      ...(eligibilityByAccount.pea === 'unknown'
        ? ['Eligibilite PEA inconnue: pas d achat PEA.']
        : []),
      ...(isCandidate && asset.eligibilityStatus === 'rejected'
        ? ['Actif rejete/exclu: recommandation bloquee.']
        : []),
    ]
    return {
      id: interest ? `watchlist:${interest.id}` : `asset:${normalizeAssetSymbol(asset.symbol)}`,
      symbol: normalizeAssetSymbol(asset.symbol),
      name: asset.name,
      assetClass: asset.assetClass,
      isin: asset.isin,
      exchange: asset.exchange,
      currency: asset.currency,
      iconUrl: isCandidate ? asset.iconUrl : asset.iconUrl,
      logoUrl: isCandidate ? asset.logoUrl : asset.logoUrl,
      providerSymbols: asset.providerSymbols,
      priceability: priceState.priceability,
      eligibilityByAccount,
      suggestedBucket: isCandidate ? asset.bucket : asset.suggestedBucket,
      riskLevel: isCandidate ? asset.riskLevel : asset.riskLevel,
      lastPrice: priceState.lastPrice,
      lastPriceCurrency: priceState.lastPriceCurrency,
      lastPriceAt: priceState.lastPriceAt,
      priceSource: priceState.priceSource,
      isAlreadyWatched: Boolean(interest),
      userInterestLevel:
        interest?.userInterestLevel === 'none' ||
        interest?.userInterestLevel === 'watching' ||
        interest?.userInterestLevel === 'interested' ||
        interest?.userInterestLevel === 'high_interest'
          ? interest.userInterestLevel
          : isCandidate
            ? asset.userInterestLevel
            : 'none',
      userIntent:
        interest?.userIntent === 'watch' ||
        interest?.userIntent === 'analyze' ||
        interest?.userIntent === 'compare' ||
        interest?.userIntent === 'consider_buy' ||
        interest?.userIntent === 'exclude'
          ? interest.userIntent
          : isCandidate
            ? asset.userIntent
            : 'watch',
      warnings,
    }
  }

  const searchAssets = async ({ mode, requestId, query }: AssetSearchInput) => {
    const normalizedQuery = query.trim().toLowerCase()
    const now = new Date()
    const { rows, interests } = await assetsForSearch(mode)
    const watched = new Map(
      interests.map(row => [`${normalizeAssetSymbol(row.symbol)}:${row.assetClass}`, row])
    )
    const filtered = rows
      .filter(asset => {
        if (normalizedQuery.length === 0) return true
        const haystack = [
          asset.symbol,
          asset.name,
          asset.assetClass,
          asset.exchange ?? '',
          asset.isin ?? '',
          ...Object.values(asset.providerSymbols),
        ]
          .join(' ')
          .toLowerCase()
        return haystack.includes(normalizedQuery)
      })
      .slice(0, 24)
    const symbols = [
      ...filtered.map(asset => asset.symbol),
      ...filtered.flatMap(asset => Object.values(asset.providerSymbols)),
    ]
    const priceRows =
      mode === 'demo' ? [] : await repository.latestPricesForSymbols(symbols.map(normalizeAssetSymbol))
    const prices = new Map<string, ReturnType<typeof priceRowToContract>>()
    for (const row of priceRows) {
      const price = priceRowToContract(row)
      prices.set(normalizeAssetSymbol(row.symbol), price)
      if (row.instrumentId) prices.set(normalizeAssetSymbol(row.instrumentId), price)
      if (row.assetId) prices.set(normalizeAssetSymbol(row.assetId), price)
    }
    const items = filtered.map(asset => {
      const priceSymbol =
        Object.values(asset.providerSymbols).find(symbol => prices.has(normalizeAssetSymbol(symbol))) ??
        asset.symbol
      return searchResultFromAsset({
        asset,
        price: prices.get(normalizeAssetSymbol(priceSymbol)) ?? null,
        watched,
        now,
      })
    })
    return {
      requestId,
      mode,
      source: mode === 'demo' ? 'demo_fixture' : 'db',
      query,
      items,
    }
  }

  const listAssetWatchlist = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') {
      return { requestId, mode, source: 'demo_fixture' as const, items: [] }
    }
    const rows = await repository.listUserAssetInterests()
    return { requestId, mode, source: 'db' as const, items: rows }
  }

  const getAssetDetails = async ({
    mode,
    requestId,
    assetId,
  }: {
    mode: Mode
    requestId: string
    assetId: string
  }) => {
    const symbol = normalizeAssetSymbol(assetId.replace(/^watchlist:/, '').replace(/^asset:/, ''))
    const result = await searchAssets({ mode, requestId, query: symbol })
    const item =
      result.items.find(candidate => normalizeAssetSymbol(candidate.symbol) === symbol) ??
      result.items[0] ??
      null
    return {
      requestId,
      mode,
      source: result.source,
      item,
    }
  }

  const addAssetToWatchlist = async ({
    mode,
    requestId,
    input,
  }: {
    mode: Mode
    requestId: string
    input: WatchlistAssetInput
  }) => {
    if (mode !== 'admin') throw new Error('DEMO_MODE_FORBIDDEN')
    const now = new Date()
    const row = await repository.upsertUserAssetInterest({
      normalizedSymbol: normalizeAssetSymbol(input.symbol),
      symbol: normalizeAssetSymbol(input.symbol),
      name: input.name,
      assetClass: input.assetClass,
      providerSymbolsJson: input.providerSymbols ?? {},
      iconUrl: input.iconUrl ?? null,
      logoUrl: input.logoUrl ?? null,
      isin: input.isin ?? null,
      exchange: input.exchange ?? null,
      currency: input.currency,
      userInterestLevel: input.userInterestLevel ?? 'watching',
      userIntent: input.userIntent ?? 'watch',
      note: input.note ?? null,
      createdAt: now,
      updatedAt: now,
    })
    return { requestId, mode, ok: Boolean(row), item: row }
  }

  const updateAssetWatchlist = async ({
    mode,
    requestId,
    watchlistId,
    input,
  }: {
    mode: Mode
    requestId: string
    watchlistId: number
    input: WatchlistAssetPatchInput
  }) => {
    if (mode !== 'admin') throw new Error('DEMO_MODE_FORBIDDEN')
    const row = await repository.updateUserAssetInterest(watchlistId, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.assetClass !== undefined ? { assetClass: input.assetClass } : {}),
      ...(input.providerSymbols !== undefined ? { providerSymbolsJson: input.providerSymbols } : {}),
      ...(input.iconUrl !== undefined ? { iconUrl: input.iconUrl } : {}),
      ...(input.logoUrl !== undefined ? { logoUrl: input.logoUrl } : {}),
      ...(input.isin !== undefined ? { isin: input.isin } : {}),
      ...(input.exchange !== undefined ? { exchange: input.exchange } : {}),
      ...(input.currency !== undefined ? { currency: input.currency } : {}),
      ...(input.userInterestLevel !== undefined
        ? { userInterestLevel: input.userInterestLevel }
        : {}),
      ...(input.userIntent !== undefined ? { userIntent: input.userIntent } : {}),
      ...(input.note !== undefined ? { note: input.note } : {}),
      updatedAt: new Date(),
    })
    return { requestId, mode, ok: Boolean(row), item: row }
  }

  const removeAssetFromWatchlist = async ({
    mode,
    requestId,
    watchlistId,
  }: {
    mode: Mode
    requestId: string
    watchlistId: number
  }) => {
    if (mode !== 'admin') throw new Error('DEMO_MODE_FORBIDDEN')
    const deleted = await repository.deleteUserAssetInterest(watchlistId)
    return { requestId, mode, ok: deleted, watchlistId }
  }

  const generateInvestmentPlan = async (input: GenerateActionPlanInput) => {
    if (input.mode === 'demo') return demoPlan(input.requestId)
    const bundle = await seedDefaultStrategyIfMissing()
    const plan = await buildPlan(bundle)
    if (input.dryRun) {
      return {
        requestId: input.requestId,
        mode: 'admin' as const,
        source: 'dry_run' as const,
        strategy: bundle.strategy,
        buckets: bundle.buckets,
        accountPolicies: bundle.accountPolicies,
        plan: { id: null, ...plan, topAction: plan.items[plan.topActionIndex] ?? null },
        hypotheses: buildHypothesisDrafts({ plan }),
        calibration: await getScorecard({ mode: 'admin', requestId: input.requestId }),
        warnings: plan.warnings,
      }
    }
    const persisted = await persistActionPlan({ requestId: input.requestId, bundle, plan })
    const calibration = await getScorecard({ mode: 'admin', requestId: input.requestId })
    const [lastRunGraph, historicalGraph] = await Promise.all([
      repository.memoryEventStatsForPlan(persisted.planRow.id),
      repository.memoryEventStats(),
    ])
    const graph = graphStatusFromMemoryStats({
      lastRun: lastRunGraph,
      historical: historicalGraph,
    })
    await persistContextBundle({
      requestId: input.requestId,
      bundle,
      allocation: plan.allocation,
      plan,
      calibration: calibration.scorecard,
    })
    return {
      requestId: input.requestId,
      mode: 'admin' as const,
      source: 'db' as const,
      strategy: bundle.strategy,
      buckets: bundle.buckets,
      accountPolicies: bundle.accountPolicies,
      plan: {
        id: persisted.planRow.id,
        ...plan,
        topAction: plan.items[plan.topActionIndex] ?? null,
        graph,
      },
      hypotheses: persisted.hypotheses,
      calibration: calibration.scorecard,
      warnings: [...plan.warnings, ...activeGraphWarnings(graph)],
    }
  }

  const latestInvestmentPlan = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') return demoPlan(requestId)
    const bundle = await getActiveStrategyBundle()
    const latest = await repository.latestActionPlan()
    if (!bundle || !latest) {
      return {
        requestId,
        mode,
        source: 'empty' as const,
        strategy: bundle?.strategy ?? null,
        buckets: bundle?.buckets ?? [],
        accountPolicies: bundle?.accountPolicies ?? [],
        plan: null,
        warnings: ['no_active_action_plan'],
      }
    }
    const [latestAllocation, lastRunGraph, historicalGraph] = await Promise.all([
      repository.latestAllocationSnapshot(bundle.strategy.id),
      repository.memoryEventStatsForPlan(latest.plan.id),
      repository.memoryEventStats(),
    ])
    const allocation = latestAllocation ? mapPersistedAllocation(latestAllocation) : null
    const contribution = allocation ? contributionFromAllocation(allocation) : []
    const enrichedItems: Array<ActionPlanDraft['items'][number] & { id: number }> =
      latest.items.map(item => {
        const dataFreshness = priceFreshnessFromJson(toJsonRecord(item.dataFreshnessJson))
        const amountValue = toNumberOrNull(item.amountValue)
        const argumentsAgainst = toStringArray(item.argumentsAgainstJson)
        return {
          id: item.id,
          accountPolicyId: item.accountPolicyId,
          accountLabel: item.accountLabel,
          accountType: item.accountType,
          bucket: item.bucket,
          symbol: item.symbol,
          assetName: item.assetName,
          action: item.action,
          amountValue,
          amountCurrency: item.amountCurrency,
          targetWeightPct: item.targetWeightPct,
          currentWeightPct: item.currentWeightPct,
          confidence: item.confidence,
          riskLevel: item.riskLevel,
          horizon: item.horizon,
          thesis: item.thesis,
          argumentsFor: toStringArray(item.argumentsForJson),
          argumentsAgainst,
          invalidationCriteria: toStringArray(item.invalidationCriteriaJson),
          priceSnapshotId: item.priceSnapshotId,
          valuationSnapshotId: item.valuationSnapshotId,
          dataFreshness,
          priceability: dataFreshness.price === null ? 'missing' : dataFreshness.isStale ? 'stale' : 'priceable',
          recommendabilityStatus:
            item.action === 'buy'
              ? 'recommendable'
              : dataFreshness.price === null
                ? 'blocked_missing_price'
                : dataFreshness.isStale
                  ? 'blocked_stale_price'
                  : 'watch_only',
          recommendationTier:
            item.action === 'avoid'
              ? 'avoid'
              : item.accountLabel === 'Watchlist utilisateur'
                ? 'user_watchlist'
                : item.bucket === 'core'
                  ? 'core_candidate'
                  : item.bucket === 'growth'
                    ? 'growth_candidate'
                    : 'asymmetric_candidate',
          recommendationMode:
            item.action === 'buy'
              ? 'action_now'
              : item.action === 'avoid'
                ? 'avoid'
                : item.accountLabel === 'Watchlist utilisateur'
                  ? 'watch'
                  : 'research_more',
          userInterestLevel: item.accountLabel === 'Watchlist utilisateur' ? 'watching' : 'none',
          userIntent: item.accountLabel === 'Watchlist utilisateur' ? 'watch' : 'analyze',
          recommendedTradeAmount: item.action === 'buy' ? amountValue : null,
          recommendedContributionAmount:
            contribution.find(candidate => candidate.bucket === item.bucket)?.amount ?? null,
          setupActionRequired: item.action === 'buy' ? null : (argumentsAgainst[0] ?? null),
          blockingReasons: argumentsAgainst,
          humanValidationRequired: true,
          noAutoTrade: true,
          createsHypothesis: item.createsHypothesis,
          score: 0,
        }
      })
    const actionableSteps =
      allocation === null
        ? []
        : buildActionableStepsFromPersistedPlan({ items: enrichedItems, allocation, contribution })
    const graph = graphStatusFromMemoryStats({
      lastRun: lastRunGraph,
      historical: historicalGraph,
    })
    const topAction =
      enrichedItems.find(item => item.id === latest.plan.topActionId) ?? enrichedItems[0] ?? null
    return {
      requestId,
      mode,
      source: 'db' as const,
      strategy: bundle.strategy,
      buckets: bundle.buckets,
      accountPolicies: bundle.accountPolicies,
      plan: {
        id: latest.plan.id,
        strategyId: latest.plan.strategyId,
        generatedAt: latest.plan.generatedAt.toISOString(),
        status: latest.plan.status,
        summary: latest.plan.summary,
        globalRisk: latest.plan.globalRisk,
        globalConfidence: latest.plan.globalConfidence,
        dataQualityStatus: latest.plan.dataQualityStatus,
        noAutoTrade: latest.plan.noAutoTrade,
        humanValidationRequired: latest.plan.humanValidationRequired,
        topActionId: latest.plan.topActionId,
        topAction,
        items: enrichedItems,
        contribution,
        actionableSteps,
        graph,
        ...(allocation ? { allocation } : {}),
      },
      warnings: activeGraphWarnings(graph),
    }
  }

  const listHypotheses = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') {
      return { requestId, mode, source: 'demo_fixture' as const, items: [] }
    }
    const due = await repository.duePredictionOutcomes(new Date(), 100)
    return {
      requestId,
      mode,
      source: 'db' as const,
      items: due.map(row => ({
        hypothesis: row.hypothesis,
        dueOutcome: row.outcome,
      })),
    }
  }

  const reviewDueHypotheses = async (input: ReviewDueInput) => {
    if (input.mode !== 'admin') throw new Error('DEMO_MODE_FORBIDDEN')
    const bundle = await seedDefaultStrategyIfMissing()
    const due = await repository.duePredictionOutcomes(new Date(), input.limit ?? 50)
    const symbols = [...new Set(due.map(row => row.hypothesis.symbol))]
    const priceRows = await repository.latestPricesForSymbols(symbols)
    const prices = new Map(priceRows.map(row => [row.symbol, priceRowToContract(row)]))
    const scored = []
    if (input.dryRun) {
      return {
        requestId: input.requestId,
        mode: 'admin' as const,
        source: 'dry_run' as const,
        reviewedCount: 0,
        dueCount: due.length,
        outcomes: [],
        calibration: buildCalibrationSnapshot({ strategyId: bundle.strategy.id, outcomes: [] }),
      }
    }
    for (const row of due) {
      const price = getReliablePriceForRecommendation({
        snapshot: prices.get(row.hypothesis.symbol) ?? null,
      })
      const outcome = scoreOutcome({
        outcomeId: row.outcome.id,
        hypothesisId: row.hypothesis.id,
        reviewHorizon: row.outcome.reviewHorizon,
        reviewDueAt: row.outcome.reviewDueAt,
        symbol: row.hypothesis.symbol,
        accountScope: row.hypothesis.accountScope,
        actionSuggested: row.hypothesis.actionSuggested,
        direction: row.hypothesis.direction,
        probability: row.hypothesis.probability,
        confidence: row.hypothesis.confidence,
        initialPrice: toNumberOrNull(row.outcome.initialPrice ?? row.hypothesis.priceAtPrediction),
        reviewPrice: price.freshness.price,
        benchmarkPrice: null,
        priceStatus: price.status,
      })
      const dbResult =
        outcome.result === 'skipped_missing_price' || outcome.result === 'skipped_stale_data'
          ? 'skipped'
          : outcome.result
      const updated = await repository.updatePredictionOutcome(row.outcome.id, {
        reviewedAt: outcome.reviewedAt,
        reviewPrice: outcome.reviewPrice === null ? null : outcome.reviewPrice.toFixed(10),
        benchmarkPrice: null,
        performance: outcome.performance,
        performanceVsBenchmark: outcome.performanceVsBenchmark,
        result: dbResult,
        errorAttribution: outcome.errorAttribution,
        dataQualityNotes: outcome.dataQualityNotes,
        pricingFreshnessNotes: outcome.pricingFreshnessNotes,
      })
      await repository.closeHypothesisIfComplete(row.hypothesis.id)
      if (updated && ['success', 'failure', 'mixed'].includes(dbResult)) {
        const postMortem = buildPostMortemFallback({
          hypothesisId: row.hypothesis.id,
          outcomeId: row.outcome.id,
          outcome,
          thesis: row.hypothesis.thesis,
        })
        const persistedPostMortem = await repository.insertPostMortem({
          hypothesisId: postMortem.hypothesisId,
          outcomeId: postMortem.outcomeId,
          result: postMortem.result,
          whatWorked: postMortem.whatWorked,
          whatFailed: postMortem.whatFailed,
          whyItWorkedOrFailed: postMortem.whyItWorkedOrFailed,
          lesson: postMortem.lesson,
          futurePromptHint: postMortem.futurePromptHint,
          reusableRuleCandidate: postMortem.reusableRuleCandidate,
          shouldUpdateStrategy: false,
          requiresHumanReview: true,
          memoryWriteStatus: 'pending',
        })
        const lesson = await repository.insertStrategyLesson({
          strategyId: bundle.strategy.id,
          sourceHypothesisId: row.hypothesis.id,
          sourcePostMortemId: persistedPostMortem?.id ?? null,
          lessonType: dbResult === 'success' ? 'reinforce_caution' : 'confidence_rule_candidate',
          title:
            dbResult === 'success'
              ? `Hypothese ${row.hypothesis.symbol} validee avec prudence`
              : `Hypothese ${row.hypothesis.symbol} a revoir`,
          description: postMortem.lesson,
          confidenceImpact: dbResult === 'success' ? 0.01 : -0.05,
          ruleCandidateJson: { reusableRuleCandidate: postMortem.reusableRuleCandidate },
          status: 'candidate',
          requiresHumanReview: true,
        })
        await persistMemoryEvent({
          requestId: input.requestId,
          hypothesisId: row.hypothesis.id,
          eventType:
            dbResult === 'success'
              ? 'outcome_success'
              : dbResult === 'failure'
                ? 'outcome_failure'
                : 'outcome_mixed',
          payload: {
            outcomeId: row.outcome.id,
            postMortemId: persistedPostMortem?.id ?? null,
            lessonId: lesson?.id ?? null,
            symbol: row.hypothesis.symbol,
            result: dbResult,
            performance: outcome.performance,
          },
        })
      }
      scored.push({ row, outcome })
    }
    const recent = await repository.recentOutcomesWithHypotheses(200)
    const calibration = buildCalibrationSnapshot({
      strategyId: bundle.strategy.id,
      outcomes: recent.map(item => ({
        result: item.outcome.result,
        confidence: item.hypothesis.confidence,
        probability: item.hypothesis.probability,
      })),
    })
    await repository.insertCalibrationSnapshot({
      strategyId: calibration.strategyId,
      generatedAt: new Date(calibration.generatedAt),
      horizon: calibration.horizon,
      sampleSize: calibration.sampleSize,
      hitRate: calibration.hitRate,
      brierScore: calibration.brierScore,
      averageConfidence: calibration.averageConfidence,
      calibrationBucketsJson: calibration.calibrationBuckets,
      byBucketJson: calibration.byBucket,
      byAccountJson: calibration.byAccount,
      byAssetClassJson: calibration.byAssetClass,
      notes: calibration.notes,
    })
    return {
      requestId: input.requestId,
      mode: 'admin' as const,
      source: 'db' as const,
      reviewedCount: scored.length,
      dueCount: due.length,
      outcomes: scored.map(item => item.outcome),
      calibration,
    }
  }

  const getScorecard = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') {
      return {
        requestId,
        mode,
        source: 'demo_fixture' as const,
        scorecard: demoPlan(requestId).calibration,
      }
    }
    const bundle = await getActiveStrategyBundle()
    if (!bundle) {
      return {
        requestId,
        mode,
        source: 'empty' as const,
        scorecard: null,
      }
    }
    const latest = await repository.latestCalibrationSnapshot(bundle.strategy.id)
    return {
      requestId,
      mode,
      source: latest ? 'db' : 'empty',
      scorecard: latest
        ? {
            strategyId: latest.strategyId,
            generatedAt: latest.generatedAt.toISOString(),
            horizon: latest.horizon,
            sampleSize: latest.sampleSize,
            hitRate: latest.hitRate,
            brierScore: latest.brierScore,
            averageConfidence: latest.averageConfidence,
            calibrationBuckets: latest.calibrationBucketsJson,
            byBucket: latest.byBucketJson,
            byAccount: latest.byAccountJson,
            byAssetClass: latest.byAssetClassJson,
            notes: latest.notes,
          }
        : null,
    }
  }

  const listLessons = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') return { requestId, mode, source: 'demo_fixture' as const, items: [] }
    const bundle = await seedDefaultStrategyIfMissing()
    const items = await repository.listLessons(bundle.strategy.id)
    return { requestId, mode, source: 'db' as const, items }
  }

  const updateLessonStatus = async ({
    mode,
    requestId,
    lessonId,
    status,
  }: {
    mode: Mode
    requestId: string
    lessonId: number
    status: 'approved' | 'rejected'
  }) => {
    if (mode !== 'admin') throw new Error('DEMO_MODE_FORBIDDEN')
    const updated = await repository.updateLessonStatus(lessonId, status)
    return { requestId, mode, ok: Boolean(updated), item: updated }
  }

  const getStatus = async ({ mode, requestId }: { mode: Mode; requestId: string }) => {
    if (mode === 'demo') {
      const plan = demoPlan(requestId)
      return {
        requestId,
        mode,
        source: 'demo_fixture' as const,
        enabled: true,
        healthy: true,
        latestActionPlan: plan.plan,
        latestAllocationSnapshot: plan.plan.allocation,
        learning: plan.calibration,
        memory: {
          memoryEventsCreated: 0,
          graphWritesAttempted: 0,
          graphWritesSucceeded: 0,
          graphWritesFailed: 0,
          lastGraphError: null,
        },
        staleProviders: [],
        failedJobs: [],
      }
    }
    const bundle = await getActiveStrategyBundle()
    const [latestPlan, latestAllocation, memory, scorecard] = await Promise.all([
      repository.latestActionPlan(),
      bundle ? repository.latestAllocationSnapshot(bundle.strategy.id) : Promise.resolve(null),
      repository.memoryEventStats(),
      bundle ? repository.latestCalibrationSnapshot(bundle.strategy.id) : Promise.resolve(null),
    ])
    const graphWritesAttempted = memory.rows
      .filter(row => row.status !== 'skipped' && row.status !== 'pending')
      .reduce((sum, row) => sum + row.count, 0)
    return {
      requestId,
      mode,
      source: 'db' as const,
      enabled: true,
      healthy: Boolean(bundle),
      latestActionPlan: latestPlan,
      latestAllocationSnapshot: latestAllocation,
      learning: scorecard,
      memory: {
        memoryEventsCreated: memory.rows.reduce((sum, row) => sum + row.count, 0),
        graphWritesAttempted,
        graphWritesSucceeded: memory.rows.find(row => row.status === 'sent')?.count ?? 0,
        graphWritesFailed: memory.rows.find(row => row.status === 'failed')?.count ?? 0,
        lastGraphError: memory.latestFailure?.graphWriteError ?? null,
      },
      staleProviders:
        latestPlan?.items
          .filter(item => {
            const freshness = toJsonRecord(item.dataFreshnessJson)
            return freshness.isStale === true
          })
          .map(item => item.accountLabel) ?? [],
      failedJobs: [],
    }
  }

  return {
    seedDefaultStrategyIfMissing,
    getInvestmentStrategy,
    updateInvestmentStrategy,
    searchAssets,
    getAssetDetails,
    listAssetWatchlist,
    addAssetToWatchlist,
    updateAssetWatchlist,
    removeAssetFromWatchlist,
    generateInvestmentPlan,
    latestInvestmentPlan,
    listHypotheses,
    reviewDueHypotheses,
    getScorecard,
    listLessons,
    updateLessonStatus,
    getStatus,
  }
}
