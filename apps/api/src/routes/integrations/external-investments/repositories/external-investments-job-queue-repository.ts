import {
  EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY,
  serializeExternalInvestmentsJob,
} from '@finance-os/external-investments'
import type {
  ExternalInvestmentsJobQueueRepository,
  ExternalInvestmentsRedisClient,
} from '../types'

export const createExternalInvestmentsJobQueueRepository = (
  redisClient: ExternalInvestmentsRedisClient
): ExternalInvestmentsJobQueueRepository => ({
  async enqueueAllProvidersSync(input = {}) {
    await redisClient.rPush(
      EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY,
      serializeExternalInvestmentsJob({
        type: 'externalInvestments.syncAll',
        ...(input.requestId ? { requestId: input.requestId } : {}),
      })
    )
  },

  async enqueueProviderSync({ provider, requestId }) {
    await redisClient.rPush(
      EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY,
      serializeExternalInvestmentsJob({
        type: 'externalInvestments.syncProvider',
        provider,
        ...(requestId ? { requestId } : {}),
      })
    )
  },

  async enqueueConnectionSync({ provider, connectionId, requestId }) {
    await redisClient.rPush(
      EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY,
      serializeExternalInvestmentsJob({
        type: 'externalInvestments.syncConnection',
        provider,
        connectionId: String(connectionId),
        ...(requestId ? { requestId } : {}),
      })
    )
  },

  async getSyncBacklogCount() {
    const backlogSize = await redisClient.lLen(EXTERNAL_INVESTMENTS_JOB_QUEUE_KEY)
    return Number.isFinite(backlogSize) ? backlogSize : 0
  },
})
