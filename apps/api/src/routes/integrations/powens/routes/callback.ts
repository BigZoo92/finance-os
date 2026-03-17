import { randomUUID } from 'node:crypto'
import { Elysia } from 'elysia'
import { toSafeErrorMessage } from '@finance-os/prelude/errors'
import { getAuth, getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { logApiEvent } from '../../../../observability/logger'
import { getPowensRuntime } from '../context'
import { powensCallbackBodySchema } from '../schemas'

const sanitizeConnectionId = (value: string | number) => {
  const raw = String(value).trim()
  return raw.replace(/^"+|"+$/g, '').trim()
}

export const createCallbackRoute = () =>
  new Elysia().post(
    '/callback',
    async context => {
      const requestId = getRequestMeta(context).requestId
      const auth = getAuth(context)
      const powens = getPowensRuntime(context)
      const hasValidState = powens.services.connectUrl.isCallbackStateValid(context.body.state)
      const sanitizedConnectionId = sanitizeConnectionId(context.body.connection_id)
      const mode = auth.mode === 'admin' ? 'admin' : hasValidState ? 'state' : 'demo'

      if (powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()) {
        void powens.services.adminAudit.recordEvent({
          id: randomUUID(),
          action: 'callback',
          result: 'blocked',
          actorMode: auth.mode === 'admin' ? 'admin' : 'state',
          at: new Date().toISOString(),
          requestId,
          connectionId: sanitizedConnectionId || 'unknown',
          details: 'safe_mode_enabled',
        })
        context.set.status = 503
        return {
          ok: false,
          code: 'INTEGRATIONS_SAFE_MODE_ENABLED' as const,
          requestId,
          message: 'External integrations are temporarily disabled by safe mode',
        }
      }

      if (!sanitizedConnectionId) {
        context.set.status = 400
        return {
          ok: false,
          code: 'INVALID_INPUT' as const,
          requestId,
          message: 'connection_id is required',
        }
      }

      return demoOrReal({
        context,
        isDemoMode: () => auth.mode !== 'admin' && !hasValidState,
        demo: () => {
          void powens.services.adminAudit.recordEvent({
            id: randomUUID(),
            action: 'callback',
            result: 'blocked',
            actorMode: 'state',
            at: new Date().toISOString(),
            requestId,
            connectionId: sanitizedConnectionId,
            details: 'missing_admin_or_valid_state',
          })
          context.set.status = 403
          return {
            ok: false,
            code: 'POWENS_CALLBACK_FORBIDDEN' as const,
            requestId,
            message: 'Admin session or valid signed state is required',
          }
        },
        real: async () => {
          try {
            await powens.useCases.handleCallback({
              connectionId: sanitizedConnectionId,
              encodedCode: context.body.code,
              requestId,
            })

            void powens.services.adminAudit.recordEvent({
              id: randomUUID(),
              action: 'callback',
              result: 'allowed',
              actorMode: auth.mode === 'admin' ? 'admin' : 'state',
              at: new Date().toISOString(),
              requestId,
              connectionId: sanitizedConnectionId,
            })

            logApiEvent({
              level: 'info',
              msg: 'powens callback exchange success',
              requestId,
              route: '/integrations/powens/callback',
              hasSession: auth.mode === 'admin',
              hasValidState,
              mode,
              connectionId: sanitizedConnectionId,
            })

            return { ok: true }
          } catch (error) {
            context.set.status = 502
            void powens.services.adminAudit.recordEvent({
              id: randomUUID(),
              action: 'callback',
              result: 'failed',
              actorMode: auth.mode === 'admin' ? 'admin' : 'state',
              at: new Date().toISOString(),
              requestId,
              connectionId: sanitizedConnectionId,
              details: 'exchange_failed',
            })

            logApiEvent({
              level: 'error',
              msg: 'powens callback exchange failure',
              requestId,
              route: '/integrations/powens/callback',
              hasSession: auth.mode === 'admin',
              hasValidState,
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
      })
    },
    {
      body: powensCallbackBodySchema,
    }
  )
