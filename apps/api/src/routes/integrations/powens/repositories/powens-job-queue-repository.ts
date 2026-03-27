import { POWENS_JOB_QUEUE_KEY, serializePowensJob } from '@finance-os/powens'
import type { PowensJobQueueRepository, RedisClient } from '../types'

export const createPowensJobQueueRepository = (
  redisClient: RedisClient
): PowensJobQueueRepository => {
  return {
    async enqueueConnectionSync({ connectionId, requestId, fullResync }) {
      const payload = {
        type: 'powens.syncConnection' as const,
        connectionId,
        ...(requestId !== undefined ? { requestId } : {}),
        ...(fullResync === true ? { fullResync: true } : {}),
      }

      await redisClient.rPush(POWENS_JOB_QUEUE_KEY, serializePowensJob(payload))
    },

    async enqueueAllConnectionsSync(params = {}) {
      const payload = {
        type: 'powens.syncAll' as const,
        ...(params.requestId !== undefined ? { requestId: params.requestId } : {}),
      }

      await redisClient.rPush(POWENS_JOB_QUEUE_KEY, serializePowensJob(payload))
    },

    async getSyncBacklogCount() {
      const backlogSize = await redisClient.lLen(POWENS_JOB_QUEUE_KEY)
      return Number.isFinite(backlogSize) ? backlogSize : 0
    },
  }
}
