import type { DashboardRange, DashboardSummaryResponse } from '../types'

export type DashboardAnalyticsWidgetState = 'loading' | 'ready' | 'empty' | 'degraded' | 'error'

export interface DashboardAnalyticsResponse {
  schemaVersion: '2026-04-06'
  range: DashboardRange
  source: 'demoAdapter' | 'adminAdapter'
  generatedAt: string
  summaryCards: {
    netWorth: { value: number; state: DashboardAnalyticsWidgetState }
    incomes: { value: number; state: DashboardAnalyticsWidgetState }
    expenses: { value: number; state: DashboardAnalyticsWidgetState }
  }
  timeseries: {
    points: Array<{ date: string; balance: number }>
    state: DashboardAnalyticsWidgetState
  }
  categorySplit: {
    items: Array<{ label: string; total: number; ratio: number }>
    state: DashboardAnalyticsWidgetState
  }
  portfolioAllocation: {
    items: Array<{ type: 'cash' | 'investment' | 'manual'; total: number; ratio: number }>
    state: DashboardAnalyticsWidgetState
  }
  allocationEvolution: {
    points: Array<{
      date: string
      total: number
      cash: number
      investment: number
      manual: number
    }>
    state: DashboardAnalyticsWidgetState
  }
  recurringSpend: {
    fixedCharges: {
      items: Array<{ label: string; monthlyAmount: number; occurrences: number }>
      totalMonthly: number
      state: DashboardAnalyticsWidgetState
    }
    subscriptions: {
      items: Array<{ label: string; monthlyAmount: number; occurrences: number }>
      totalMonthly: number
      state: DashboardAnalyticsWidgetState
    }
  }
  spendConcentration: {
    topMerchantShare: number
    top3Share: number
    hhi: number
    dominantMerchantLabel: string | null
    state: DashboardAnalyticsWidgetState
  }
  availability: {
    summaryCards: boolean
    timeseries: boolean
    categorySplit: boolean
    portfolioAllocation: boolean
    allocationEvolution: boolean
    recurringSpend: boolean
    spendConcentration: boolean
  }
}

const toState = (enabled: boolean, hasData: boolean): DashboardAnalyticsWidgetState => {
  if (!enabled) {
    return 'degraded'
  }

  return hasData ? 'ready' : 'empty'
}

const getDisabledWidgets = () => {
  const raw = process.env.DASHBOARD_ANALYTICS_DISABLED_WIDGETS
  if (!raw) {
    return new Set<string>()
  }

  return new Set(
    raw
      .split(',')
      .map(item => item.trim())
      .filter(Boolean)
  )
}

const normalizeLabel = (value: string): string =>
  value
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(
      /\b(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\b/g,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim()

const asUtcDate = (value: string): Date | null => {
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

const estimateMonthGap = (dates: string[]): number | null => {
  if (dates.length < 2) {
    return null
  }

  const sorted = [...dates].sort((left, right) => left.localeCompare(right))
  const diffs: number[] = []

  for (let index = 1; index < sorted.length; index += 1) {
    const previous = asUtcDate(sorted[index - 1] ?? '')
    const current = asUtcDate(sorted[index] ?? '')

    if (!previous || !current) {
      continue
    }

    const diff = (current.getTime() - previous.getTime()) / 86_400_000
    if (Number.isFinite(diff) && diff > 0) {
      diffs.push(diff)
    }
  }

  if (!diffs.length) {
    return null
  }

  return diffs.reduce((total, value) => total + value, 0) / diffs.length
}

const hasStableAmount = (amounts: number[]): boolean => {
  if (amounts.length < 2) {
    return false
  }

  const average = amounts.reduce((total, value) => total + value, 0) / amounts.length
  if (average === 0) {
    return false
  }

  return amounts.every(value => Math.abs(value - average) / average <= 0.2)
}

const SUBSCRIPTION_KEYWORDS = [
  'abonnement',
  'adhesion',
  'apple',
  'canal',
  'deezer',
  'disney',
  'dropbox',
  'icloud',
  'netflix',
  'prime',
  'spotify',
  'subscription',
  'youtube',
]

const isLikelySubscription = (label: string, merchant: string): boolean => {
  const combined = `${label} ${merchant}`.toLowerCase()
  return SUBSCRIPTION_KEYWORDS.some(keyword => combined.includes(keyword))
}

export const mapSummaryToAnalyticsContract = ({
  summary,
  source,
  transactions,
}: {
  summary: DashboardSummaryResponse
  source: 'demoAdapter' | 'adminAdapter'
  transactions?: Array<{
    bookingDate: string
    amount: number
    direction: 'income' | 'expense'
    currency: string
    label: string
    merchant: string
  }>
}): DashboardAnalyticsResponse => {
  const disabledWidgets = getDisabledWidgets()
  const availability = {
    summaryCards: !disabledWidgets.has('summaryCards'),
    timeseries: !disabledWidgets.has('timeseries'),
    categorySplit: !disabledWidgets.has('categorySplit'),
    portfolioAllocation: !disabledWidgets.has('portfolioAllocation'),
    allocationEvolution: !disabledWidgets.has('allocationEvolution'),
    recurringSpend: !disabledWidgets.has('recurringSpend'),
    spendConcentration: !disabledWidgets.has('spendConcentration'),
  }

  const categoryTotal = summary.topExpenseGroups.reduce((acc, item) => acc + item.total, 0)
  const categoryItems = summary.topExpenseGroups.map(item => ({
    label: item.label,
    total: item.total,
    ratio: categoryTotal > 0 ? Number((item.total / categoryTotal).toFixed(4)) : 0,
  }))
  const portfolioTotals = summary.assets.reduce(
    (acc, asset) => {
      if (!asset.enabled || !Number.isFinite(asset.valuation) || asset.valuation <= 0) {
        return acc
      }

      acc[asset.type] += asset.valuation
      return acc
    },
    {
      cash: 0,
      investment: 0,
      manual: 0,
    }
  )
  const portfolioGrandTotal = portfolioTotals.cash + portfolioTotals.investment + portfolioTotals.manual
  const portfolioAllocationBase = [
    { type: 'cash', total: portfolioTotals.cash, ratio: 0 },
    { type: 'investment', total: portfolioTotals.investment, ratio: 0 },
    { type: 'manual', total: portfolioTotals.manual, ratio: 0 },
  ] as const
  const portfolioAllocationItems: DashboardAnalyticsResponse['portfolioAllocation']['items'] = portfolioAllocationBase
    .filter(item => item.total > 0)
    .map(item => ({
      ...item,
      ratio: portfolioGrandTotal > 0 ? Number((item.total / portfolioGrandTotal).toFixed(4)) : 0,
    }))
  const allocationRatioByType = portfolioAllocationItems.reduce(
    (acc, item) => {
      acc[item.type] = item.ratio
      return acc
    },
    {
      cash: 0,
      investment: 0,
      manual: 0,
    }
  )
  const allocationEvolutionPoints = summary.dailyWealthSnapshots.map(snapshot => {
    const cash = Number((snapshot.balance * allocationRatioByType.cash).toFixed(2))
    const investment = Number((snapshot.balance * allocationRatioByType.investment).toFixed(2))
    const manual = Number((snapshot.balance - cash - investment).toFixed(2))

    return {
      date: snapshot.date,
      total: snapshot.balance,
      cash,
      investment,
      manual,
    }
  })

  const groupedRecurring = new Map<
    string,
    {
      kind: 'fixed_charge' | 'subscription'
      label: string
      amounts: number[]
      dates: string[]
    }
  >()
  for (const transaction of transactions ?? []) {
    if (transaction.direction !== 'expense' || transaction.amount === 0) {
      continue
    }

    const normalizedLabel = normalizeLabel(transaction.label)
    if (normalizedLabel.length < 3) {
      continue
    }

    const kind: 'fixed_charge' | 'subscription' = isLikelySubscription(
      transaction.label,
      transaction.merchant,
    )
      ? 'subscription'
      : 'fixed_charge'
    const key = `${kind}|${transaction.currency}|${normalizedLabel}`
    const existing = groupedRecurring.get(key)
    const amount = Math.abs(transaction.amount)
    if (existing) {
      existing.amounts.push(amount)
      existing.dates.push(transaction.bookingDate)
      continue
    }
    groupedRecurring.set(key, {
      kind,
      label: normalizedLabel,
      amounts: [amount],
      dates: [transaction.bookingDate],
    })
  }
  const fixedChargesItems: DashboardAnalyticsResponse['recurringSpend']['fixedCharges']['items'] = []
  const subscriptionsItems: DashboardAnalyticsResponse['recurringSpend']['subscriptions']['items'] = []
  for (const [, group] of groupedRecurring) {
    const monthGap = estimateMonthGap(group.dates)
    if (monthGap === null || monthGap < 25 || monthGap > 35 || !hasStableAmount(group.amounts)) {
      continue
    }

    const item = {
      label: group.label,
      monthlyAmount: Number((group.amounts.at(-1) ?? 0).toFixed(2)),
      occurrences: group.amounts.length,
    }

    if (group.kind === 'subscription') {
      subscriptionsItems.push(item)
    } else {
      fixedChargesItems.push(item)
    }
  }
  fixedChargesItems.sort((left, right) => right.monthlyAmount - left.monthlyAmount)
  subscriptionsItems.sort((left, right) => right.monthlyAmount - left.monthlyAmount)
  const fixedChargesTotalMonthly = Number(
    fixedChargesItems.reduce((total, item) => total + item.monthlyAmount, 0).toFixed(2),
  )
  const subscriptionsTotalMonthly = Number(
    subscriptionsItems.reduce((total, item) => total + item.monthlyAmount, 0).toFixed(2),
  )

  const spendConcentrationItems = summary.topExpenseGroups.map(item => ({
    label: item.label,
    total: item.total,
  }))
  const spendConcentrationTotal = spendConcentrationItems.reduce((total, item) => total + item.total, 0)
  const orderedConcentration = [...spendConcentrationItems].sort((left, right) => right.total - left.total)
  const topMerchantShare =
    spendConcentrationTotal > 0 && orderedConcentration[0]
      ? Number((orderedConcentration[0].total / spendConcentrationTotal).toFixed(4))
      : 0
  const top3Share =
    spendConcentrationTotal > 0
      ? Number(
          (
            orderedConcentration.slice(0, 3).reduce((total, item) => total + item.total, 0) /
            spendConcentrationTotal
          ).toFixed(4),
        )
      : 0
  const hhi =
    spendConcentrationTotal > 0
      ? Number(
          spendConcentrationItems
            .map(item => item.total / spendConcentrationTotal)
            .reduce((total, ratio) => total + ratio * ratio, 0)
            .toFixed(4),
        )
      : 0

  return {
    schemaVersion: '2026-04-06',
    range: summary.range,
    source,
    generatedAt: new Date().toISOString(),
    summaryCards: {
      netWorth: {
        value: summary.totals.balance,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.balance)),
      },
      incomes: {
        value: summary.totals.incomes,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.incomes)),
      },
      expenses: {
        value: summary.totals.expenses,
        state: toState(availability.summaryCards, Number.isFinite(summary.totals.expenses)),
      },
    },
    timeseries: {
      points: summary.dailyWealthSnapshots,
      state: toState(availability.timeseries, summary.dailyWealthSnapshots.length > 0),
    },
    categorySplit: {
      items: categoryItems,
      state: toState(availability.categorySplit, categoryItems.length > 0),
    },
    portfolioAllocation: {
      items: portfolioAllocationItems,
      state: toState(availability.portfolioAllocation, portfolioAllocationItems.length > 0),
    },
    allocationEvolution: {
      points: allocationEvolutionPoints,
      state: toState(availability.allocationEvolution, allocationEvolutionPoints.length > 0),
    },
    recurringSpend: {
      fixedCharges: {
        items: fixedChargesItems,
        totalMonthly: fixedChargesTotalMonthly,
        state: toState(availability.recurringSpend, fixedChargesItems.length > 0),
      },
      subscriptions: {
        items: subscriptionsItems,
        totalMonthly: subscriptionsTotalMonthly,
        state: toState(availability.recurringSpend, subscriptionsItems.length > 0),
      },
    },
    spendConcentration: {
      topMerchantShare,
      top3Share,
      hhi,
      dominantMerchantLabel: orderedConcentration[0]?.label ?? null,
      state: toState(availability.spendConcentration, spendConcentrationItems.length > 0),
    },
    availability,
  }
}

export const validateAnalyticsContract = (payload: DashboardAnalyticsResponse) => {
  const hasRange = payload.range === '7d' || payload.range === '30d' || payload.range === '90d'
  const hasSchema = payload.schemaVersion === '2026-04-06'
  const hasSource = payload.source === 'demoAdapter' || payload.source === 'adminAdapter'

  return hasRange && hasSchema && hasSource
}

export const shouldForceAnalyticsDemoAdapter = () => {
  return process.env.DASHBOARD_ANALYTICS_FORCE_DEMO_ADAPTER === '1'
}
