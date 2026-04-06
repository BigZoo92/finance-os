import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createSummaryRoute } from './routes/summary'
import { createAnalyticsRoute } from './routes/analytics'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { ApiDb, RedisClient } from './types'

export const createDashboardRoutes = ({
  db,
  redisClient,
  featureEnabled,
  transactionsSnapshotStaleAfterMinutes,
}: {
  db: ApiDb
  redisClient: RedisClient
  featureEnabled: boolean
  transactionsSnapshotStaleAfterMinutes: number
}) => {
  const runtime = createDashboardRouteRuntime({
    db,
    redisClient,
    featureEnabled,
    transactionsSnapshotStaleAfterMinutes,
  })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(createSummaryRoute())
    .use(createAnalyticsRoute())
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
