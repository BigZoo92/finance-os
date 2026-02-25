import { Elysia } from 'elysia'
import { requireAdmin } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'

export const connectUrlRoute = new Elysia({
  name: 'powens.connect-url.route',
}).get('/connect-url', context => {
  requireAdmin(context)

  const powens = getPowensRuntime(context)

  return {
    url: powens.services.connectUrl.getConnectUrl(),
  }
})
