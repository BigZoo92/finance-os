import type { PowensUseCases } from '../types'

interface CreateRequestSyncUseCaseDependencies {
  enqueueConnectionSync: (connectionId: string) => Promise<void>
  enqueueAllConnectionsSync: () => Promise<void>
}

export const createRequestSyncUseCase = ({
  enqueueConnectionSync,
  enqueueAllConnectionsSync,
}: CreateRequestSyncUseCaseDependencies): PowensUseCases['requestSync'] => {
  return async connectionId => {
    if (connectionId) {
      await enqueueConnectionSync(connectionId)
      return
    }

    await enqueueAllConnectionsSync()
  }
}
