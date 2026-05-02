import type {
  ExternalInvestmentBundle,
  ExternalInvestmentBundlePositionInput,
  ExternalInvestmentCashFlowType,
  ExternalInvestmentProvider,
  ExternalInvestmentProviderCoverage,
  ExternalInvestmentTradeSide,
} from './types'

const round = (value: number, digits = 2) => {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

const addToMap = <TKey extends string>(map: Map<TKey, number>, key: TKey, value: number) => {
  map.set(key, (map.get(key) ?? 0) + value)
}

const toAllocation = <TKey extends string>(map: Map<TKey, number>, total: number) =>
  [...map.entries()]
    .map(([key, value]) => ({
      key,
      value: round(value),
      weightPct: total > 0 ? round((value / total) * 100) : 0,
    }))
    .sort((left, right) => right.value - left.value)

export const buildExternalInvestmentContextBundle = ({
  generatedAt,
  providerCoverage,
  positions,
  recentTrades,
  recentCashFlows,
  staleAfterMinutes,
}: {
  generatedAt: string
  providerCoverage: ExternalInvestmentProviderCoverage[]
  positions: ExternalInvestmentBundlePositionInput[]
  recentTrades: Array<{ provider: ExternalInvestmentProvider; side: ExternalInvestmentTradeSide; feeAmount: number | null }>
  recentCashFlows: Array<{ provider: ExternalInvestmentProvider; type: ExternalInvestmentCashFlowType }>
  staleAfterMinutes: number
}): ExternalInvestmentBundle => {
  const knownPositions = positions.filter(position => position.value !== null && position.value > 0)
  const totalKnownValue = round(knownPositions.reduce((sum, position) => sum + (position.value ?? 0), 0))
  const byAssetClass = new Map<ExternalInvestmentBundlePositionInput['assetClass'], number>()
  const byProvider = new Map<ExternalInvestmentProvider, number>()
  const byAccount = new Map<string, number>()
  const byCurrency = new Map<string, number>()
  const unknownCostBasisWarnings: string[] = []
  const missingMarketDataWarnings: string[] = []
  const staleDataWarnings: string[] = []
  const assumptions = new Set<string>([
    'External investment data is read-only analytics, not an execution signal.',
    'Unknown valuations are excluded from totalKnownValue.',
  ])

  for (const coverage of providerCoverage) {
    if (coverage.stale) {
      staleDataWarnings.push(`${coverage.provider} data is stale or has no successful sync.`)
    }
    for (const reason of coverage.degradedReasons) {
      assumptions.add(`${coverage.provider}: ${reason}`)
    }
  }

  for (const position of positions) {
    for (const assumption of position.assumptions) {
      assumptions.add(assumption)
    }
    if (position.costBasis === null) {
      unknownCostBasisWarnings.push(`${position.provider}:${position.symbol ?? position.name}`)
    }
    if (position.value === null) {
      missingMarketDataWarnings.push(`${position.provider}:${position.symbol ?? position.name}`)
      continue
    }
    addToMap(byAssetClass, position.assetClass, position.value)
    addToMap(byProvider, position.provider, position.value)
    addToMap(byAccount, `${position.provider}:${position.accountExternalId}`, position.value)
    addToMap(byCurrency, position.valueCurrency ?? position.currency ?? 'UNKNOWN', position.value)
  }

  const accountLabels = new Map(
    positions.map(position => [
      `${position.provider}:${position.accountExternalId}`,
      position.accountAlias ?? position.accountExternalId,
    ])
  )
  const allocationByAccount = toAllocation(byAccount, totalKnownValue).map(item => ({
    ...item,
    label: accountLabels.get(item.key) ?? item.key,
  }))
  const cryptoKnownValue = knownPositions
    .filter(position => position.assetClass === 'crypto' || position.assetClass === 'stablecoin')
    .reduce((sum, position) => sum + (position.value ?? 0), 0)
  const stablecoinKnownValue = knownPositions
    .filter(position => position.assetClass === 'stablecoin')
    .reduce((sum, position) => sum + (position.value ?? 0), 0)
  const cashLikeKnownValue = knownPositions
    .filter(position => position.assetClass === 'cash' || position.assetClass === 'stablecoin')
    .reduce((sum, position) => sum + (position.value ?? 0), 0)
  const feeAmounts = recentTrades.map(trade => trade.feeAmount).filter((value): value is number => value !== null)
  const knownUnrealized = positions
    .map(position => position.unrealizedPnl)
    .filter((value): value is number => value !== null)
  const byRecentProvider: Record<string, number> = {}
  for (const trade of recentTrades) {
    byRecentProvider[trade.provider] = (byRecentProvider[trade.provider] ?? 0) + 1
  }
  const byCashFlowType: Record<string, number> = {}
  for (const cashFlow of recentCashFlows) {
    byCashFlowType[cashFlow.type] = (byCashFlowType[cashFlow.type] ?? 0) + 1
  }
  const degradedProviderCount = providerCoverage.filter(
    provider => provider.status === 'degraded' || provider.status === 'failing' || provider.stale
  ).length
  const unknownValuePositionCount = positions.filter(position => position.value === null).length
  const confidence =
    totalKnownValue > 0 && unknownValuePositionCount === 0 && degradedProviderCount === 0
      ? 'high'
      : totalKnownValue > 0 && degradedProviderCount <= 1
        ? 'medium'
        : 'low'

  return {
    schemaVersion: '2026-05-01',
    generatedAt,
    providerCoverage,
    totalKnownValue,
    unknownValuePositionCount,
    allocationByAssetClass: toAllocation(byAssetClass, totalKnownValue),
    allocationByProvider: toAllocation(byProvider, totalKnownValue),
    allocationByAccount,
    allocationByCurrency: toAllocation(byCurrency, totalKnownValue),
    topConcentrations: knownPositions
      .map(position => ({
        positionKey: position.positionKey,
        label: position.symbol ?? position.name,
        provider: position.provider,
        value: round(position.value ?? 0),
        weightPct: totalKnownValue > 0 ? round(((position.value ?? 0) / totalKnownValue) * 100) : 0,
      }))
      .sort((left, right) => right.value - left.value)
      .slice(0, 8),
    cryptoExposure: {
      value: round(cryptoKnownValue),
      weightPct: totalKnownValue > 0 ? round((cryptoKnownValue / totalKnownValue) * 100) : 0,
      unknownValueCount: positions.filter(
        position =>
          (position.assetClass === 'crypto' || position.assetClass === 'stablecoin') &&
          position.value === null
      ).length,
    },
    stablecoinExposure: {
      value: round(stablecoinKnownValue),
      weightPct: totalKnownValue > 0 ? round((stablecoinKnownValue / totalKnownValue) * 100) : 0,
      unknownValueCount: positions.filter(
        position => position.assetClass === 'stablecoin' && position.value === null
      ).length,
    },
    cashDrag: {
      cashLikeValue: round(cashLikeKnownValue),
      weightPct: totalKnownValue > 0 ? round((cashLikeKnownValue / totalKnownValue) * 100) : 0,
      note: 'Cash-like external assets include cash and stablecoins with known valuation only.',
    },
    recentTradesSummary: {
      count: recentTrades.length,
      byProvider: byRecentProvider,
    },
    recentCashFlowsSummary: {
      count: recentCashFlows.length,
      byType: byCashFlowType,
    },
    feesSummary: {
      knownFees: round(feeAmounts.reduce((sum, value) => sum + value, 0), 4),
      currency: 'mixed',
      unknownFeeCount: recentTrades.length - feeAmounts.length,
    },
    pnlSummary: {
      realizedKnown: null,
      unrealizedKnown:
        knownUnrealized.length > 0 ? round(knownUnrealized.reduce((sum, value) => sum + value, 0)) : null,
      unknownPnlCount: positions.filter(position => position.unrealizedPnl === null).length,
    },
    unknownCostBasisWarnings: unknownCostBasisWarnings.slice(0, 20),
    missingMarketDataWarnings: missingMarketDataWarnings.slice(0, 20),
    staleDataWarnings,
    fxAssumptions: [
      `Values are grouped in provider/native currencies unless a provider supplied normalized value; stale threshold is ${staleAfterMinutes} minutes.`,
    ],
    riskFlags: [
      ...(unknownValuePositionCount > 0 ? ['unknown_external_investment_value'] : []),
      ...(degradedProviderCount > 0 ? ['degraded_provider_data'] : []),
      ...(totalKnownValue > 0 && cryptoKnownValue / totalKnownValue >= 0.25
        ? ['crypto_exposure_above_25pct_known_value']
        : []),
    ],
    opportunityFlags: [],
    assumptions: [...assumptions],
    confidence,
    provenance: providerCoverage.map(provider => ({
      provider: provider.provider,
      connectionId: provider.provider,
      positionCount: positions.filter(position => position.provider === provider.provider).length,
    })),
  }
}
