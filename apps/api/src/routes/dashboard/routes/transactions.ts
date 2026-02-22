import { Elysia } from 'elysia'
import { getDashboardRuntime } from '../context'
import { dashboardTransactionsQuerySchema } from '../schemas'

const DEFAULT_LIMIT = 30

export const transactionsRoute = new Elysia({
  name: 'dashboard.transactions.route',
}).get(
  '/transactions',
  async context => {
    const dashboard = getDashboardRuntime(context)
    const range = context.query.range ?? '30d'
    const limit = context.query.limit ?? DEFAULT_LIMIT

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
