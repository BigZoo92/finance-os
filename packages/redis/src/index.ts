import { createClient } from 'redis'

export const createRedisClient = (redisUrl: string) => {
  if (!redisUrl) {
    throw new Error('redisUrl is required')
  }

  const client = createClient({ url: redisUrl })

  const connect = async () => {
    if (!client.isOpen) {
      await client.connect()
    }
  }

  const ping = async () => {
    return client.ping()
  }

  const close = async () => {
    if (client.isOpen) {
      await client.quit()
    }
  }

  return {
    client,
    connect,
    ping,
    close,
  }
}
