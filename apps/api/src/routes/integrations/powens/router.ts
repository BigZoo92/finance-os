import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from './plugin'
import { createAuditTrailRoute } from './routes/audit-trail'
import { createBacklogRoute } from './routes/backlog'
import { createCallbackRoute } from './routes/callback'
import { createConnectUrlRoute } from './routes/connect-url'
import { createConnectionsRoute } from './routes/connections'
import { createDiagnosticsRoute } from './routes/diagnostics'
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
    .use(createBacklogRoute())
    .use(createAuditTrailRoute())
    .use(createCallbackRoute())
    .use(createConnectionsRoute())
    .use(createSyncRoute())
    .use(createDiagnosticsRoute())
    .use(
      createStatusRoute({
        syncStatusPersistenceEnabled: env.SYNC_STATUS_PERSISTENCE_ENABLED,
      })
    )
    .use(createSyncRunsRoute())
}
