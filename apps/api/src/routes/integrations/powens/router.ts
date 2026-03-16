import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from './plugin'
import { createCallbackRoute } from './routes/callback'
import { createConnectUrlRoute } from './routes/connect-url'
import { createStatusRoute } from './routes/status'
import { createSyncRoute } from './routes/sync'
import { createSyncRunsRoute } from './routes/sync-runs'
import { createPowensRouteRuntime } from './runtime'
import type { PowensRoutesDependencies } from './types'

export const createPowensRoutes = ({ db, redisClient, env }: PowensRoutesDependencies) => {
  const runtime = createPowensRouteRuntime({ db, redisClient, env })

  return new Elysia({ prefix: '/integrations/powens' })
    .use(createPowensRuntimePlugin(runtime))
    .use(createConnectUrlRoute())
    .use(createCallbackRoute())
    .use(createSyncRoute())
    .use(createStatusRoute())
    .use(createSyncRunsRoute())
}
