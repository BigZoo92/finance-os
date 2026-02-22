import { Elysia } from 'elysia'
import { getPowensRuntime } from '../context'
import { powensSyncBodySchema } from '../schemas'

export const syncRoute = new Elysia({
  name: 'powens.sync.route',
}).post(
  '/sync',
  async context => {
    const powens = getPowensRuntime(context)
    const connectionId =
      context.body?.connectionId === undefined ? undefined : String(context.body.connectionId)

    await powens.useCases.requestSync(connectionId)

    return { ok: true }
  },
  {
    body: powensSyncBodySchema,
  }
)
