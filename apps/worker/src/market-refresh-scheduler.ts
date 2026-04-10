import { randomUUID } from 'node:crypto'

export const MARKET_REFRESH_LOCK_KEY = 'markets:dashboard:refresh:lock'
export const MARKET_REFRESH_LOCK_TTL_SECONDS = 20 * 60

type RedisLockClient = {
  set: (
    key: string,
    value: string,
    options: {
      NX: true
      EX: number
    }
  ) => Promise<string | null>
  del: (key: string) => Promise<number>
}

type SchedulerLogger = (event: {
  level: 'info' | 'warn' | 'error'
  msg: string
  [key: string]: unknown
}) => void

const toSafeErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.length > 2000 ? raw.slice(0, 2000) : raw
}

export const buildDashboardMarketsRefreshRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => {
  return {
    url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/markets/refresh`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        ...(privateAccessToken ? { 'x-internal-token': privateAccessToken } : {}),
      },
      body: JSON.stringify({
        trigger: 'scheduled',
      }),
    } satisfies RequestInit,
  }
}

export const triggerDashboardMarketsRefresh = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-markets-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(MARKET_REFRESH_LOCK_KEY, requestId, {
    NX: true,
    EX: MARKET_REFRESH_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker market refresh skipped because another run is active',
      requestId,
    })
    return {
      status: 'skipped' as const,
      requestId,
    }
  }

  try {
    const request = buildDashboardMarketsRefreshRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`MARKET_REFRESH_HTTP_${response.status}:${text.slice(0, 200)}`)
    }

    log({
      level: 'info',
      msg: 'worker market refresh triggered',
      requestId,
      apiInternalUrl,
    })

    return {
      status: 'triggered' as const,
      requestId,
    }
  } catch (error) {
    log({
      level: 'error',
      msg: 'worker market refresh trigger failed',
      requestId,
      apiInternalUrl,
      errMessage: toSafeErrorMessage(error),
    })

    return {
      status: 'failed' as const,
      requestId,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    await redisClient.del(MARKET_REFRESH_LOCK_KEY)
  }
}

export const startDashboardMarketsScheduler = ({
  externalIntegrationsSafeMode,
  autoRefreshEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  autoRefreshEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker market scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!autoRefreshEnabled) {
    log({
      level: 'warn',
      msg: 'worker market scheduler disabled',
      reason: 'MARKET_DATA_AUTO_REFRESH_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker market scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
