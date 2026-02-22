import type { PowensUseCases } from '../types'
import { PowensManualSyncRateLimitError } from './powens-sync-errors'

interface CreateRequestSyncUseCaseDependencies {
  enqueueConnectionSync: (connectionId: string) => Promise<void>
  enqueueAllConnectionsSync: () => Promise<void>
  acquireManualSyncSlot: () => Promise<{
    allowed: boolean
    retryAfterSeconds: number
  }>
}

export const createRequestSyncUseCase = ({
  enqueueConnectionSync,
  enqueueAllConnectionsSync,
  acquireManualSyncSlot,
}: CreateRequestSyncUseCaseDependencies): PowensUseCases['requestSync'] => {
  return async connectionId => {
    const slot = await acquireManualSyncSlot()

    if (!slot.allowed) {
      throw new PowensManualSyncRateLimitError(slot.retryAfterSeconds)
    }

    if (connectionId) {
      await enqueueConnectionSync(connectionId)
      return
    }

    await enqueueAllConnectionsSync()
  }
}
