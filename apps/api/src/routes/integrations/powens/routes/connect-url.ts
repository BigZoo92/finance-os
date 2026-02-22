import { Elysia } from 'elysia'
import { getPowensRuntime } from '../context'

export const connectUrlRoute = new Elysia({
  name: 'powens.connect-url.route',
}).get('/connect-url', context => {
  const powens = getPowensRuntime(context)

  return {
    url: powens.services.connectUrl.getConnectUrl(),
  }
})
