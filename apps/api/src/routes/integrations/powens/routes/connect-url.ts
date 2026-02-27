import { Elysia } from 'elysia'
import { requireAdminOrInternalToken } from '../../../../auth/guard'
import { getPowensRuntime } from '../context'

export const connectUrlRoute = new Elysia({
  name: 'powens.connect-url.route',
}).get('/connect-url', context => {
  requireAdminOrInternalToken(context)

  const powens = getPowensRuntime(context)

  return {
    url: powens.services.connectUrl.getConnectUrl(),
  }
})
