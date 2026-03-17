import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'
import { PowensManualSyncRateLimitError } from '../domain/powens-sync-errors'
import { powensSyncBodySchema } from '../schemas'

export const createSyncRoute = () =>
  new Elysia().post(
    '/sync',
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
          const powens = getPowensRuntime(context)

          if (powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()) {
            void powens.services.adminAudit.recordEvent({
              id: randomUUID(),
              action: 'manual_sync',
              result: 'blocked',
              actorMode: 'admin',
              at: new Date().toISOString(),
              requestId,
              details: 'safe_mode_enabled',
            })
            context.set.status = 503
            return {
              ok: false,
              code: 'INTEGRATIONS_SAFE_MODE_ENABLED' as const,
              message: 'External integrations are temporarily disabled by safe mode',
              requestId,
            }
          }

          const connectionId =
            context.body?.connectionId === undefined ? undefined : String(context.body.connectionId)

          try {
            await powens.useCases.requestSync(connectionId, { requestId })
          } catch (error) {
            if (error instanceof PowensManualSyncRateLimitError) {
              void powens.services.adminAudit.recordEvent({
                id: randomUUID(),
                action: 'manual_sync',
                result: 'blocked',
                actorMode: 'admin',
                at: new Date().toISOString(),
                requestId,
                details: 'rate_limit',
                ...(connectionId ? { connectionId } : {}),
              })
              context.set.status = 429
              context.set.headers['retry-after'] = String(error.retryAfterSeconds)
              return {
                ok: false,
                message: 'Manual sync rate limit reached',
                retryAfterSeconds: error.retryAfterSeconds,
              }
            }

            void powens.services.adminAudit.recordEvent({
              id: randomUUID(),
              action: 'manual_sync',
              result: 'failed',
              actorMode: 'admin',
              at: new Date().toISOString(),
              requestId,
              details: 'unexpected_error',
              ...(connectionId ? { connectionId } : {}),
            })
            throw error
          }

          void powens.services.adminAudit.recordEvent({
            id: randomUUID(),
            action: 'manual_sync',
            result: 'allowed',
            actorMode: 'admin',
            at: new Date().toISOString(),
            requestId,
            ...(connectionId ? { connectionId } : {}),
          })

          return { ok: true }
        },
      })
    },
    {
      body: powensSyncBodySchema,
    }
  )
