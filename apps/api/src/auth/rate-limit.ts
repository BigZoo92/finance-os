import type { RedisClient } from './types'

export const consumeRateLimitSlot = async ({
  redisClient,
  key,
  limit,
  windowSeconds = 60,
}: {
  redisClient: RedisClient
  key: string
  limit: number
  windowSeconds?: number
}) => {
  const attempts = await redisClient.incr(key)

  if (attempts === 1) {
    await redisClient.expire(key, windowSeconds)
  }

  const ttl = await redisClient.ttl(key)

  return {
    allowed: attempts <= limit,
    retryAfterSeconds: ttl > 0 ? ttl : windowSeconds,
  }
}
