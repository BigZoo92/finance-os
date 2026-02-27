import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'

export const connectUrlRoute = new Elysia({
  name: 'powens.connect-url.route',
}).get('/connect-url', context => {
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

      return {
        url: powens.services.connectUrl.getConnectUrl(),
      }
    },
  })
})
