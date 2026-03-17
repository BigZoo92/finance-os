import { randomUUID } from 'node:crypto'
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

        if (powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()) {
          void powens.services.adminAudit.recordEvent({
            id: randomUUID(),
            action: 'connect_url',
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

        const payload = {
          url: powens.services.connectUrl.getConnectUrl(),
        }

        void powens.services.adminAudit.recordEvent({
          id: randomUUID(),
          action: 'connect_url',
          result: 'allowed',
          actorMode: 'admin',
          at: new Date().toISOString(),
          requestId,
        })

        return payload
      },
    })
  })
