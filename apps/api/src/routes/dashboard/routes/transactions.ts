import { Elysia } from 'elysia'
import { demoOrReal } from '../../../auth/demo-mode'
import { getDashboardTransactionsMock } from '../../../mocks/transactions.mock'
import { getDashboardRuntime } from '../context'
import { dashboardTransactionsQuerySchema } from '../schemas'

const DEFAULT_LIMIT = 30

export const createTransactionsRoute = () =>
  new Elysia().get(
    '/transactions',
    async context => {
      const range = context.query.range ?? '30d'
      const limit = context.query.limit ?? DEFAULT_LIMIT

      return demoOrReal({
        context,
        demo: () =>
          getDashboardTransactionsMock({
            range,
            limit,
            cursor: context.query.cursor,
          }),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return dashboard.useCases.getTransactions({
            range,
            limit,
            cursor: context.query.cursor,
          })
        },
      })
    },
    {
      query: dashboardTransactionsQuerySchema,
    }
  )
