import { createHandlePowensCallbackUseCase } from './domain/create-handle-callback-use-case'
import { createListStatusesUseCase } from './domain/create-list-statuses-use-case'
import { createListSyncRunsUseCase } from './domain/create-list-sync-runs-use-case'
import { createRequestSyncUseCase } from './domain/create-request-sync-use-case'
import { createPowensConnectionRepository } from './repositories/powens-connection-repository'
import { createPowensJobQueueRepository } from './repositories/powens-job-queue-repository'
import { createPowensSyncGuardRepository } from './repositories/powens-sync-guard-repository'
import { createPowensClientService } from './services/create-powens-client-service'
import { createPowensConnectUrlService } from './services/create-powens-connect-url-service'
import type { PowensRouteRuntime, PowensRoutesDependencies } from './types'

export const createPowensRouteRuntime = ({
  db,
  redisClient,
  env,
}: PowensRoutesDependencies): PowensRouteRuntime => {
  const client = createPowensClientService(env)
  const connectUrl = createPowensConnectUrlService(env)

  const connection = createPowensConnectionRepository(db, redisClient)
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

  return {
    services: {
      client,
      connectUrl,
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
    },
  }
}
