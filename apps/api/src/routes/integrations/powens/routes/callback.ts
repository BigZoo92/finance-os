import { Elysia } from 'elysia'
import { toSafeErrorMessage } from '@finance-os/prelude/errors'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../../auth/context'
import { logApiEvent } from '../../../../observability/logger'
import { requireAdminOrInternalToken } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'
import { powensCallbackBodySchema } from '../schemas'

const sanitizeConnectionId = (value: string | number) => {
  const raw = String(value).trim()
  return raw.replace(/^"+|"+$/g, '').trim()
}

export const callbackRoute = new Elysia({
  name: 'powens.callback.route',
}).post(
  '/callback',
  async context => {
    requireAdminOrInternalToken(context)

    const requestId = getRequestMeta(context).requestId
    const auth = getAuth(context)
    const internalAuth = getInternalAuth(context)
    const sanitizedConnectionId = sanitizeConnectionId(context.body.connection_id)
    const mode = auth.mode === 'admin' ? 'admin' : internalAuth.hasValidToken ? 'internal' : 'demo'

    if (!sanitizedConnectionId) {
      context.set.status = 400
      return {
        ok: false,
        code: 'INVALID_INPUT' as const,
        requestId,
        message: 'connection_id is required',
      }
    }

    const powens = getPowensRuntime(context)

    try {
      await powens.useCases.handleCallback({
        connectionId: sanitizedConnectionId,
        encodedCode: context.body.code,
      })

      logApiEvent({
        level: 'info',
        msg: 'powens callback exchange success',
        correlationId: requestId,
        route: '/integrations/powens/callback',
        hasSession: auth.mode === 'admin',
        hasInternalToken: internalAuth.hasValidToken,
        internalTokenSource: internalAuth.tokenSource,
        mode,
        connectionId: sanitizedConnectionId,
      })

      return { ok: true }
    } catch (error) {
      context.set.status = 502
      logApiEvent({
        level: 'error',
        msg: 'powens callback exchange failure',
        correlationId: requestId,
        route: '/integrations/powens/callback',
        hasSession: auth.mode === 'admin',
        hasInternalToken: internalAuth.hasValidToken,
        internalTokenSource: internalAuth.tokenSource,
        mode,
        connectionId: sanitizedConnectionId,
        errName: error instanceof Error ? error.name : 'UnknownError',
        errMessage: toSafeErrorMessage(error, 'Unexpected Powens error'),
      })

      return {
        ok: false,
        code: 'POWENS_CALLBACK_FAILED' as const,
        requestId,
        message: toSafeErrorMessage(error, 'Unexpected Powens error'),
      }
    }
  },
  {
    body: powensCallbackBodySchema,
  }
)
