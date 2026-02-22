import { createHandlePowensCallbackUseCase } from './domain/create-handle-callback-use-case'
import { createListStatusesUseCase } from './domain/create-list-statuses-use-case'
import { createRequestSyncUseCase } from './domain/create-request-sync-use-case'
import { createPowensConnectionRepository } from './repositories/powens-connection-repository'
import { createPowensJobQueueRepository } from './repositories/powens-job-queue-repository'
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

  const connection = createPowensConnectionRepository(db)
  const jobs = createPowensJobQueueRepository(redisClient)

  const handleCallback = createHandlePowensCallbackUseCase({
    exchangeCodeForToken: client.exchangeCodeForToken,
    upsertConnectedConnection: connection.upsertConnectedConnection,
    enqueueConnectionSync: jobs.enqueueConnectionSync,
    encryptionKey: env.APP_ENCRYPTION_KEY,
  })

  const requestSync = createRequestSyncUseCase({
    enqueueConnectionSync: jobs.enqueueConnectionSync,
    enqueueAllConnectionsSync: jobs.enqueueAllConnectionsSync,
  })

  const listStatuses = createListStatusesUseCase({
    listConnectionStatuses: connection.listConnectionStatuses,
  })

  return {
    services: {
      client,
      connectUrl,
    },
    repositories: {
      connection,
      jobs,
    },
    useCases: {
      handleCallback,
      requestSync,
      listStatuses,
    },
  }
}
