import {
  ASSET_CLASS_ASSUMPTIONS,
  type AssetClass,
  type ExternalSignalSummary,
  type FinanceEngineInput,
} from '@finance-os/finance-engine'
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
}: {
  summary: DashboardSummaryResponse
  goals: DashboardGoalResponse[]
  newsBundle?: NewsContextBundle | null
}): FinanceEngineInput => {
  const positionsFromAssets = summary.assets
    .filter(asset => asset.enabled && asset.valuation > 0)
    .map(asset => ({
      id: `asset:${asset.assetId}`,
      name: asset.name,
      value: asset.valuation,
      assetClass: classifyAssetClass({
        label: `${asset.name} ${asset.source} ${asset.provider ?? ''}`,
        type: asset.type,
      }),
      currency: asset.currency,
    }))

  const positionIds = new Set(positionsFromAssets.map(position => position.id))
  const positionsFromInvestments = summary.positions
    .filter(position => position.enabled && (position.currentValue ?? position.lastKnownValue ?? 0) > 0)
    .map(position => ({
      id: `position:${position.positionId}`,
      name: position.name,
      value: position.currentValue ?? position.lastKnownValue ?? 0,
      assetClass: classifyAssetClass({
        label: `${position.name} ${position.assetName ?? ''}`,
        type: 'investment',
      }),
      currency: position.currency,
    }))
    .filter(position => !positionIds.has(position.id))

  const positions = [...positionsFromAssets, ...positionsFromInvestments]

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
  }
}
