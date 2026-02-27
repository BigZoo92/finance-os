import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'
import { PowensManualSyncRateLimitError } from '../domain/powens-sync-errors'
import { powensSyncBodySchema } from '../schemas'

export const syncRoute = new Elysia({
  name: 'powens.sync.route',
}).post(
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
        const connectionId =
          context.body?.connectionId === undefined ? undefined : String(context.body.connectionId)

        try {
          await powens.useCases.requestSync(connectionId)
        } catch (error) {
          if (error instanceof PowensManualSyncRateLimitError) {
            context.set.status = 429
            context.set.headers['retry-after'] = String(error.retryAfterSeconds)
            return {
              ok: false,
              message: 'Manual sync rate limit reached',
              retryAfterSeconds: error.retryAfterSeconds,
            }
          }

          throw error
        }

        return { ok: true }
      },
    })
  },
  {
    body: powensSyncBodySchema,
  }
)
