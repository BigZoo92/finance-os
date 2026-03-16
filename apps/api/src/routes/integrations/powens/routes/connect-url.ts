import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'

export const createConnectUrlRoute = () =>
  new Elysia().get('/connect-url', context => {
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
      real: () => {
        requireAdmin(context)
        const powens = getPowensRuntime(context)

        if (powens.env.EXTERNAL_INTEGRATIONS_SAFE_MODE) {
          context.set.status = 503
          return {
            ok: false,
            code: 'INTEGRATIONS_SAFE_MODE_ENABLED' as const,
            message: 'External integrations are temporarily disabled by safe mode',
            requestId,
          }
        }

        return {
          url: powens.services.connectUrl.getConnectUrl(),
        }
      },
    })
  })
