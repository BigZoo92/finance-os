import { Elysia } from 'elysia'
import { toSafeErrorMessage } from '@finance-os/prelude/errors'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'
import { powensCallbackBodySchema } from '../schemas'

export const callbackRoute = new Elysia({
  name: 'powens.callback.route',
}).post(
  '/callback',
  async context => {
    requireAdmin(context)

    const powens = getPowensRuntime(context)

    try {
      await powens.useCases.handleCallback({
        connectionId: String(context.body.connection_id),
        encodedCode: context.body.code,
      })

      return { ok: true }
    } catch (error) {
      context.set.status = 502
      return {
        ok: false,
        message: toSafeErrorMessage(error, 'Unexpected Powens error'),
      }
    }
  },
  {
    body: powensCallbackBodySchema,
  }
)
