import { describe, expect, it } from 'bun:test'
import {
  buildActionPlanDraft,
  buildCalibrationSnapshot,
  buildHypothesisDrafts,
  buildPostMortemFallback,
  computePortfolioAllocation,
  computeStrategyDrift,
  createMemoryPayload,
  defaultAccountPolicies,
  defaultBuckets,
  enforceRiskPolicy,
  getReliablePriceForRecommendation,
  scoreOutcome,
  validateStrategy,
  type AllocationSnapshotDto,
  type AssetCandidateDto,
  type StrategyBundle,
  type StrategyProfileDto,
} from './investment-strategy-engine'

const now = new Date('2026-05-23T08:00:00.000Z')

const strategy: StrategyProfileDto = {
  id: 1,
  name: 'bigzoo_growth_60_30_10_v1',
  version: 'v1',
  status: 'active',
  description: 'test strategy',
  riskProfile: 'growth',
  horizonYears: 12,
  baseCurrency: 'EUR',
  monthlyContributionTarget: 300,
  rebalanceThresholdPct: 5,
  reviewFrequency: 'daily_monitoring',
  noAutoTrade: true,
  humanValidationRequired: true,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
}

const buckets = defaultBuckets(1).map((bucket, index) => ({ ...bucket, id: index + 1 }))
const policies = defaultAccountPolicies(1).map((policy, index) => ({ ...policy, id: index + 1 }))

const candidate = (input: Partial<AssetCandidateDto> & Pick<AssetCandidateDto, 'symbol'>): AssetCandidateDto => ({
  id: input.id ?? 1,
  symbol: input.symbol,
  name: input.name ?? input.symbol,
  assetClass: input.assetClass ?? 'etf',
  bucket: input.bucket ?? 'core',
  accountTypesAllowed: input.accountTypesAllowed ?? ['pea', 'brokerage'],
  providerSymbols: input.providerSymbols ?? {},
  isin: input.isin ?? null,
  exchange: input.exchange ?? null,
  currency: input.currency ?? 'EUR',
  eligibilityStatus: input.eligibilityStatus ?? 'approved',
  peaEligibilityStatus: input.peaEligibilityStatus ?? 'eligible',
  riskLevel: input.riskLevel ?? 'medium',
  liquidityScore: input.liquidityScore ?? 0.8,
  notes: input.notes ?? null,
  source: input.source ?? 'test',
})

const freshPrice = (symbol: string, overrides: Record<string, unknown> = {}) =>
  ({
    id: 10,
    assetId: null,
    instrumentId: null,
    symbol,
    assetClass: 'etf',
    provider: 'test_provider',
    sourceType: 'delayed',
    price: 100,
    currency: 'EUR',
    marketTimestamp: '2026-05-23T07:55:00.000Z',
    fetchedAt: '2026-05-23T07:56:00.000Z',
    delaySeconds: 60,
    staleAfterSeconds: 3600,
    isMarketOpen: true,
    confidence: 0.82,
    ...overrides,
  }) as never

const allocation = (asymmetricPct = 8): AllocationSnapshotDto => ({
  strategyId: 1,
  snapshotAt: now.toISOString(),
  baseCurrency: 'EUR',
  totalValue: 10_000,
  coreValue: 5_800,
  growthValue: 3_000,
  asymmetricValue: asymmetricPct * 100,
  cashValue: 400,
  unknownValue: 0,
  corePct: 58,
  growthPct: 30,
  asymmetricPct,
  drift: [],
  dataQuality: {
    status: 'ready',
    confidence: 0.9,
    unknownValue: 0,
    unknownPositionCount: 0,
    stalePositionCount: 0,
    missingPriceSymbols: [],
    stalePriceSymbols: [],
    providerWarnings: [],
    fxWarnings: [],
    graphWarnings: [],
  },
  holdings: [],
})

const bundle = (candidates: AssetCandidateDto[]): StrategyBundle => ({
  strategy,
  buckets,
  accountPolicies: policies,
  candidates,
})

describe('investment strategy engine', () => {
  it('accepts the default 60 / 30 / 10 strategy and rejects invalid totals', () => {
    expect(validateStrategy(buckets).valid).toBe(true)
    const invalid = validateStrategy([
      { bucketKey: 'core', targetPct: 60 },
      { bucketKey: 'growth', targetPct: 25 },
      { bucketKey: 'asymmetric', targetPct: 10 },
    ])
    expect(invalid.valid).toBe(false)
    expect(invalid.errors[0]).toContain('not_100')
  })

  it('blocks PEA buys when eligibility is unknown even with a fresh price', () => {
    const peaPolicy = policies.find(policy => policy.accountType === 'pea')
    if (!peaPolicy) throw new Error('PEA policy missing from default policies')
    const asset = candidate({
      symbol: 'PEA_REVIEW',
      peaEligibilityStatus: 'unknown',
      providerSymbols: { trade_republic: 'PEA_REVIEW' },
    })
    const decision = enforceRiskPolicy({
      policy: peaPolicy,
      candidate: asset,
      allocation: allocation(),
      price: getReliablePriceForRecommendation({ snapshot: freshPrice('PEA_REVIEW'), now }),
      bucket: 'core',
      proposedAmount: 100,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.action).toBe('watch')
    expect(decision.reasons.join(' ')).toContain('Eligibility PEA inconnue')
  })

  it('blocks Binance buys when asymmetric exposure is already at the 10 percent cap', () => {
    const binancePolicy = policies.find(policy => policy.accountType === 'crypto')
    if (!binancePolicy) throw new Error('Binance policy missing from default policies')
    const btc = candidate({
      symbol: 'BTC',
      assetClass: 'crypto',
      bucket: 'asymmetric',
      accountTypesAllowed: ['crypto'],
      peaEligibilityStatus: 'not_applicable',
      riskLevel: 'very_high',
      providerSymbols: { binance: 'BTCEUR' },
    })
    const decision = enforceRiskPolicy({
      policy: binancePolicy,
      candidate: btc,
      allocation: allocation(10),
      price: getReliablePriceForRecommendation({ snapshot: freshPrice('BTCEUR'), now }),
      bucket: 'asymmetric',
      proposedAmount: 100,
    })
    expect(decision.allowed).toBe(false)
    expect(decision.reasons.join(' ')).toContain('cap global de 10%')
  })

  it('blocks buys when price is stale or low-confidence', () => {
    const stale = getReliablePriceForRecommendation({
      snapshot: freshPrice('STALE', {
        marketTimestamp: '2026-05-20T07:00:00.000Z',
        fetchedAt: '2026-05-20T07:00:00.000Z',
        staleAfterSeconds: 60,
      }),
      now,
    })
    const lowConfidence = getReliablePriceForRecommendation({
      snapshot: freshPrice('LOW', { confidence: 0.2 }),
      now,
    })
    expect(stale.canBuy).toBe(false)
    expect(stale.status).toBe('stale')
    expect(lowConfidence.canBuy).toBe(false)
    expect(lowConfidence.status).toBe('low_confidence')
  })

  it('allocates new contributions to underweight buckets and avoids sell instructions', () => {
    const drift = computeStrategyDrift({
      buckets,
      actualPct: { core: 50, growth: 35, asymmetric: 8 },
      monthlyContributionTarget: 300,
      thresholdPct: 5,
      currency: 'EUR',
    })
    const core = drift.find(item => item.bucket === 'core')
    expect(core?.recommendedContribution).toBeGreaterThan(0)
    expect(core?.recommendedAction.toLowerCase()).toContain('apport')
    expect(core?.recommendedAction.toLowerCase()).not.toContain('vendre')
  })

  it('computes allocation drift from holdings and chooses a safe non-buy top action when universe is not approved', () => {
    const plan = buildActionPlanDraft({
      bundle: bundle([
        candidate({
          symbol: 'CORE_REVIEW',
          eligibilityStatus: 'candidate_needs_review',
          providerSymbols: { trade_republic: 'CORE_REVIEW' },
        }),
      ]),
      allocation: computePortfolioAllocation({
        strategy,
        buckets,
        candidates: [],
        holdings: [
          {
            provider: 'trade_republic',
            accountId: 'pea',
            accountLabel: 'PEA Trade Republic',
            accountType: 'pea',
            symbol: 'CORE_REVIEW',
            name: 'Core review',
            assetClass: 'etf',
            value: 5_000,
            currency: 'EUR',
            valueAsOf: now.toISOString(),
            quantity: 10,
            degradedReasons: [],
            assumptions: [],
          },
        ],
        now,
      }),
      latestPrices: { CORE_REVIEW: freshPrice('CORE_REVIEW') },
      now,
    })
    expect(plan.items.every(item => item.noAutoTrade && item.humanValidationRequired)).toBe(true)
    expect(plan.items.some(item => item.action === 'buy')).toBe(false)
    expect(plan.items[plan.topActionIndex]?.action).not.toBe('buy')
  })

  it('creates reviewable hypotheses from actionable plan items', () => {
    const plan = buildActionPlanDraft({
      bundle: bundle([
        candidate({
          symbol: 'CORE_OK',
          providerSymbols: { trade_republic: 'CORE_OK' },
        }),
      ]),
      allocation: allocation(),
      latestPrices: { CORE_OK: freshPrice('CORE_OK') },
      now,
    })
    const hypotheses = buildHypothesisDrafts({ plan, now })
    expect(hypotheses.length).toBeGreaterThan(0)
    expect(hypotheses[0]?.outcomeReviews.map(review => review.reviewHorizon)).toEqual([
      'J1',
      'J7',
      'J30',
    ])
  })

  it('scores outcomes, calibration and deterministic post-mortems without claiming certainty', () => {
    const outcome = scoreOutcome({
      outcomeId: 1,
      hypothesisId: 2,
      reviewHorizon: 'J7',
      reviewDueAt: now,
      symbol: 'CORE_OK',
      accountScope: 'PEA',
      actionSuggested: 'buy',
      direction: 'bullish',
      probability: 0.7,
      confidence: 0.7,
      initialPrice: 100,
      reviewPrice: 103,
      benchmarkPrice: null,
      priceStatus: 'fresh',
    })
    expect(outcome.result).toBe('success')
    const calibration = buildCalibrationSnapshot({
      strategyId: 1,
      outcomes: [
        { result: 'success', confidence: 0.7, probability: 0.7 },
        { result: 'failure', confidence: 0.8, probability: 0.8 },
      ],
      generatedAt: now,
    })
    expect(calibration.sampleSize).toBe(2)
    expect(calibration.brierScore).not.toBeNull()
    const postMortem = buildPostMortemFallback({
      hypothesisId: 2,
      outcomeId: 1,
      outcome,
      thesis: 'Test thesis',
    })
    expect(postMortem.shouldUpdateStrategy).toBe(false)
    expect(postMortem.requiresHumanReview).toBe(true)
  })

  it('creates secret-safe advisory memory payloads', () => {
    const memory = createMemoryPayload('risk_limit_triggered', {
      provider: 'binance',
      reason: 'crypto_cap',
    })
    expect(memory.payload.noAutoTrade).toBe(true)
    expect(memory.payload.advisoryOnly).toBe(true)
    expect(JSON.stringify(memory).toLowerCase()).not.toContain('token')
  })
})
