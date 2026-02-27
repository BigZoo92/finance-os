import { Elysia } from 'elysia'
import { demoOrReal } from '../../../auth/demo-mode'
import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'

export const createSummaryRoute = () =>
  new Elysia().get(
    '/summary',
    async context => {
      const range = context.query.range ?? '30d'

      return demoOrReal({
        context,
        demo: () => getDashboardSummaryMock(range),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return dashboard.useCases.getSummary(range)
        },
      })
    },
    {
      query: dashboardSummaryQuerySchema,
    }
  )
