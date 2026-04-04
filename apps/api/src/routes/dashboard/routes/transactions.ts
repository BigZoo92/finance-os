import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { env } from '../../../env'
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
          const payload = await dashboard.useCases.getTransactions({
            range,
            limit,
            cursor: context.query.cursor,
          })

          const shouldRequestBackgroundRefresh =
            env.TRANSACTIONS_SNAPSHOT_FIRST_ENABLED &&
            env.POWENS_REFRESH_BACKGROUND_ENABLED &&
            (payload.freshness.syncStatus === 'stale-but-usable' ||
              payload.freshness.syncStatus === 'sync-failed-with-safe-data' ||
              payload.freshness.syncStatus === 'no-data-first-connect')

          if (!shouldRequestBackgroundRefresh) {
            return payload
          }

          const requestId = getRequestMeta(context).requestId
          const refreshRequested = await dashboard.useCases.requestTransactionsBackgroundRefresh({
            requestId,
          })

          return {
            ...payload,
            freshness: {
              ...payload.freshness,
              refreshRequested,
            },
          }
        },
      })
    },
    {
      query: dashboardTransactionsQuerySchema,
    }
  )
