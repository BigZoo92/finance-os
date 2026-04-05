import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { env } from '../../../env'
import { getDashboardTransactionsMock } from '../../../mocks/transactions.mock'
import { logApiEvent } from '../../../observability/logger'
import { getDashboardRuntime } from '../context'
import { dashboardTransactionsQuerySchema } from '../schemas'

const DEFAULT_LIMIT = 30

export const createTransactionsRoute = () =>
  new Elysia().get(
    '/transactions',
    async context => {
      const range = context.query.range ?? '30d'
      const limit = context.query.limit ?? DEFAULT_LIMIT
      const requestId = getRequestMeta(context).requestId

      const logResolutionStats = (
        path: 'demo' | 'admin',
        items: Array<{
          id: number
          resolutionSource: 'manual_override' | 'merchant_rules' | 'mcc' | 'counterparty' | 'fallback'
          resolutionTrace: Array<{ matched: boolean }>
          resolutionRuleId: string | null
        }>
      ) => {
        const sourceDistribution = items.reduce<Record<string, number>>((acc, item) => {
          acc[item.resolutionSource] = (acc[item.resolutionSource] ?? 0) + 1
          return acc
        }, {})
        const fallbackCount = items.filter(item => item.resolutionSource === 'fallback').length
        const conflictCount = items.filter(item => item.resolutionTrace.filter(step => step.matched).length > 1).length

        for (const item of items) {
          logApiEvent({
            level: 'info',
            msg: 'transaction categorization resolved',
            requestId,
            transaction_id: item.id,
            rule_applied: item.resolutionRuleId ?? item.resolutionSource,
            precedence_rank: item.resolutionTrace.findIndex(step => step.matched) + 1,
            path,
          })
        }

        logApiEvent({
          level: 'info',
          msg: 'transaction categorization metrics',
          requestId,
          path,
          resolution_source_distribution: sourceDistribution,
          conflict_count: conflictCount,
          fallback_rate: items.length === 0 ? 0 : fallbackCount / items.length,
        })
      }

      return demoOrReal({
        context,
        demo: () => {
          const payload = getDashboardTransactionsMock({
            range,
            limit,
            cursor: context.query.cursor,
          })
          logResolutionStats('demo', payload.items)
          return payload
        },
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          const payload = await dashboard.useCases.getTransactions({
            range,
            limit,
            cursor: context.query.cursor,
          })
          logResolutionStats('admin', payload.items)

          const shouldRequestBackgroundRefresh =
            env.TRANSACTIONS_SNAPSHOT_FIRST_ENABLED &&
            env.POWENS_REFRESH_BACKGROUND_ENABLED &&
            (payload.freshness.syncStatus === 'stale-but-usable' ||
              payload.freshness.syncStatus === 'sync-failed-with-safe-data' ||
              payload.freshness.syncStatus === 'no-data-first-connect')

          if (!shouldRequestBackgroundRefresh) {
            return payload
          }

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
