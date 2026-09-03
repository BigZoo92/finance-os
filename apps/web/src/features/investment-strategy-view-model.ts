import type {
  DashboardInvestmentAccountPolicy,
  DashboardInvestmentActionableStep,
  DashboardInvestmentActionPlan,
  DashboardInvestmentGraphStatus,
  DashboardInvestmentPlanItem,
  DashboardInvestmentPriceFreshness,
  DashboardInvestmentStatusResponse,
  DashboardInvestmentStrategyBucket,
  InvestmentAction,
  InvestmentBucketKey,
  InvestmentRiskLevel,
} from './dashboard-types'

export const INVESTMENT_ACCOUNT_ORDER = ['PEA Trade Republic', 'IBKR', 'Binance'] as const

export const INVESTMENT_BUCKET_LABEL: Record<InvestmentBucketKey, string> = {
  core: 'Socle',
  growth: 'Croissance',
  asymmetric: 'Opportuniste',
}

export const INVESTMENT_RISK_LABEL: Record<InvestmentRiskLevel, string> = {
  low: 'Faible',
  medium: 'Modéré',
  high: 'Élevé',
  very_high: 'Très élevé',
}

export const INVESTMENT_ACTION_LABEL: Record<string, string> = {
  buy: 'Achat proposé',
  hold: 'Conserver',
  watch: 'À examiner',
  avoid: 'Écarter',
  rebalance: 'Rééquilibrage proposé',
  contribute_cash: 'Apport à préparer',
  insufficient_data: 'Données requises',
}

export const ADVISOR_FLASH_SUPPORTED = false

const BUCKET_ORDER: InvestmentBucketKey[] = ['core', 'growth', 'asymmetric']

export type AdvisorPlanAmount = {
  value: number | null
  currency: string | null
  reason: 'available' | 'missing' | 'mixed_currency'
}

export type AdvisorPlanRow = {
  key: string
  amount: number | null
  currency: string | null
  amountKind: 'contribution' | 'trade' | 'unknown'
  asset: string
  destination: string
  bucket: InvestmentBucketKey
  bucketLabel: string
  action: InvestmentAction
  actionLabel: string
  actionTone: 'positive' | 'attention' | 'neutral'
  shortReason: string
  rationale: string | null
  freshnessLabel: string
  targetWeightPct: number | null
  currentWeightPct: number | null
  caveat: string | null
  canExecute: false
}

export type AdvisorAllocationRow = {
  bucket: InvestmentBucketKey
  label: string
  targetPct: number | null
  planPct: number | null
  planAmount: number | null
}

export type AdvisorAllocationComparison = {
  rows: AdvisorAllocationRow[]
  targetTotalPct: number | null
  targetIsValid: boolean
  plan: AdvisorPlanAmount
}

const finiteNumber = (value: number | null | undefined) =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const normalizedCurrency = (value: string | null | undefined) => {
  const normalized = value?.trim().toUpperCase()
  return normalized ? normalized : null
}

const humanizeBlockingReason = (item: DashboardInvestmentPlanItem) => {
  const status = item.recommendabilityStatus
  if (status === 'blocked_missing_price') return 'Prix à confirmer'
  if (status === 'blocked_stale_price') return 'Prix à actualiser'
  if (status === 'blocked_unknown_pea_eligibility') return 'Éligibilité à confirmer'
  if (status === 'blocked_ineligible_account') return 'Compte à vérifier'
  if (status === 'blocked_risk_policy') return 'Cadre de risque'
  if (status === 'blocked_strategy_cap') return 'Plafond atteint'
  if (status === 'rejected_by_user') return 'Choix personnel'

  const reasons = item.blockingReasons ?? []
  const normalized = reasons.join(' ').toLowerCase()
  if (normalized.includes('prix') || normalized.includes('price')) return 'Prix à confirmer'
  if (normalized.includes('eligib')) return 'Éligibilité à confirmer'
  if (normalized.includes('confiance')) return 'Données à consolider'
  if (normalized.includes('cap') || normalized.includes('plafond')) return 'Plafond atteint'
  return reasons.length > 0 ? 'Vérification nécessaire' : null
}

const shortReasonForItem = (item: DashboardInvestmentPlanItem) => {
  const blockingReason = humanizeBlockingReason(item)
  if (blockingReason) return blockingReason
  if (item.action === 'buy' && item.bucket === 'core') return 'Renforce le socle'
  if (item.action === 'buy' && item.bucket === 'growth') return 'Diversifie la croissance'
  if (item.action === 'buy') return 'Exposition plafonnée'
  if (item.action === 'rebalance') return 'Corrige la répartition'
  if (item.action === 'contribute_cash') return 'Prépare le prochain apport'
  if (item.action === 'hold') return 'Allocation déjà cohérente'
  if (item.action === 'avoid') return 'Hors cadre actuel'
  if (item.action === 'insufficient_data') return 'Données à compléter'
  return item.bucket === 'core' ? 'Socle à documenter' : 'À suivre prudemment'
}

const actionToneForItem = (action: InvestmentAction): AdvisorPlanRow['actionTone'] => {
  if (action === 'buy' || action === 'hold') return 'positive'
  if (action === 'avoid' || action === 'insufficient_data') return 'attention'
  return 'neutral'
}

export const currentPlanAmount = (
  plan: DashboardInvestmentActionPlan | null | undefined
): AdvisorPlanAmount => {
  const contribution = plan?.contribution ?? []
  if (contribution.length === 0) {
    return { value: null, currency: null, reason: 'missing' }
  }

  const currencies = new Set<string>()
  let total = 0
  for (const item of contribution) {
    const amount = finiteNumber(item.amount)
    const currency = normalizedCurrency(item.currency)
    if (amount === null || amount < 0 || currency === null) {
      return { value: null, currency: null, reason: 'missing' }
    }
    currencies.add(currency)
    total += amount
  }

  if (currencies.size !== 1) {
    return { value: null, currency: null, reason: 'mixed_currency' }
  }

  return {
    value: Number(total.toFixed(2)),
    currency: [...currencies][0] ?? null,
    reason: 'available',
  }
}

export const primaryInvestmentPlanItems = (
  plan: DashboardInvestmentActionPlan | null | undefined
) => {
  const items = plan?.items ?? []
  const policyItems = items.filter(
    item =>
      item.recommendationTier === 'core_candidate' ||
      item.recommendationTier === 'growth_candidate' ||
      item.recommendationTier === 'asymmetric_candidate'
  )
  if (policyItems.length > 0) {
    const selected = [...policyItems]
    const representedBuckets = new Set(selected.map(item => item.bucket))
    for (const contribution of plan?.contribution ?? []) {
      if (representedBuckets.has(contribution.bucket)) continue
      const candidate = items.find(
        item =>
          item.bucket === contribution.bucket &&
          item.recommendationTier !== 'avoid' &&
          item.accountLabel.trim().toLowerCase() !== 'watchlist utilisateur'
      )
      if (!candidate) continue
      selected.push(candidate)
      representedBuckets.add(contribution.bucket)
    }
    return selected
  }
  return items.filter(item => item.accountLabel.trim().toLowerCase() !== 'watchlist utilisateur')
}

export const mapAdvisorPlanItem = (
  item: DashboardInvestmentPlanItem,
  index = 0
): AdvisorPlanRow => {
  const contribution = toInvestmentNumber(item.recommendedContributionAmount)
  const trade = toInvestmentNumber(item.amountValue)
  const amount = contribution ?? trade
  const amountKind: AdvisorPlanRow['amountKind'] =
    contribution !== null ? 'contribution' : trade !== null ? 'trade' : 'unknown'
  const asset = item.assetName?.trim() || item.symbol?.trim() || 'Actif à préciser'
  const destination = item.accountLabel.trim() || 'Destination à préciser'
  const freshness = investmentFreshnessOf(item)
  const freshnessLabel =
    !freshness || freshness.price === null || freshness.price === undefined
      ? 'Prix indisponible'
      : freshness.isStale
        ? 'Prix à actualiser'
        : freshness.sourceType === 'fallback'
          ? 'Prix indicatif'
          : 'Prix disponible'

  return {
    key: String(item.id ?? `${destination}:${item.bucket}:${item.symbol ?? index}`),
    amount,
    currency: normalizedCurrency(item.amountCurrency),
    amountKind,
    asset,
    destination,
    bucket: item.bucket,
    bucketLabel: INVESTMENT_BUCKET_LABEL[item.bucket],
    action: item.action,
    actionLabel: INVESTMENT_ACTION_LABEL[item.action] ?? 'À examiner',
    actionTone: actionToneForItem(item.action),
    shortReason: shortReasonForItem(item),
    rationale: item.thesis.trim() || null,
    freshnessLabel,
    targetWeightPct: finiteNumber(item.targetWeightPct),
    currentWeightPct: finiteNumber(item.currentWeightPct),
    caveat: humanizeBlockingReason(item),
    canExecute: false,
  }
}

export const advisorPlanRows = (
  plan: DashboardInvestmentActionPlan | null | undefined
): AdvisorPlanRow[] => {
  const availableContributions = [...(plan?.contribution ?? [])]

  return primaryInvestmentPlanItems(plan).map((item, index) => {
    const row = mapAdvisorPlanItem(item, index)
    if (row.amountKind !== 'contribution' || row.amount === null) return row
    const proposedContribution = row.amount

    const contributionIndex = availableContributions.findIndex(contribution => {
      const contributionAmount = finiteNumber(contribution.amount)
      return (
        contribution.bucket === item.bucket &&
        contributionAmount !== null &&
        Math.abs(contributionAmount - proposedContribution) < 0.01 &&
        normalizedCurrency(contribution.currency) === row.currency
      )
    })
    if (contributionIndex >= 0) {
      availableContributions.splice(contributionIndex, 1)
      return row
    }

    const tradeAmount = toInvestmentNumber(item.amountValue)
    return {
      ...row,
      amount: tradeAmount,
      amountKind: tradeAmount === null ? 'unknown' : 'trade',
    }
  })
}

export const advisorAllocationComparison = ({
  buckets,
  plan,
}: {
  buckets: DashboardInvestmentStrategyBucket[]
  plan: DashboardInvestmentActionPlan | null | undefined
}): AdvisorAllocationComparison => {
  const planAmount = currentPlanAmount(plan)
  const targetByBucket = new Map(buckets.map(bucket => [bucket.bucketKey, bucket.targetPct]))
  const planByBucket = new Map<InvestmentBucketKey, number>()

  for (const contribution of plan?.contribution ?? []) {
    const amount = finiteNumber(contribution.amount)
    if (amount === null || amount < 0) continue
    planByBucket.set(contribution.bucket, (planByBucket.get(contribution.bucket) ?? 0) + amount)
  }

  const targetValues = BUCKET_ORDER.map(bucket => finiteNumber(targetByBucket.get(bucket)))
  const completeTarget = targetValues.every(value => value !== null)
  const targetTotalPct = completeTarget
    ? Number(targetValues.reduce<number>((total, value) => total + (value ?? 0), 0).toFixed(2))
    : null
  const targetIsValid = targetTotalPct !== null && Math.abs(targetTotalPct - 100) < 0.01

  return {
    rows: BUCKET_ORDER.map(bucket => {
      const planBucketAmount =
        planAmount.reason === 'available' ? (planByBucket.get(bucket) ?? 0) : null
      const planPct =
        planAmount.value !== null && planAmount.value > 0 && planBucketAmount !== null
          ? (planBucketAmount / planAmount.value) * 100
          : null
      return {
        bucket,
        label: INVESTMENT_BUCKET_LABEL[bucket],
        targetPct: finiteNumber(targetByBucket.get(bucket)),
        planPct,
        planAmount: planBucketAmount,
      }
    }),
    targetTotalPct,
    targetIsValid,
    plan: planAmount,
  }
}

export const advisorFlashState = () => ({
  supported: ADVISOR_FLASH_SUPPORTED,
  items: [] as never[],
  message: 'Aucune opportunité exceptionnelle disponible.',
})

export const formatInvestmentPct = (value: number | null | undefined, digits = 1) =>
  typeof value === 'number' && Number.isFinite(value) ? `${value.toFixed(digits)}%` : '-'

export const formatInvestmentConfidence = (value: number | null | undefined) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '-'
  return `${Math.round(value <= 1 ? value * 100 : value)}%`
}

export const toInvestmentNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  if (typeof value === 'string') {
    const normalized = value.trim()
    if (normalized.length === 0) return null
    const parsed = Number(normalized)
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
  if (code === 'candidate_needs_review')
    return 'Actif candidat: prix et eligibility restent les gates'
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
