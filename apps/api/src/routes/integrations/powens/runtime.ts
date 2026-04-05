import { createHandlePowensCallbackUseCase } from './domain/create-handle-callback-use-case'
import { createListStatusesUseCase } from './domain/create-list-statuses-use-case'
import { createListSyncRunsUseCase } from './domain/create-list-sync-runs-use-case'
import { createRequestSyncUseCase } from './domain/create-request-sync-use-case'
import { createGetSyncBacklogCountUseCase } from './domain/create-get-sync-backlog-count-use-case'
import { createPowensConnectionRepository } from './repositories/powens-connection-repository'
import { createPowensJobQueueRepository } from './repositories/powens-job-queue-repository'
import { createPowensSyncGuardRepository } from './repositories/powens-sync-guard-repository'
import { createPowensClientService } from './services/create-powens-client-service'
import { createPowensConnectUrlService } from './services/create-powens-connect-url-service'
import { createPowensAdminAuditService } from './services/create-powens-admin-audit-service'
import { createMockDiagnosticProvider } from './services/create-mock-diagnostic-provider'
import { createPowensDiagnosticProvider } from './services/create-powens-diagnostic-provider'
import { createDiagnosticsMetrics } from './services/create-diagnostics-metrics'
import { createDiagnosticsService } from './domain/diagnostics'
import type { PowensRouteRuntime, PowensRoutesDependencies } from './types'

export const createPowensRouteRuntime = ({
  db,
  redisClient,
  env,
}: PowensRoutesDependencies): PowensRouteRuntime => {
  const client = createPowensClientService(env)
  const connectUrl = createPowensConnectUrlService(env)
  const adminAudit = createPowensAdminAuditService(redisClient)

  const connection = createPowensConnectionRepository(db, redisClient)
  const diagnosticsMetrics = createDiagnosticsMetrics(redisClient)
  const jobs = createPowensJobQueueRepository(redisClient)
  const syncGuard = createPowensSyncGuardRepository(redisClient, env.POWENS_MANUAL_SYNC_COOLDOWN_SECONDS)

  const handleCallback = createHandlePowensCallbackUseCase({
    exchangeCodeForToken: client.exchangeCodeForToken,
    upsertConnectedConnection: connection.upsertConnectedConnection,
    enqueueConnectionSync: jobs.enqueueConnectionSync,
    encryptionKey: env.APP_ENCRYPTION_KEY,
  })

  const requestSync = createRequestSyncUseCase({
    enqueueConnectionSync: jobs.enqueueConnectionSync,
    enqueueAllConnectionsSync: jobs.enqueueAllConnectionsSync,
    acquireManualSyncSlot: syncGuard.acquireManualSyncSlot,
  })

  const listStatuses = createListStatusesUseCase({
    listConnectionStatuses: connection.listConnectionStatuses,
  })

  const listSyncRuns = createListSyncRunsUseCase({
    listConnectionSyncRuns: connection.listSyncRuns,
  })

  const getSyncBacklogCount = createGetSyncBacklogCountUseCase({
    getSyncBacklogCount: jobs.getSyncBacklogCount,
  })

  const diagnostics = createDiagnosticsService({
    diagnosticsEnabled: env.POWENS_DIAGNOSTICS_ENABLED,
    mockProvider: createMockDiagnosticProvider(),
    powensProvider: createPowensDiagnosticProvider({
      listStatuses,
      isSafeModeActive: connectUrl.isExternalIntegrationsSafeModeEnabled,
    }),
    incrementOutcome: diagnosticsMetrics.incrementOutcome,
  })

  return {
    services: {
      client,
      connectUrl,
      adminAudit,
      diagnostics,
    },
    repositories: {
      connection,
      jobs,
      syncGuard,
    },
    useCases: {
      handleCallback,
      requestSync,
      listStatuses,
      listSyncRuns,
      getSyncBacklogCount,
    },
  }
}
