import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from './plugin'
import { summaryRoute } from './routes/summary'
import { transactionsRoute } from './routes/transactions'
import { createDashboardRouteRuntime } from './runtime'
import type { ApiDb } from './types'

export const createDashboardRoutes = ({ db }: { db: ApiDb }) => {
  const runtime = createDashboardRouteRuntime({ db })

  return new Elysia({ prefix: '/dashboard' })
    .use(createDashboardRuntimePlugin(runtime))
    .use(summaryRoute)
    .use(transactionsRoute)
}
