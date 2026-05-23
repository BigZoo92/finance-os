import type {
  DashboardInvestmentAccountPolicy,
  DashboardInvestmentActionPlan,
  DashboardInvestmentPlanItem,
  DashboardInvestmentPriceFreshness,
  InvestmentBucketKey,
  InvestmentRiskLevel,
} from './dashboard-types'

export const INVESTMENT_ACCOUNT_ORDER = ['PEA Trade Republic', 'IBKR', 'Binance'] as const

export const INVESTMENT_BUCKET_LABEL: Record<InvestmentBucketKey, string> = {
  core: 'Core',
  growth: 'Growth',
  asymmetric: 'Asymmetric',
}

export const INVESTMENT_RISK_LABEL: Record<InvestmentRiskLevel, string> = {
  low: 'faible',
  medium: 'modere',
  high: 'eleve',
  very_high: 'tres eleve',
}

export const INVESTMENT_ACTION_LABEL: Record<string, string> = {
  buy: 'Investir',
  hold: 'Conserver',
  watch: 'Surveiller',
  avoid: 'Eviter',
  rebalance: 'Reequilibrer',
  contribute_cash: 'Allouer un apport',
  insufficient_data: 'Donnees insuffisantes',
}

export const formatInvestmentPct = (value: number | null | undefined, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : '-'

export const formatInvestmentConfidence = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.round((value <= 1 ? value * 100 : value))}%`
}

export const toInvestmentNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

export const investmentActionVariant = (action: string): 'positive' | 'warning' | 'outline' => {
  if (action === 'buy') return 'positive'
  if (action === 'avoid' || action === 'insufficient_data') return 'warning'
  if (action === 'rebalance' || action === 'contribute_cash') return 'outline'
  return 'outline'
}

export const investmentFreshnessOf = (
  item: DashboardInvestmentPlanItem
): DashboardInvestmentPriceFreshness | null => {
  const value = item.dataFreshness ?? item.dataFreshnessJson
  if (!value || typeof value !== 'object') return null
  return value as DashboardInvestmentPriceFreshness
}

export const investmentFreshnessBadgeLabel = (
  freshness: DashboardInvestmentPriceFreshness | null
) => {
  if (!freshness) return 'prix manquant'
  if (freshness.isStale) return 'prix stale'
  if (freshness.sourceType === 'fallback') return 'fallback'
  return freshness.sourceType ?? 'source prix'
}

export const investmentFreshnessBadgeTone = (
  freshness: DashboardInvestmentPriceFreshness | null
): 'warning' | 'outline' => {
  if (!freshness || freshness.isStale || freshness.sourceType === 'fallback') return 'warning'
  return 'outline'
}

export const investmentListFor = (
  item: DashboardInvestmentPlanItem,
  kind: 'for' | 'against' | 'invalidation'
) => {
  if (kind === 'for') return item.argumentsFor ?? item.argumentsForJson ?? []
  if (kind === 'against') return item.argumentsAgainst ?? item.argumentsAgainstJson ?? []
  return item.invalidationCriteria ?? item.invalidationCriteriaJson ?? []
}

export const buildInvestmentAccountSections = ({
  plan,
  policies,
}: {
  plan: DashboardInvestmentActionPlan | null | undefined
  policies: DashboardInvestmentAccountPolicy[]
}) =>
  INVESTMENT_ACCOUNT_ORDER.map(label => {
    const item = plan?.items.find(candidate => candidate.accountLabel === label) ?? null
    const policy =
      policies.find(candidate => candidate.label === label) ??
      policies.find(candidate => label.includes(candidate.label)) ??
      null
    return { label, item, policy }
  })
