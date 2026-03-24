import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { getDashboardRuntime } from '../context'
import {
  dashboardTransactionClassificationBodySchema,
  dashboardTransactionClassificationParamsSchema,
} from '../schemas'

export const createTransactionClassificationRoute = () =>
  new Elysia().patch(
    '/transactions/:transactionId/classification',
    async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN' as const,
            message: 'Admin session required',
            requestId,
          }
        },
        real: async () => {
          requireAdmin(context)
          const dashboard = getDashboardRuntime(context)
          const result = await dashboard.useCases.updateTransactionClassification(
            context.params.transactionId,
            {
              category: context.body.category ?? null,
              subcategory: context.body.subcategory ?? null,
              incomeType: context.body.incomeType ?? null,
              tags: context.body.tags ?? [],
            }
          )

          if (!result) {
            context.set.status = 404
            return {
              ok: false,
              code: 'NOT_FOUND' as const,
              message: 'Transaction not found',
              requestId,
            }
          }

          return result
        },
      })
    },
    {
      params: dashboardTransactionClassificationParamsSchema,
      body: dashboardTransactionClassificationBodySchema,
    }
  )
