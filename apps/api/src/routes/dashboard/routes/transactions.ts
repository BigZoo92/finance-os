import { Elysia } from 'elysia'
import { getAuth } from '../../../auth/context'
import { getDashboardTransactionsMock } from '../../../mocks/transactions.mock'
import { getDashboardRuntime } from '../context'
import { dashboardTransactionsQuerySchema } from '../schemas'

const DEFAULT_LIMIT = 30

export const transactionsRoute = new Elysia({
  name: 'dashboard.transactions.route',
}).get(
  '/transactions',
  async context => {
    const range = context.query.range ?? '30d'
    const limit = context.query.limit ?? DEFAULT_LIMIT

    if (getAuth(context).mode !== 'admin') {
      return getDashboardTransactionsMock({
        range,
        limit,
        cursor: context.query.cursor,
      })
    }

    const dashboard = getDashboardRuntime(context)

    return dashboard.useCases.getTransactions({
      range,
      limit,
      cursor: context.query.cursor,
    })
  },
  {
    query: dashboardTransactionsQuerySchema,
  }
)
