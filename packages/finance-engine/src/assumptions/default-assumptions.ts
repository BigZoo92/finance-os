import type {
  AssetClass,
  AssetClassAssumption,
  RiskProfile,
  RiskProfileTargets,
} from '../types'

export const DEFAULT_INFLATION_ASSUMPTION_PCT = 2.5
export const DEFAULT_CASH_RATE_PCT = 1.75

export const ASSET_CLASS_ASSUMPTIONS: Record<AssetClass, AssetClassAssumption> = {
  cash: {
    assetClass: 'cash',
    expectedReturnPct: DEFAULT_CASH_RATE_PCT,
    expectedRealReturnPctFloor: -1.5,
    volatilityPct: 0.5,
    downsideDeviationPct: 0.2,
    stressShockPct: 0,
    feeBpsDefault: 0,
    labels: ['cash', 'checking', 'savings', 'livret'],
  },
  equity_global: {
    assetClass: 'equity_global',
    expectedReturnPct: 6.5,
    expectedRealReturnPctFloor: 1,
    volatilityPct: 16,
    downsideDeviationPct: 11,
    stressShockPct: -24,
    feeBpsDefault: 22,
    labels: ['world', 'global', 'msci world', 'cw8', 'etf monde'],
  },
  equity_us: {
    assetClass: 'equity_us',
    expectedReturnPct: 6.75,
    expectedRealReturnPctFloor: 1,
    volatilityPct: 17,
    downsideDeviationPct: 11.5,
    stressShockPct: -26,
    feeBpsDefault: 20,
    labels: ['s&p', 'nasdaq', 'qqq', 'spy', 'us equity'],
  },
  equity_europe: {
    assetClass: 'equity_europe',
    expectedReturnPct: 6.1,
    expectedRealReturnPctFloor: 0.7,
    volatilityPct: 16.5,
    downsideDeviationPct: 11.5,
    stressShockPct: -25,
    feeBpsDefault: 20,
    labels: ['europe', 'stoxx', 'euro'],
  },
  equity_emerging: {
    assetClass: 'equity_emerging',
    expectedReturnPct: 7,
    expectedRealReturnPctFloor: 1.2,
    volatilityPct: 20,
    downsideDeviationPct: 14,
    stressShockPct: -30,
    feeBpsDefault: 28,
    labels: ['emerging', 'iemg', 'em', 'china', 'india'],
  },
  fixed_income: {
    assetClass: 'fixed_income',
    expectedReturnPct: 3.4,
    expectedRealReturnPctFloor: -0.5,
    volatilityPct: 6.5,
    downsideDeviationPct: 4.5,
    stressShockPct: -8,
    feeBpsDefault: 15,
    labels: ['bond', 'obligation', 'treasury', 'aggregate'],
  },
  gold: {
    assetClass: 'gold',
    expectedReturnPct: 3.8,
    expectedRealReturnPctFloor: 0,
    volatilityPct: 13,
    downsideDeviationPct: 9,
    stressShockPct: -12,
    feeBpsDefault: 35,
    labels: ['gold', 'or', 'xau'],
  },
  real_estate: {
    assetClass: 'real_estate',
    expectedReturnPct: 5,
    expectedRealReturnPctFloor: 0.5,
    volatilityPct: 11,
    downsideDeviationPct: 7.5,
    stressShockPct: -15,
    feeBpsDefault: 45,
    labels: ['reit', 'scpi', 'real estate', 'immobilier'],
  },
  alternatives: {
    assetClass: 'alternatives',
    expectedReturnPct: 4.8,
    expectedRealReturnPctFloor: 0.2,
    volatilityPct: 14,
    downsideDeviationPct: 10,
    stressShockPct: -18,
    feeBpsDefault: 60,
    labels: ['alternative', 'commodity', 'private market'],
  },
  unknown: {
    assetClass: 'unknown',
    expectedReturnPct: 4.5,
    expectedRealReturnPctFloor: 0,
    volatilityPct: 12,
    downsideDeviationPct: 8,
    stressShockPct: -15,
    feeBpsDefault: 35,
    labels: ['unknown'],
  },
}

const createRange = (min: number, max: number) => ({
  min,
  max,
  midpoint: Math.round((min + max) / 2),
})

export const RISK_PROFILE_TARGETS: Record<RiskProfile, RiskProfileTargets> = {
  conservative: {
    riskProfile: 'conservative',
    emergencyFundMonths: 9,
    opportunisticSleeveCapPct: 5,
    rebalancingBandPct: 5,
    targetAllocations: {
      cash: createRange(10, 25),
      growth: createRange(25, 45),
      defensive: createRange(35, 60),
    },
  },
  balanced: {
    riskProfile: 'balanced',
    emergencyFundMonths: 6,
    opportunisticSleeveCapPct: 10,
    rebalancingBandPct: 7,
    targetAllocations: {
      cash: createRange(5, 15),
      growth: createRange(45, 65),
      defensive: createRange(20, 40),
    },
  },
  growth: {
    riskProfile: 'growth',
    emergencyFundMonths: 5,
    opportunisticSleeveCapPct: 12,
    rebalancingBandPct: 8,
    targetAllocations: {
      cash: createRange(3, 12),
      growth: createRange(65, 85),
      defensive: createRange(5, 20),
    },
  },
}
