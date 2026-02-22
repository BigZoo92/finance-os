import type { PowensSyncGuardRepository, RedisClient } from '../types'

const MANUAL_SYNC_COOLDOWN_KEY = 'powens:sync:manual:cooldown'

export const createPowensSyncGuardRepository = (
  redisClient: RedisClient,
  cooldownSeconds: number
): PowensSyncGuardRepository => {
  return {
    async acquireManualSyncSlot() {
      const acquired = await redisClient.set(MANUAL_SYNC_COOLDOWN_KEY, new Date().toISOString(), {
        NX: true,
        EX: cooldownSeconds,
      })

      if (acquired === 'OK') {
        return {
          allowed: true,
          retryAfterSeconds: 0,
        }
      }

      const ttl = await redisClient.ttl(MANUAL_SYNC_COOLDOWN_KEY)

      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : cooldownSeconds,
      }
    },
  }
}
