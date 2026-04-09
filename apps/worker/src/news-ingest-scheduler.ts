import { randomUUID } from 'node:crypto'

export const NEWS_INGEST_LOCK_KEY = 'news:dashboard:ingest:lock'
export const NEWS_INGEST_LOCK_TTL_SECONDS = 15 * 60

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

export const buildDashboardNewsIngestRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => {
  return {
    url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/news/ingest`,
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

export const triggerDashboardNewsIngest = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-news-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(NEWS_INGEST_LOCK_KEY, requestId, {
    NX: true,
    EX: NEWS_INGEST_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker news ingest skipped because another run is active',
      requestId,
    })
    return {
      status: 'skipped' as const,
      requestId,
    }
  }

  try {
    const request = buildDashboardNewsIngestRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`NEWS_INGEST_HTTP_${response.status}:${text.slice(0, 200)}`)
    }

    log({
      level: 'info',
      msg: 'worker news ingest triggered',
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
      msg: 'worker news ingest trigger failed',
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
    await redisClient.del(NEWS_INGEST_LOCK_KEY)
  }
}

export const startDashboardNewsScheduler = ({
  externalIntegrationsSafeMode,
  autoIngestEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  autoIngestEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker news scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!autoIngestEnabled) {
    log({
      level: 'warn',
      msg: 'worker news scheduler disabled',
      reason: 'NEWS_AUTO_INGEST_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker news scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
