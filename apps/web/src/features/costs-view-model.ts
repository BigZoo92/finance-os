import { describeCostBasis, type CostBasis } from './costs'
import type {
  DashboardAdvisorSpendAnalyticsResponse,
  DashboardCostOverviewResponse,
} from './dashboard-types'

export type CostPeriod = 'today' | 'month'

export const COST_PERIODS = [
  { label: 'Aujourd\u2019hui', value: 'today' },
  { label: '30 jours', value: 'month' },
] satisfies Array<{ label: string; value: CostPeriod }>

export type CostLine = {
  id: 'fixed' | 'social' | 'advisor'
  label: string
  value: number | null
  currency: string
  provenance: 'fixed' | CostBasis
  provenanceLabel: string
  detail: string
}

export type KnownCostTotal = {
  currency: string
  value: number
}

export type CostsViewModel = {
  period: CostPeriod
  periodLabel: string
  totals: KnownCostTotal[]
  partial: boolean
  lines: CostLine[]
  daily: DashboardAdvisorSpendAnalyticsResponse['daily']
  anomalies: DashboardAdvisorSpendAnalyticsResponse['anomalies'] | null
  aiBreakdown: {
    byFeature: DashboardAdvisorSpendAnalyticsResponse['byFeature']
    byModel: DashboardAdvisorSpendAnalyticsResponse['byModel']
  } | null
}

const sumKnownByCurrency = (lines: CostLine[]): KnownCostTotal[] => {
  const totals = new Map<string, number>()
  for (const line of lines) {
    if (line.value === null) continue
    totals.set(line.currency, (totals.get(line.currency) ?? 0) + line.value)
  }
  return [...totals].map(([currency, value]) => ({ currency, value }))
}

export const createCostsViewModel = ({
  overview,
  spend,
  period,
  overviewUnavailable = false,
  spendUnavailable = false,
}: {
  overview: DashboardCostOverviewResponse | null | undefined
  spend: DashboardAdvisorSpendAnalyticsResponse | null | undefined
  period: CostPeriod
  overviewUnavailable?: boolean
  spendUnavailable?: boolean
}): CostsViewModel => {
  const x = overview?.variableUsage.xTwitter
  const advisor = overview?.variableUsage.advisor
  const xBasis = x ? (period === 'today' ? x.costBasisToday : x.costBasisThisMonth) : 'estimated'
  const describedXBasis = describeCostBasis(xBasis)
  const fixedTotals = overview?.totals.recurringMonthlyByCurrency ?? []
  const fixedLines: CostLine[] =
    period === 'month'
      ? fixedTotals.map((total, index) => ({
          id: 'fixed',
          label: index === 0 ? 'Abonnements' : `Abonnements ${total.currency}`,
          value: total.amount,
          currency: total.currency,
          provenance: 'fixed',
          provenanceLabel: 'Fixe',
          detail: 'Montant récurrent mensuel',
        }))
      : []

  const lines: CostLine[] = [
    ...fixedLines,
    {
      id: 'social',
      label: 'Social et X',
      value: overviewUnavailable || !x ? null : period === 'today' ? x.dailyUsd : x.monthlyUsd,
      currency: 'USD',
      provenance: xBasis,
      provenanceLabel: describedXBasis.label,
      detail: describedXBasis.isEstimate
        ? 'Inclut une estimation d\u2019usage'
        : 'Usage facturé mesuré',
    },
    {
      id: 'advisor',
      label: 'Advisor',
      value:
        overviewUnavailable || !advisor || advisor.status === 'degraded'
          ? null
          : period === 'today'
            ? advisor.dailyUsd
            : advisor.monthlyUsd,
      currency: 'USD',
      provenance: 'actual',
      provenanceLabel: 'Réel',
      detail:
        advisor?.status === 'degraded'
          ? 'Mesure temporairement indisponible'
          : 'Dépense mesurée dans le registre Advisor',
    },
  ]

  const partial =
    overviewUnavailable || spendUnavailable || !overview || lines.some(line => line.value === null)

  return {
    period,
    periodLabel: period === 'today' ? 'aujourd\u2019hui' : 'sur 30 jours',
    totals: sumKnownByCurrency(lines),
    partial,
    lines,
    daily: spend?.daily ?? [],
    anomalies: spendUnavailable || !spend ? null : spend.anomalies,
    aiBreakdown:
      spendUnavailable || !spend ? null : { byFeature: spend.byFeature, byModel: spend.byModel },
  }
}
