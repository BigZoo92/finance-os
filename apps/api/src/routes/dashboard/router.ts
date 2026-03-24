import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { createSummaryRoute } from './routes/summary'
import { createTransactionClassificationRoute } from './routes/transaction-classification'
import { createTransactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { ApiDb } from './types'

export const createDashboardRoutes = ({ db }: { db: ApiDb }) => {
  const runtime = createDashboardRouteRuntime({ db })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(createSummaryRoute())
    .use(createTransactionsRoute())
    .use(createTransactionClassificationRoute())
}
