import { Elysia } from 'elysia'
import { getAuth } from '../../../auth/context'
import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'

export const summaryRoute = new Elysia({
  name: 'dashboard.summary.route',
}).get(
  '/summary',
  async context => {
    const range = context.query.range ?? '30d'

    if (getAuth(context).mode !== 'admin') {
      return getDashboardSummaryMock(range)
    }

    const dashboard = getDashboardRuntime(context)

    return dashboard.useCases.getSummary(range)
  },
  {
    query: dashboardSummaryQuerySchema,
  }
)
