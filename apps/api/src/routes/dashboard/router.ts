import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createNewsRoute } from './routes/news'
import { createSummaryRoute } from './routes/summary'
import { createAnalyticsRoute } from './routes/analytics'
import { createAdvisorRoute } from './routes/advisor'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { FailsoftSource } from './domain/failsoft-policy'
import type { ApiDb, RedisClient } from './types'

export const createDashboardRoutes = ({
  db,
  redisClient,
  featureEnabled,
  liveNewsIngestionEnabled,
  transactionsSnapshotStaleAfterMinutes,
  failsoftPolicyEnabled,
  failsoftSourceOrder,
  failsoftNewsEnabled,
}: {
  db: ApiDb
  redisClient: RedisClient
  featureEnabled: boolean
  liveNewsIngestionEnabled: boolean
  transactionsSnapshotStaleAfterMinutes: number
  failsoftPolicyEnabled: boolean
  failsoftSourceOrder: FailsoftSource[]
  failsoftNewsEnabled: boolean
}) => {
  const runtime = createDashboardRouteRuntime({
    db,
    redisClient,
    featureEnabled,
    liveNewsIngestionEnabled,
    transactionsSnapshotStaleAfterMinutes,
    failsoftPolicyEnabled,
    failsoftSourceOrder,
    failsoftNewsEnabled,
  })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(createSummaryRoute())
    .use(createNewsRoute())
    .use(createAnalyticsRoute())
    .use(createAdvisorRoute())
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
