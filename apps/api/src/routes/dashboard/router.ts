import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createDerivedRecomputeRoute } from './routes/derived-recompute'
import { createGoalsRoute } from './routes/goals'
import { createSummaryRoute } from './routes/summary'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { ApiDb } from './types'

export const createDashboardRoutes = ({
  db,
  featureEnabled,
}: {
  db: ApiDb
  featureEnabled: boolean
}) => {
  const runtime = createDashboardRouteRuntime({ db, featureEnabled })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(createSummaryRoute())
    .use(createDerivedRecomputeRoute())
    .use(createGoalsRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
