import {
  ASSET_CLASS_ASSUMPTIONS,
  type AssetClass,
  type ExternalSignalSummary,
  type FinanceEngineInput,
} from '@finance-os/finance-engine'
import type { ExternalInvestmentBundle, ExternalInvestmentAssetClass } from '@finance-os/external-investments'
import type { DashboardGoalResponse, DashboardSummaryResponse } from '../../types'
import type { NewsContextBundle } from '../news-types'

const RANGE_DAYS: Record<FinanceEngineInput['range'], number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
}

const normalizeName = (value: string) => value.trim().toLowerCase()

const classifyAssetClass = (params: {
  label: string
  type: 'cash' | 'investment' | 'manual'
}): AssetClass => {
  const normalized = normalizeName(params.label)

  if (params.type === 'cash') {
    return 'cash'
  }

  const matched = (
    Object.entries(ASSET_CLASS_ASSUMPTIONS) as Array<
      [AssetClass, (typeof ASSET_CLASS_ASSUMPTIONS)[AssetClass]]
    >
  ).find(
    ([assetClass, assumption]) =>
      assetClass !== 'cash' && assumption.labels.some((label: string) => normalized.includes(label))
  )

  return matched?.[0] ?? (params.type === 'investment' ? 'equity_global' : 'unknown')
}

const annualizeToMonthly = (value: number, range: FinanceEngineInput['range']) => {
  const days = RANGE_DAYS[range] ?? 30
  return days > 0 ? (value / days) * 30 : value
}

export const mapNewsBundleToSignals = (
  bundle: NewsContextBundle | null | undefined
): ExternalSignalSummary[] => {
  if (!bundle) {
    return []
  }

  return bundle.topSignals.slice(0, 10).map(signal => ({
    id: signal.id,
    title: signal.title,
    direction: signal.direction,
    severity: signal.severity,
    confidence: signal.confidence,
    whyItMatters: signal.whyItMatters,
  }))
}

export const mapSummaryToFinanceEngineInput = ({
  summary,
  goals,
  newsBundle,
  investmentBundle,
}: {
  summary: DashboardSummaryResponse
  goals: DashboardGoalResponse[]
  newsBundle?: NewsContextBundle | null
  investmentBundle?: ExternalInvestmentBundle | null
}): FinanceEngineInput => {
  const mapExternalAssetClass = (
    assetClass: ExternalInvestmentAssetClass | string | null | undefined
  ): AssetClass | null => {
    if (assetClass === 'cash' || assetClass === 'stablecoin') return 'cash'
    if (assetClass === 'equity' || assetClass === 'etf' || assetClass === 'fund') return 'equity_global'
    if (assetClass === 'bond') return 'fixed_income'
    if (assetClass === 'commodity') return 'gold'
    if (assetClass === 'crypto') return 'alternatives'
    return null
  }

  const getExternalAssetClassFromMetadata = (metadata: Record<string, unknown> | null) => {
    const externalInvestment = metadata?.externalInvestment
    if (!externalInvestment || typeof externalInvestment !== 'object') {
      return null
    }
    const assetClass = (externalInvestment as { assetClass?: unknown }).assetClass
    return typeof assetClass === 'string' ? mapExternalAssetClass(assetClass) : null
  }

  const positionsFromAssets = summary.assets
    .filter(asset => asset.enabled && asset.valuation > 0)
    .map(asset => ({
      id: `asset:${asset.assetId}`,
      name: asset.name,
      value: asset.valuation,
      assetClass:
        getExternalAssetClassFromMetadata(asset.metadata) ??
        classifyAssetClass({
          label: `${asset.name} ${asset.source} ${asset.provider ?? ''}`,
          type: asset.type,
        }),
      currency: asset.currency,
      metadata: asset.metadata,
    }))

  const positionIds = new Set(positionsFromAssets.map(position => position.id))
  const positionsFromInvestments = summary.positions
    .filter(
      position =>
        position.enabled &&
        position.assetId === null &&
        (position.currentValue ?? position.lastKnownValue ?? 0) > 0
    )
    .map(position => ({
      id: `position:${position.positionId}`,
      name: position.name,
      value: position.currentValue ?? position.lastKnownValue ?? 0,
      assetClass:
        getExternalAssetClassFromMetadata(position.metadata) ??
        classifyAssetClass({
          label: `${position.name} ${position.assetName ?? ''}`,
          type: 'investment',
        }),
      currency: position.currency,
      metadata: position.metadata,
    }))
    .filter(position => !positionIds.has(position.id))

  const positions = [...positionsFromAssets, ...positionsFromInvestments]
  const investmentContextAssumptions =
    investmentBundle === null || investmentBundle === undefined
      ? []
      : [
          {
            key: 'external_investment_context_schema',
            value: investmentBundle.schemaVersion,
            source: 'observed' as const,
            justification:
              'Advisor received a compact persisted external investment context bundle, not raw provider payloads.',
          },
          {
            key: 'external_investment_total_known_value',
            value: investmentBundle.totalKnownValue,
            source: 'observed' as const,
            justification:
              'Known external investment value is limited to provider-reported or cached valuations.',
          },
          {
            key: 'external_investment_unknown_value_positions',
            value: investmentBundle.unknownValuePositionCount,
            source: 'observed' as const,
            justification:
              'Positions without reliable valuation are preserved as unknown instead of being inferred.',
          },
          {
            key: 'external_investment_data_quality',
            value: {
              confidence: investmentBundle.confidence,
              missingMarketDataWarnings: investmentBundle.missingMarketDataWarnings,
              unknownCostBasisWarnings: investmentBundle.unknownCostBasisWarnings,
              staleDataWarnings: investmentBundle.staleDataWarnings,
            },
            source: 'observed' as const,
            justification:
              'External investment recommendations must disclose stale, missing valuation, and unknown cost basis limitations.',
          },
        ]

  return {
    asOf: new Date().toISOString(),
    range: summary.range,
    currency: 'EUR',
    monthlyIncome: annualizeToMonthly(summary.totals.incomes, summary.range),
    monthlyExpenses: annualizeToMonthly(summary.totals.expenses, summary.range),
    liquidCashValue: summary.assets
      .filter(asset => asset.enabled && asset.type === 'cash')
      .reduce((sum, asset) => sum + asset.valuation, 0),
    positions,
    goals: goals.map(goal => ({
      id: `goal:${goal.id}`,
      name: goal.name,
      goalType: goal.goalType,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      ...(goal.targetDate ? { targetDate: goal.targetDate } : {}),
    })),
    dailyWealth: summary.dailyWealthSnapshots,
    topExpenses: summary.topExpenseGroups.map(item => ({
      label: item.label,
      category: item.category,
      merchant: item.merchant,
      total: annualizeToMonthly(item.total, summary.range),
      count: item.count,
    })),
    signals: mapNewsBundleToSignals(newsBundle),
    contextAssumptions: investmentContextAssumptions,
  }
}
