import { randomUUID } from 'node:crypto'
import { Elysia, t } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { logApiEvent } from '../../../../observability/logger'
import { getPowensRuntime } from '../context'

export const createConnectionsRoute = () =>
  new Elysia().delete(
    '/connections/:connectionId',
    async context => {
      const requestId = getRequestMeta(context).requestId
      const connectionId = context.params.connectionId.trim()

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
          const powens = getPowensRuntime(context)
          const result = await powens.useCases.disconnectConnection(connectionId)

          void powens.services.adminAudit.recordEvent({
            id: randomUUID(),
            action: 'disconnect_connection',
            result: 'allowed',
            actorMode: 'admin',
            at: new Date().toISOString(),
            requestId,
            connectionId,
            ...(result.disconnected ? {} : { details: 'already_disconnected_or_missing' }),
          })

          logApiEvent({
            level: 'info',
            msg: 'powens connection disconnected',
            route: '/integrations/powens/connections/:connectionId',
            method: 'DELETE',
            status: 200,
            requestId,
            connectionId,
            disconnected: result.disconnected,
          })

          return {
            ok: true,
            requestId,
            connectionId,
            disconnected: result.disconnected,
          }
        },
      })
    },
    {
      params: t.Object({
        connectionId: t.String({ minLength: 1 }),
      }),
    }
  )
