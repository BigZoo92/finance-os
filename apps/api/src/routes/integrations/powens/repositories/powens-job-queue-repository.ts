import { POWENS_JOB_QUEUE_KEY, serializePowensJob } from '@finance-os/powens'
import type { PowensJobQueueRepository, RedisClient } from '../types'

export const createPowensJobQueueRepository = (
  redisClient: RedisClient
): PowensJobQueueRepository => {
  return {
    async enqueueConnectionSync(connectionId) {
      await redisClient.rPush(
        POWENS_JOB_QUEUE_KEY,
        serializePowensJob({
          type: 'powens.syncConnection',
          connectionId,
        })
      )
    },

    async enqueueAllConnectionsSync() {
      await redisClient.rPush(
        POWENS_JOB_QUEUE_KEY,
        serializePowensJob({
          type: 'powens.syncAll',
        })
      )
    },
  }
}
