import { schema } from '@finance-os/db'
import { and, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { getDashboardRuntime } from '../context'
import type { ApiDb } from '../types'
import { readXUsageSnapshot } from '../services/providers/x-twitter-usage-ledger'

type RecurringCostCadence = 'daily' | 'weekly' | 'monthly' | 'yearly' | 'one_time'

export type CostOverviewSubscription = {
  id: string
  provider: string
  label: string
  amount: number
  currency: string
  cadence: RecurringCostCadence
  monthlyAmount: number
  annualAmount: number
  category: string
  source: string
}

const DEMO_X_SUBSCRIPTIONS: CostOverviewSubscription[] = [
  {
    id: 'demo-x-basic-seat-1',
    provider: 'x_twitter',
    label: 'X API Basic seat 1',
    amount: 8,
    currency: 'EUR',
    cadence: 'monthly',
    monthlyAmount: 8,
    annualAmount: 96,
    category: 'provider_subscription',
    source: 'demo_fixture',
  },
  {
    id: 'demo-x-basic-seat-2',
    provider: 'x_twitter',
    label: 'X API Basic seat 2',
    amount: 8,
    currency: 'EUR',
    cadence: 'monthly',
    monthlyAmount: 8,
    annualAmount: 96,
    category: 'provider_subscription',
    source: 'demo_fixture',
  },
]

const toNumber = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

export const toMonthlyAmount = (amount: number, cadence: RecurringCostCadence) => {
  switch (cadence) {
    case 'daily':
      return amount * 30.4375
    case 'weekly':
      return (amount * 52) / 12
    case 'yearly':
      return amount / 12
    case 'one_time':
      return 0
    default:
      return amount
  }
}

export const summarizeByCurrency = (
  subscriptions: CostOverviewSubscription[],
  field: 'monthlyAmount' | 'annualAmount'
) => {
  const totals = new Map<string, number>()
  for (const subscription of subscriptions) {
    totals.set(
      subscription.currency,
      (totals.get(subscription.currency) ?? 0) + subscription[field]
    )
  }
  return [...totals.entries()]
    .map(([currency, amount]) => ({ currency, amount: Number(amount.toFixed(6)) }))
    .sort((left, right) => left.currency.localeCompare(right.currency))
}

export const createCostsOverviewRoute = ({ db, now = () => new Date() }: { db: ApiDb; now?: () => Date }) =>
  new Elysia().get('/costs/overview', async context => {
    const requestId = getRequestMeta(context).requestId
    context.set.headers['cache-control'] = 'no-store'

    return demoOrReal({
      context,
      demo: () => ({
        ok: true as const,
        mode: 'demo' as const,
        source: 'demo_fixture' as const,
        requestId,
        generatedAt: now().toISOString(),
        totals: {
          recurringMonthlyByCurrency: summarizeByCurrency(DEMO_X_SUBSCRIPTIONS, 'monthlyAmount'),
          recurringAnnualByCurrency: summarizeByCurrency(DEMO_X_SUBSCRIPTIONS, 'annualAmount'),
          variableMonthlyUsd: 0,
          variableDailyUsd: 0,
        },
        recurringSubscriptions: DEMO_X_SUBSCRIPTIONS,
        variableUsage: {
          xTwitter: {
            dailyUsd: 0,
            monthlyUsd: 0,
            costBasisToday: 'estimated' as const,
            costBasisThisMonth: 'estimated' as const,
          },
          advisor: {
            status: 'ok' as const,
            dailyUsd: 0,
            monthlyUsd: 0,
            dailyBudgetUsd: 0,
            monthlyBudgetUsd: 0,
            lastError: null,
          },
        },
      }),
      real: async () => {
        requireAdmin(context)
        const today = now().toISOString().slice(0, 10)
        const rows = await db
          .select({
            id: schema.recurringProviderCost.id,
            provider: schema.recurringProviderCost.provider,
            label: schema.recurringProviderCost.label,
            amount: schema.recurringProviderCost.amount,
            currency: schema.recurringProviderCost.currency,
            cadence: schema.recurringProviderCost.cadence,
            category: schema.recurringProviderCost.category,
            source: schema.recurringProviderCost.source,
          })
          .from(schema.recurringProviderCost)
          .where(
            and(
              eq(schema.recurringProviderCost.active, true),
              or(
                isNull(schema.recurringProviderCost.startDate),
                lte(schema.recurringProviderCost.startDate, today)
              ),
              or(
                isNull(schema.recurringProviderCost.endDate),
                gte(schema.recurringProviderCost.endDate, today)
              )
            )
          )
          .orderBy(desc(schema.recurringProviderCost.updatedAt), desc(schema.recurringProviderCost.id))

        const recurringSubscriptions: CostOverviewSubscription[] = rows.map(row => {
          const amount = toNumber(row.amount)
          const cadence = row.cadence
          const monthlyAmount = toMonthlyAmount(amount, cadence)
          return {
            id: String(row.id),
            provider: row.provider,
            label: row.label,
            amount,
            currency: row.currency,
            cadence,
            monthlyAmount: Number(monthlyAmount.toFixed(6)),
            annualAmount: Number((monthlyAmount * 12).toFixed(6)),
            category: row.category,
            source: row.source,
          }
        })

        const xUsage = await readXUsageSnapshot(db, now())
        let advisorStatus: 'ok' | 'degraded' = 'ok'
        let advisorDailyUsd = 0
        let advisorMonthlyUsd = 0
        let advisorDailyBudgetUsd = 0
        let advisorMonthlyBudgetUsd = 0
        let advisorLastError: string | null = null

        try {
          const dashboard = getDashboardRuntime(context)
          const advisorSpend = await dashboard.useCases.getAdvisorSpend?.({
            mode: 'admin',
            requestId,
          })
          advisorDailyUsd = advisorSpend?.summary.dailyUsdSpent ?? 0
          advisorMonthlyUsd = advisorSpend?.summary.monthlyUsdSpent ?? 0
          advisorDailyBudgetUsd = advisorSpend?.summary.dailyBudgetUsd ?? 0
          advisorMonthlyBudgetUsd = advisorSpend?.summary.monthlyBudgetUsd ?? 0
        } catch (error) {
          advisorStatus = 'degraded'
          advisorLastError = error instanceof Error ? error.message.slice(0, 240) : 'UNKNOWN_ERROR'
        }

        const variableDailyUsd = xUsage.chargeableCostToday + advisorDailyUsd
        const variableMonthlyUsd = xUsage.chargeableCostThisMonth + advisorMonthlyUsd

        return {
          ok: true as const,
          mode: 'admin' as const,
          source: 'db' as const,
          requestId,
          generatedAt: now().toISOString(),
          totals: {
            recurringMonthlyByCurrency: summarizeByCurrency(
              recurringSubscriptions,
              'monthlyAmount'
            ),
            recurringAnnualByCurrency: summarizeByCurrency(
              recurringSubscriptions,
              'annualAmount'
            ),
            variableMonthlyUsd: Number(variableMonthlyUsd.toFixed(6)),
            variableDailyUsd: Number(variableDailyUsd.toFixed(6)),
          },
          recurringSubscriptions,
          variableUsage: {
            xTwitter: {
              dailyUsd: xUsage.chargeableCostToday,
              monthlyUsd: xUsage.chargeableCostThisMonth,
              estimatedDailyUsd: xUsage.estimatedCostToday,
              estimatedMonthlyUsd: xUsage.estimatedCostThisMonth,
              actualDailyUsd: xUsage.actualCostToday,
              actualMonthlyUsd: xUsage.actualCostThisMonth,
              costBasisToday: xUsage.costBasisToday,
              costBasisThisMonth: xUsage.costBasisThisMonth,
            },
            advisor: {
              status: advisorStatus,
              dailyUsd: advisorDailyUsd,
              monthlyUsd: advisorMonthlyUsd,
              dailyBudgetUsd: advisorDailyBudgetUsd,
              monthlyBudgetUsd: advisorMonthlyBudgetUsd,
              lastError: advisorLastError,
            },
          },
        }
      },
    })
  })
