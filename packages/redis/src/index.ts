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

export type FinanceOsRedisClient = ReturnType<typeof createRedisClient>

type StoredString = {
  value: string
  expiresAtMs: number | null
}

type RedisSetOptions = {
  EX?: number
  PX?: number
  NX?: boolean
}

type RedisEvalOptions = {
  keys?: string[]
  arguments?: string[]
}

const nowMs = () => Date.now()

const toStoredValue = (value: unknown) =>
  typeof value === 'string' ? value : value === undefined ? '' : JSON.stringify(value)

const resolveExpiresAt = (options?: RedisSetOptions) => {
  if (options?.PX !== undefined) {
    return nowMs() + options.PX
  }

  if (options?.EX !== undefined) {
    return nowMs() + options.EX * 1000
  }

  return null
}

const normalizeListIndex = (index: number, length: number) =>
  index < 0 ? Math.max(0, length + index) : index

export const createInMemoryRedisClient = (): FinanceOsRedisClient => {
  const strings = new Map<string, StoredString>()
  const hashes = new Map<string, Record<string, string>>()
  const lists = new Map<string, string[]>()

  const purgeExpired = (key: string) => {
    const entry = strings.get(key)
    if (entry && entry.expiresAtMs !== null && entry.expiresAtMs <= nowMs()) {
      strings.delete(key)
    }
  }

  const getString = (key: string) => {
    purgeExpired(key)
    return strings.get(key)?.value ?? null
  }

  const setString = (key: string, value: unknown, options?: RedisSetOptions) => {
    purgeExpired(key)
    if (options?.NX && strings.has(key)) {
      return null
    }

    strings.set(key, {
      value: toStoredValue(value),
      expiresAtMs: resolveExpiresAt(options),
    })
    return 'OK'
  }

  const client = {
    isOpen: true,
    async connect() {
      this.isOpen = true
    },
    async ping() {
      return 'PONG'
    },
    async quit() {
      this.isOpen = false
      strings.clear()
      hashes.clear()
      lists.clear()
    },
    async incr(key: string) {
      const current = Number.parseInt(getString(key) ?? '0', 10)
      const next = Number.isFinite(current) ? current + 1 : 1
      setString(key, String(next))
      return next
    },
    async expire(key: string, seconds: number) {
      purgeExpired(key)
      const entry = strings.get(key)
      if (!entry) {
        return false
      }

      strings.set(key, {
        ...entry,
        expiresAtMs: nowMs() + seconds * 1000,
      })
      return true
    },
    async ttl(key: string) {
      purgeExpired(key)
      const entry = strings.get(key)
      if (!entry) {
        return -2
      }

      if (entry.expiresAtMs === null) {
        return -1
      }

      return Math.max(0, Math.ceil((entry.expiresAtMs - nowMs()) / 1000))
    },
    async set(key: string, value: unknown, options?: RedisSetOptions) {
      return setString(key, value, options)
    },
    async get(key: string) {
      return getString(key)
    },
    async del(key: string) {
      const removed =
        (strings.delete(key) ? 1 : 0) +
        (hashes.delete(key) ? 1 : 0) +
        (lists.delete(key) ? 1 : 0)
      return removed
    },
    async mGet(keys: string[]) {
      return keys.map(key => getString(key))
    },
    async hGetAll(key: string) {
      return hashes.get(key) ?? {}
    },
    async hSet(key: string, values: Record<string, unknown>) {
      const current = hashes.get(key) ?? {}
      let created = 0

      for (const [field, value] of Object.entries(values)) {
        if (!(field in current)) {
          created += 1
        }
        current[field] = toStoredValue(value)
      }

      hashes.set(key, current)
      return created
    },
    async rPush(key: string, value: unknown) {
      const list = lists.get(key) ?? []
      list.push(toStoredValue(value))
      lists.set(key, list)
      return list.length
    },
    async lPush(key: string, value: unknown) {
      const list = lists.get(key) ?? []
      list.unshift(toStoredValue(value))
      lists.set(key, list)
      return list.length
    },
    async lLen(key: string) {
      return lists.get(key)?.length ?? 0
    },
    async lRange(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? []
      const from = normalizeListIndex(start, list.length)
      const to = normalizeListIndex(stop, list.length)
      return list.slice(from, to + 1)
    },
    async lTrim(key: string, start: number, stop: number) {
      const list = lists.get(key) ?? []
      const from = normalizeListIndex(start, list.length)
      const to = normalizeListIndex(stop, list.length)
      lists.set(key, list.slice(from, to + 1))
      return 'OK'
    },
    async eval(_script: string, options?: RedisEvalOptions) {
      const key = options?.keys?.[0]
      const expectedToken = options?.arguments?.[0]
      if (!key || expectedToken === undefined) {
        return 0
      }

      if (getString(key) === expectedToken) {
        strings.delete(key)
        return 1
      }

      return 0
    },
  }

  return {
    client: client as unknown as FinanceOsRedisClient['client'],
    connect: async () => {
      await client.connect()
    },
    ping: async () => client.ping(),
    close: async () => {
      await client.quit()
    },
  }
}
