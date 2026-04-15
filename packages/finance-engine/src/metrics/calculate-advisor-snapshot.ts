import {
  ASSET_CLASS_ASSUMPTIONS,
  DEFAULT_CASH_RATE_PCT,
  DEFAULT_INFLATION_ASSUMPTION_PCT,
  RISK_PROFILE_TARGETS,
} from '../assumptions/default-assumptions'
import type {
  AdvisorAssumptionLog,
  AdvisorSnapshot,
  AllocationBucket,
  AssetClass,
  AssetClassAllocation,
  DailyWealthPoint,
  DriftSignal,
  FinanceEngineInput,
  FinancePositionInput,
  RiskProfile,
  ScenarioResult,
} from '../types'

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0)

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const toWeight = (value: number, total: number) => (total > 0 ? value / total : 0)

const inferRiskProfile = ({
  explicitRiskProfile,
  growthWeight,
  cashWeight,
}: {
  explicitRiskProfile?: RiskProfile | null
  growthWeight: number
  cashWeight: number
}): RiskProfile => {
  if (explicitRiskProfile) {
    return explicitRiskProfile
  }

  if (growthWeight >= 0.68 && cashWeight <= 0.15) {
    return 'growth'
  }

  if (growthWeight <= 0.42 || cashWeight >= 0.24) {
    return 'conservative'
  }

  return 'balanced'
}

const classifyBucket = (assetClass: AssetClass): 'cash' | 'growth' | 'defensive' => {
  if (assetClass === 'cash') {
    return 'cash'
  }

  if (assetClass === 'fixed_income' || assetClass === 'gold') {
    return 'defensive'
  }

  return 'growth'
}

const estimateCorrelation = (left: AssetClass, right: AssetClass) => {
  if (left === right) {
    return 1
  }

  if (left === 'cash' || right === 'cash') {
    return 0
  }

  if (
    (left === 'fixed_income' &&
      (right === 'equity_global' ||
        right === 'equity_us' ||
        right === 'equity_europe' ||
        right === 'equity_emerging')) ||
    (right === 'fixed_income' &&
      (left === 'equity_global' ||
        left === 'equity_us' ||
        left === 'equity_europe' ||
        left === 'equity_emerging'))
  ) {
    return 0.2
  }

  if (
    (left === 'gold' &&
      (right === 'equity_global' ||
        right === 'equity_us' ||
        right === 'equity_europe' ||
        right === 'equity_emerging')) ||
    (right === 'gold' &&
      (left === 'equity_global' ||
        left === 'equity_us' ||
        left === 'equity_europe' ||
        left === 'equity_emerging'))
  ) {
    return 0.15
  }

  if (left === 'fixed_income' && right === 'gold') {
    return 0.1
  }

  return 0.35
}

const computeDiversifiedVolatility = (
  positions: Array<{ assetClass: AssetClass; weight: number }>,
  key: 'volatilityPct' | 'downsideDeviationPct'
) => {
  let variance = 0

  for (let index = 0; index < positions.length; index += 1) {
    const left = positions[index]
    if (!left) continue

    const leftSigma = ASSET_CLASS_ASSUMPTIONS[left.assetClass][key]
    variance += left.weight * left.weight * leftSigma * leftSigma

    for (let inner = index + 1; inner < positions.length; inner += 1) {
      const right = positions[inner]
      if (!right) continue

      const rightSigma = ASSET_CLASS_ASSUMPTIONS[right.assetClass][key]
      const correlation = estimateCorrelation(left.assetClass, right.assetClass)
      variance += 2 * left.weight * right.weight * leftSigma * rightSigma * correlation
    }
  }

  return Math.sqrt(Math.max(variance, 0))
}

const computeObservedMaxDrawdown = (dailyWealth: DailyWealthPoint[]) => {
  if (dailyWealth.length < 2) {
    return null
  }

  let peak = dailyWealth[0]?.balance ?? 0
  let maxDrawdown = 0

  for (const point of dailyWealth) {
    peak = Math.max(peak, point.balance)
    if (peak <= 0) {
      continue
    }

    const drawdown = (peak - point.balance) / peak
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown
    }
  }

  return round(maxDrawdown * 100, 2)
}

const buildAllocationBuckets = (
  positions: FinancePositionInput[],
  totalValue: number
): AllocationBucket[] => {
  const buckets = {
    cash: 0,
    growth: 0,
    defensive: 0,
  }

  for (const position of positions) {
    buckets[classifyBucket(position.assetClass)] += position.value
  }

  return (Object.entries(buckets) as Array<[AllocationBucket['bucket'], number]>).map(
    ([bucket, value]) => ({
      bucket,
      value: round(value),
      weightPct: round(toWeight(value, totalValue) * 100),
    })
  )
}

const buildDriftSignals = ({
  buckets,
  riskProfile,
}: {
  buckets: AllocationBucket[]
  riskProfile: RiskProfile
}): DriftSignal[] => {
  const targets = RISK_PROFILE_TARGETS[riskProfile].targetAllocations

  return buckets.map(bucket => {
    const range = targets[bucket.bucket as keyof typeof targets]
    const driftPct = bucket.weightPct - range.midpoint
    let status: DriftSignal['status'] = 'within_band'

    if (bucket.weightPct < range.min) {
      status = 'underweight'
    } else if (bucket.weightPct > range.max) {
      status = 'overweight'
    }

    return {
      bucket: bucket.bucket as DriftSignal['bucket'],
      weightPct: bucket.weightPct,
      targetMinPct: range.min,
      targetMaxPct: range.max,
      midpointPct: range.midpoint,
      driftPct: round(driftPct),
      status,
    }
  })
}

const buildScenarioResults = ({
  totalValue,
  positions,
}: {
  totalValue: number
  positions: FinancePositionInput[]
}): ScenarioResult[] => {
  const scenarios = [
    {
      scenarioId: 'risk_off',
      title: 'Risk-off court terme',
      description:
        'Baisse actions et actifs cycliques, obligations et cash plus resistants.',
      shockMultiplier: 1,
    },
    {
      scenarioId: 'inflation_sticky',
      title: 'Inflation persistante',
      description:
        'Cash et obligations longues sous pression, actifs reels plus resilients.',
      shockMultiplier: 0.65,
    },
    {
      scenarioId: 'growth_upside',
      title: 'Croissance au-dessus du consensus',
      description:
        'Amelioration de la croissance nominale et compression du cash drag.',
      shockMultiplier: -0.55,
    },
  ]

  return scenarios.map(scenario => {
    const deltaValue = sum(
      positions.map(position => {
        const baseShockPct = ASSET_CLASS_ASSUMPTIONS[position.assetClass].stressShockPct
        const scenarioShockPct = round(baseShockPct * scenario.shockMultiplier, 3)
        return position.value * (scenarioShockPct / 100)
      })
    )

    return {
      scenarioId: scenario.scenarioId,
      title: scenario.title,
      description: scenario.description,
      endingValue: round(totalValue + deltaValue),
      deltaValue: round(deltaValue),
      deltaPct: totalValue > 0 ? round((deltaValue / totalValue) * 100) : 0,
    }
  })
}

export const calculateAdvisorSnapshot = (input: FinanceEngineInput): AdvisorSnapshot => {
  const positions = input.positions.filter(position => position.value > 0)
  const totalValue = round(sum(positions.map(position => position.value)))
  const liquidCashValue =
    input.liquidCashValue > 0
      ? round(input.liquidCashValue)
      : round(
          sum(
            positions
              .filter(position => position.assetClass === 'cash')
              .map(position => position.value)
          )
        )
  const investedValue = round(Math.max(totalValue - liquidCashValue, 0))

  const assetClassValues = positions.reduce<Record<AssetClass, number>>(
    (acc, position) => {
      acc[position.assetClass] += position.value
      return acc
    },
    {
      cash: 0,
      equity_global: 0,
      equity_us: 0,
      equity_europe: 0,
      equity_emerging: 0,
      fixed_income: 0,
      gold: 0,
      real_estate: 0,
      alternatives: 0,
      unknown: 0,
    }
  )

  const bucketWeights = {
    cash: toWeight(assetClassValues.cash, totalValue),
    growth: toWeight(
      assetClassValues.equity_global +
        assetClassValues.equity_us +
        assetClassValues.equity_europe +
        assetClassValues.equity_emerging +
        assetClassValues.real_estate +
        assetClassValues.alternatives +
        assetClassValues.unknown,
      totalValue
    ),
    defensive: toWeight(assetClassValues.fixed_income + assetClassValues.gold, totalValue),
  }

  const riskProfile = inferRiskProfile({
    ...(input.explicitRiskProfile !== undefined
      ? { explicitRiskProfile: input.explicitRiskProfile }
      : {}),
    growthWeight: bucketWeights.growth,
    cashWeight: bucketWeights.cash,
  })
  const targets = RISK_PROFILE_TARGETS[riskProfile]
  const inflationPct = input.inflationAssumptionPct ?? DEFAULT_INFLATION_ASSUMPTION_PCT

  const weightedAssetClasses = (Object.entries(assetClassValues) as Array<[AssetClass, number]>)
    .filter(([, value]) => value > 0)
    .map(([assetClass, value]) => ({
      assetClass,
      value,
      weight: toWeight(value, totalValue),
    }))

  const averageNonCashReturnPct =
    investedValue > 0
      ? sum(
          weightedAssetClasses
            .filter(item => item.assetClass !== 'cash')
            .map(
              item =>
                (item.value / investedValue) *
                ASSET_CLASS_ASSUMPTIONS[item.assetClass].expectedReturnPct
            )
        )
      : DEFAULT_CASH_RATE_PCT

  const weightedFeeDragPct =
    totalValue > 0
      ? sum(
          positions.map(position => {
            const feesBps =
              position.feesBps ?? ASSET_CLASS_ASSUMPTIONS[position.assetClass].feeBpsDefault
            return toWeight(position.value, totalValue) * (feesBps / 100)
          })
        )
      : 0

  const expectedReturnPct =
    totalValue > 0
      ? sum(
          weightedAssetClasses.map(
            item =>
              item.weight * ASSET_CLASS_ASSUMPTIONS[item.assetClass].expectedReturnPct
          )
        )
      : DEFAULT_CASH_RATE_PCT

  const expectedRealReturnPct = Math.max(
    round(expectedReturnPct - inflationPct - weightedFeeDragPct),
    Math.min(
      ...weightedAssetClasses.map(
        item => ASSET_CLASS_ASSUMPTIONS[item.assetClass].expectedRealReturnPctFloor
      ),
      0
    )
  )

  const volatilityPct = round(
    computeDiversifiedVolatility(weightedAssetClasses, 'volatilityPct')
  )
  const downsideDeviationPct = round(
    computeDiversifiedVolatility(weightedAssetClasses, 'downsideDeviationPct')
  )
  const sharpeRatio =
    volatilityPct > 0
      ? round((expectedReturnPct - DEFAULT_CASH_RATE_PCT - weightedFeeDragPct) / volatilityPct, 3)
      : null
  const sortinoRatio =
    downsideDeviationPct > 0
      ? round(
          (expectedReturnPct - DEFAULT_CASH_RATE_PCT - weightedFeeDragPct) /
            downsideDeviationPct,
          3
        )
      : null

  const positionWeights = positions.map(position => toWeight(position.value, totalValue))
  const concentrationHhi = round(sum(positionWeights.map(weight => weight * weight)), 4)
  const effectivePositionCount =
    concentrationHhi > 0 ? round(1 / concentrationHhi, 2) : 0
  const topPositionSharePct = round(Math.max(...positionWeights, 0) * 100)

  const allocationBuckets = buildAllocationBuckets(positions, totalValue)
  const driftSignals = buildDriftSignals({
    buckets: allocationBuckets,
    riskProfile,
  })

  const assetClassAllocations: AssetClassAllocation[] = weightedAssetClasses.map(item => ({
    assetClass: item.assetClass,
    bucket: classifyBucket(item.assetClass),
    value: round(item.value),
    weightPct: round(item.weight * 100),
    expectedReturnPct: ASSET_CLASS_ASSUMPTIONS[item.assetClass].expectedReturnPct,
    volatilityPct: ASSET_CLASS_ASSUMPTIONS[item.assetClass].volatilityPct,
    riskContributionPct: 0,
  }))

  const roughRiskContributions = assetClassAllocations.map(
    allocation => (allocation.weightPct / 100) * allocation.volatilityPct
  )
  const totalRiskContribution = sum(roughRiskContributions)
  assetClassAllocations.forEach((allocation, index) => {
    const riskContribution = roughRiskContributions[index] ?? 0
    allocation.riskContributionPct =
      totalRiskContribution > 0
        ? round((riskContribution / totalRiskContribution) * 100)
        : 0
  })

  const largestRiskContributionPct = Math.max(
    ...assetClassAllocations.map(allocation => allocation.riskContributionPct),
    0
  )

  const monthlyIncome = Math.max(input.monthlyIncome, 0)
  const monthlyExpenses = Math.max(input.monthlyExpenses, 0)
  const netMonthlyCashflow = round(monthlyIncome - monthlyExpenses)
  const savingsRatePct =
    monthlyIncome > 0 ? round((netMonthlyCashflow / monthlyIncome) * 100) : null
  const emergencyFundMonths =
    monthlyExpenses > 0 ? round(liquidCashValue / monthlyExpenses, 2) : null
  const runwayMonths =
    monthlyExpenses > 0
      ? round((liquidCashValue + Math.max(netMonthlyCashflow, 0)) / monthlyExpenses, 2)
      : null

  const targetCashMidPct = targets.targetAllocations.cash.midpoint
  const cashAllocationPct = round(bucketWeights.cash * 100)
  const cashDragPct = round(
    (Math.max(cashAllocationPct - targetCashMidPct, 0) *
      Math.max(averageNonCashReturnPct - DEFAULT_CASH_RATE_PCT, 0)) /
      100,
    3
  )
  const diversificationScore = round(
    clamp(
      100 -
        concentrationHhi * 100 -
        Math.max(topPositionSharePct - 35, 0) * 0.8 +
        assetClassAllocations.length * 4,
      20,
      95
    ),
    1
  )
  const observedMaxDrawdownPct = computeObservedMaxDrawdown(input.dailyWealth)
  const scenarios = buildScenarioResults({
    totalValue,
    positions,
  })

  const contradictorySignalCount =
    input.signals?.filter(signal => signal.direction === 'mixed').length ?? 0
  const signalsRiskCount =
    input.signals?.filter(signal => signal.direction === 'risk' && signal.severity >= 50).length ??
    0
  const signalsOpportunityCount =
    input.signals?.filter(
      signal => signal.direction === 'opportunity' && signal.severity >= 50
    ).length ?? 0
  const topExpenseSharePct =
    monthlyExpenses > 0 && input.topExpenses[0]
      ? round((input.topExpenses[0].total / monthlyExpenses) * 100)
      : 0

  const assumptions: AdvisorAssumptionLog[] = [
    {
      key: 'risk_profile',
      value: riskProfile,
      source: input.explicitRiskProfile ? 'observed' : 'inferred',
      justification:
        input.explicitRiskProfile
          ? 'Profil de risque explicite fourni par le contexte applicatif.'
          : 'Profil de risque implicite infere depuis le poids des actifs de croissance et du cash.',
    },
    {
      key: 'inflation_assumption_pct',
      value: inflationPct,
      source:
        input.inflationAssumptionPct !== undefined && input.inflationAssumptionPct !== null
          ? 'observed'
          : 'default',
      justification:
        'Utilise pour calculer un rendement reel approximatif et eviter de presenter des rendements nominaux comme du pouvoir d achat.',
    },
    {
      key: 'volatility_model',
      value: 'weighted-variance-with-static-correlations',
      source: 'default',
      justification:
        'Proxy prudent fonde sur des hypotheses de volatilite/correlation par classe d actifs, en attendant des historiques position-level fiables.',
    },
    {
      key: 'cash_drag_definition',
      value:
        'excess_cash_weight_above_target_midpoint * excess_expected_return_gap',
      source: 'default',
      justification:
        'Mesure conservative du manque a gagner potentiel lie a un surplus de cash non alloue.',
    },
    {
      key: 'max_drawdown_scope',
      value:
        input.dailyWealth.length >= 2
          ? 'observed_on_daily_wealth_snapshots'
          : 'insufficient_history',
      source: input.dailyWealth.length >= 2 ? 'observed' : 'default',
      justification:
        'Le drawdown est observe sur les snapshots de richesse disponibles, et non extrapole depuis des prix absents.',
    },
  ]

  return {
    asOf: input.asOf,
    range: input.range,
    currency: input.currency,
    riskProfile,
    targets,
    metrics: {
      totalValue,
      liquidCashValue,
      investedValue,
      netMonthlyCashflow,
      savingsRatePct,
      emergencyFundMonths,
      runwayMonths,
      cashAllocationPct,
      topPositionSharePct,
      concentrationHhi,
      effectivePositionCount,
      diversificationScore,
      expectedAnnualReturnPct: round(expectedReturnPct, 2),
      expectedRealReturnPct,
      feeDragPct: round(weightedFeeDragPct, 3),
      cashDragPct,
      volatilityPct,
      downsideDeviationPct,
      sharpeRatio,
      sortinoRatio,
      observedMaxDrawdownPct,
      riskBudgetSkewPct: round(Math.max(largestRiskContributionPct - 40, 0), 2),
    },
    allocationBuckets,
    assetClassAllocations,
    driftSignals,
    scenarios,
    assumptions,
    diagnostics: {
      signalsRiskCount,
      signalsOpportunityCount,
      contradictorySignalCount,
      topExpenseSharePct,
    },
  }
}
