import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from './plugin'
import { callbackRoute } from './routes/callback'
import { connectUrlRoute } from './routes/connect-url'
import { statusRoute } from './routes/status'
import { syncRoute } from './routes/sync'
import { createPowensRouteRuntime } from './runtime'
import type { PowensRoutesDependencies } from './types'

export const createPowensRoutes = ({ db, redisClient, env }: PowensRoutesDependencies) => {
  const runtime = createPowensRouteRuntime({ db, redisClient, env })

  return new Elysia({ prefix: '/integrations/powens' })
    .use(createPowensRuntimePlugin(runtime))
    .use(connectUrlRoute)
    .use(callbackRoute)
    .use(syncRoute)
    .use(statusRoute)
}
