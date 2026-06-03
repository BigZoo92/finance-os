/**
 * Admin route: GET /api/dashboard/signals/x-twitter/health
 *
 * Surfaces the X provider's runtime status: token presence, budget remaining,
 * post/user reads consumed today/this month, last error, and the configuration
 * the daily sync would use right now.
 *
 * Never returns the bearer token or any other secret — only `tokenPresent: bool`.
 */

import { schema } from '@finance-os/db'
import { desc, eq } from 'drizzle-orm'
import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { rejectInvalidCredentials, requireAdmin } from '../../../auth/guard'
import type { ApiDb } from '../types'
import { readXUsageSnapshot } from '../services/providers/x-twitter-usage-ledger'

export type XHealthEnv = {
  NEWS_PROVIDER_X_TWITTER_ENABLED: boolean
  NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN?: string | undefined
  X_DAILY_BUDGET_USD: number
  X_MONTHLY_BUDGET_USD: number
  X_DAILY_PREVIOUS_DAY_SYNC_ENABLED: boolean
}

export const createXTwitterHealthRoute = ({
  db,
  env,
  now = () => new Date(),
}: {
  db: ApiDb
  env: XHealthEnv
  now?: () => Date
}) =>
  new Elysia().get('/signals/x-twitter/health', async context => {
    rejectInvalidCredentials(context)
    const requestId = getRequestMeta(context).requestId
    context.set.headers['cache-control'] = 'no-store'

    return demoOrReal({
      context,
      demo: () => ({
        ok: true as const,
        source: 'demo_fixture' as const,
        mode: 'demo' as const,
        enabled: false,
        configured: false,
        tokenPresent: false,
        requestId,
      }),
      real: async () => {
        requireAdmin(context)
        const usage = await readXUsageSnapshot(db, now())
        const remainingDailyBudget = Math.max(
          0,
          env.X_DAILY_BUDGET_USD - usage.chargeableCostToday
        )
        const remainingMonthlyBudget = Math.max(
          0,
          env.X_MONTHLY_BUDGET_USD - usage.chargeableCostThisMonth
        )

        // Estimate the monthly run rate assuming spend continues at today's pace.
        const dayOfMonth = now().getUTCDate() || 1
        const projectedMonthlyAtCurrentRate =
          (usage.chargeableCostThisMonth / dayOfMonth) *
          new Date(
            Date.UTC(now().getUTCFullYear(), now().getUTCMonth() + 1, 0)
          ).getUTCDate()

        // Last daily sync run from signal_ingestion_run for the X provider.
        const [lastRun] = await db
          .select({
            startedAt: schema.signalIngestionRun.startedAt,
            finishedAt: schema.signalIngestionRun.finishedAt,
            status: schema.signalIngestionRun.status,
            fetchedCount: schema.signalIngestionRun.fetchedCount,
            classifiedCount: schema.signalIngestionRun.classifiedCount,
          })
          .from(schema.signalIngestionRun)
          .where(eq(schema.signalIngestionRun.provider, 'x_twitter'))
          .orderBy(desc(schema.signalIngestionRun.startedAt))
          .limit(1)

        const budgetStatus =
          remainingMonthlyBudget <= 0
            ? 'monthly_exhausted'
            : remainingDailyBudget <= 0
              ? 'daily_exhausted'
              : remainingMonthlyBudget < env.X_MONTHLY_BUDGET_USD * 0.2
                ? 'monthly_low'
                : 'healthy'

        return {
          ok: true as const,
          mode: 'admin' as const,
          source: 'db' as const,
          enabled: env.NEWS_PROVIDER_X_TWITTER_ENABLED,
          configured: Boolean(env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN),
          tokenPresent: Boolean(env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN),
          billingStatus: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN ? 'configured' : 'missing',
          budgetStatus,
          monthlyBudgetUsd: env.X_MONTHLY_BUDGET_USD,
          dailyBudgetUsd: env.X_DAILY_BUDGET_USD,
          postReadsToday: usage.postReadsToday,
          userReadsToday: usage.userReadsToday,
          estimatedCostToday: usage.estimatedCostToday,
          actualCostToday: usage.actualCostToday,
          chargeableCostToday: usage.chargeableCostToday,
          costBasisToday: usage.costBasisToday,
          postReadsThisMonth: usage.postReadsThisMonth,
          userReadsThisMonth: usage.userReadsThisMonth,
          estimatedCostThisMonth: usage.estimatedCostThisMonth,
          actualCostThisMonth: usage.actualCostThisMonth,
          chargeableCostThisMonth: usage.chargeableCostThisMonth,
          costBasisThisMonth: usage.costBasisThisMonth,
          estimatedMonthlyCostAtCurrentRate: Number(
            projectedMonthlyAtCurrentRate.toFixed(2)
          ),
          remainingDailyBudget,
          remainingMonthlyBudget,
          lastStatusCode: usage.lastStatusCode,
          lastErrorCode: usage.lastErrorCode,
          lastErrorAt: usage.lastErrorAt,
          lastDailyRunStartedAt:
            lastRun?.startedAt instanceof Date ? lastRun.startedAt.toISOString() : null,
          lastDailyRunStatus: lastRun?.status ?? null,
          lastDailyRunFetchedCount: lastRun?.fetchedCount ?? 0,
          lastDailyRunKeptForAdvisorCount: lastRun?.classifiedCount ?? 0,
          dailySyncSchedulerEnabled: env.X_DAILY_PREVIOUS_DAY_SYNC_ENABLED,
          requestId,
        }
      },
    })
  })
