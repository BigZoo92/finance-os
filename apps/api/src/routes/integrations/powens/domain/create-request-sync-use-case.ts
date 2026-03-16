import type { PowensUseCases } from '../types'
import { PowensManualSyncRateLimitError } from './powens-sync-errors'

interface CreateRequestSyncUseCaseDependencies {
  enqueueConnectionSync: (params: { connectionId: string; requestId?: string }) => Promise<void>
  enqueueAllConnectionsSync: (params?: { requestId?: string }) => Promise<void>
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
  return async (connectionId, options) => {
    const slot = await acquireManualSyncSlot()

    if (!slot.allowed) {
      throw new PowensManualSyncRateLimitError(slot.retryAfterSeconds)
    }

    if (connectionId) {
      await enqueueConnectionSync({ connectionId, requestId: options?.requestId })
      return
    }

    await enqueueAllConnectionsSync({ requestId: options?.requestId })
  }
}
