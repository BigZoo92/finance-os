import { Elysia, t } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getRequestMeta } from '../../../../auth/context'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'

export const createAuditTrailRoute = () =>
  new Elysia().get(
    '/audit-trail',
    async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => {
          return {
            events: [],
            requestId,
          }
        },
        real: async () => {
          requireAdmin(context)
          const runtime = getPowensRuntime(context)
          const limit = context.query.limit
          const events = await runtime.services.adminAudit.listRecentEvents(limit)

          return {
            events,
            requestId,
          }
        },
      })
    },
    {
      query: t.Object({
        limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
      }),
    }
  )
