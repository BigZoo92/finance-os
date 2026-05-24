import type {
  DashboardInvestmentAccountPolicy,
  DashboardInvestmentActionableStep,
  DashboardInvestmentActionPlan,
  DashboardInvestmentGraphStatus,
  DashboardInvestmentPlanItem,
  DashboardInvestmentPriceFreshness,
  DashboardInvestmentStatusResponse,
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
  return `${Math.round(value <= 1 ? value * 100 : value)}%`
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

export const normalizeInvestmentWarning = (code: string) => {
  if (code === 'missing_price') return 'Prix non relie au candidat, achat bloque'
  if (code.startsWith('missing_price:')) {
    return `Prix non relie au candidat (${code.slice('missing_price:'.length)}), achat bloque`
  }
  if (code === 'candidate_needs_review') return 'Actif candidat: prix et eligibility restent les gates'
  if (code === 'knowledge_ingest_permission_denied_storage') {
    return 'Memoire graph non inscriptible, verifier volume/permissions'
  }
  if (code.startsWith('knowledge_service_status_')) {
    return 'Memoire graph indisponible, non bloquant'
  }
  return code
}

export const priceabilityLabel = (value: string | null | undefined) => {
  if (value === 'priceable') return 'prix exploitable'
  if (value === 'stale') return 'prix stale'
  if (value === 'missing') return 'prix manquant'
  if (value === 'unsupported') return 'prix non supporte'
  return 'prix inconnu'
}

export const recommendabilityLabel = (value: string | null | undefined) => {
  if (value === 'recommendable') return 'recommendable'
  if (value === 'watch_only') return 'watch only'
  if (value === 'blocked_missing_price') return 'bloque: prix manquant'
  if (value === 'blocked_stale_price') return 'bloque: prix stale'
  if (value === 'blocked_ineligible_account') return 'bloque: compte incompatible'
  if (value === 'blocked_unknown_pea_eligibility') return 'bloque: PEA inconnu'
  if (value === 'blocked_risk_policy') return 'bloque: politique risque'
  if (value === 'blocked_strategy_cap') return 'bloque: cap strategie'
  if (value === 'rejected_by_user') return 'exclu'
  return 'non qualifie'
}

export const creativeIdeasForPlan = (
  plan: DashboardInvestmentActionPlan | null | undefined
): DashboardInvestmentPlanItem[] =>
  (plan?.items ?? []).filter(
    item =>
      item.recommendationTier === 'speculative_watch' ||
      item.recommendationTier === 'asymmetric_candidate' ||
      (item.recommendationTier === 'user_watchlist' && item.riskLevel === 'very_high')
  )

export const userWatchlistItemsForPlan = (
  plan: DashboardInvestmentActionPlan | null | undefined
): DashboardInvestmentPlanItem[] =>
  (plan?.items ?? []).filter(
    item => item.recommendationTier === 'user_watchlist' || item.userInterestLevel !== 'none'
  )

export const avoidItemsForPlan = (
  plan: DashboardInvestmentActionPlan | null | undefined
): DashboardInvestmentPlanItem[] =>
  (plan?.items ?? []).filter(
    item => item.action === 'avoid' || item.recommendabilityStatus === 'rejected_by_user'
  )

export const dataGapItemsForPlan = (
  plan: DashboardInvestmentActionPlan | null | undefined
): DashboardInvestmentPlanItem[] =>
  (plan?.items ?? []).filter(
    item =>
      item.recommendabilityStatus === 'blocked_missing_price' ||
      item.recommendabilityStatus === 'blocked_stale_price' ||
      item.recommendabilityStatus === 'blocked_unknown_pea_eligibility'
  )

export const activeGraphStatusForPlan = ({
  plan,
  status,
}: {
  plan: DashboardInvestmentActionPlan | null | undefined
  status?: DashboardInvestmentStatusResponse | null
}): DashboardInvestmentGraphStatus => {
  if (plan?.graph) return plan.graph
  const succeeded = status?.memory.graphWritesSucceeded ?? 0
  const failed = status?.memory.graphWritesFailed ?? 0
  return {
    lastRun: {
      attempted: succeeded + failed,
      succeeded,
      failed,
      pending: 0,
      skipped: 0,
      warnings: failed > 0 && status?.memory.lastGraphError ? [status.memory.lastGraphError] : [],
      lastError: status?.memory.lastGraphError ?? null,
    },
    historical: {
      attempted: succeeded + failed,
      succeeded,
      failed,
      pending: 0,
      skipped: 0,
      warnings: failed > 0 && status?.memory.lastGraphError ? [status.memory.lastGraphError] : [],
      lastError: status?.memory.lastGraphError ?? null,
    },
    resolvedHistoricalFailures: 0,
  }
}

export const actionableStepsForPlan = (
  plan: DashboardInvestmentActionPlan | null | undefined
): DashboardInvestmentActionableStep[] => {
  if (plan?.actionableSteps && plan.actionableSteps.length > 0) return plan.actionableSteps
  if (!plan) return []
  const steps: DashboardInvestmentActionableStep[] = []
  if (plan.items.every(item => item.action !== 'buy')) {
    steps.push({
      type: 'no_trade_today',
      priority: 'high',
      message: "Ne passe aucun ordre aujourd'hui.",
      reason: 'Aucun achat ne satisfait les garde-fous du plan courant.',
    })
  }
  for (const item of plan.contribution ?? []) {
    steps.push({
      type: 'allocate_contribution',
      priority: item.bucket === 'core' || item.bucket === 'growth' ? 'high' : 'medium',
      bucket: item.bucket,
      amountValue: item.amount,
      amountCurrency: item.currency,
      message: `Reserver/orienter ${item.amount} ${item.currency} vers ${INVESTMENT_BUCKET_LABEL[item.bucket]}.`,
      reason: item.reason,
    })
  }
  return steps
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
