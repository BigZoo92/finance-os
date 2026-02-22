import { Elysia } from 'elysia'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'

export const summaryRoute = new Elysia({
  name: 'dashboard.summary.route',
}).get(
  '/summary',
  async context => {
    const dashboard = getDashboardRuntime(context)
    const range = context.query.range ?? '30d'

    return dashboard.useCases.getSummary(range)
  },
  {
    query: dashboardSummaryQuerySchema,
  }
)
