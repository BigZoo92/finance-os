import { Elysia } from 'elysia'
import { createExternalInvestmentsRuntimePlugin } from './plugin'
import { createExternalInvestmentsRouteRuntime } from './runtime'
import { createExternalInvestmentsCredentialRoute } from './routes/credentials'
import { createExternalInvestmentsDiagnosticsRoute } from './routes/diagnostics'
import { createExternalInvestmentsStatusRoute } from './routes/status'
import { createExternalInvestmentsSyncRoute } from './routes/sync'
import { createExternalInvestmentsSyncRunsRoute } from './routes/sync-runs'
import type { ExternalInvestmentsRoutesDependencies } from './types'

export const createExternalInvestmentsRoutes = ({
  db,
  redisClient,
  env,
}: ExternalInvestmentsRoutesDependencies) => {
  const runtime = createExternalInvestmentsRouteRuntime({ db, redisClient, env })

  return new Elysia({ prefix: '/integrations/external-investments' })
    .use(createExternalInvestmentsRuntimePlugin(runtime))
    .use(createExternalInvestmentsStatusRoute())
    .use(createExternalInvestmentsSyncRunsRoute())
    .use(createExternalInvestmentsDiagnosticsRoute())
    .use(createExternalInvestmentsSyncRoute())
    .use(createExternalInvestmentsCredentialRoute())
}
