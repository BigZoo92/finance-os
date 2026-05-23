import { randomUUID } from 'node:crypto'

export const SOCIAL_SIGNAL_LOCK_KEY = 'signals:social:ingest:lock'
export const SOCIAL_SIGNAL_LOCK_TTL_SECONDS = 10 * 60

type RedisLockClient = {
  set: (key: string, value: string, options: { NX: true; EX: number }) => Promise<string | null>
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

const toSafeValidationBody = (raw: string) => {
  try {
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') {
      return null
    }
    const record = parsed as Record<string, unknown>
    return {
      ...(typeof record.type === 'string' ? { type: record.type } : {}),
      ...(typeof record.on === 'string' ? { on: record.on } : {}),
      ...(record.found && typeof record.found === 'object' ? { found: record.found } : {}),
    }
  } catch {
    return null
  }
}

export const buildSocialSignalIngestRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => ({
  url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/news/ingest`,
  init: {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...(privateAccessToken ? { 'x-internal-token': privateAccessToken } : {}),
    },
    body: JSON.stringify({ trigger: 'social_poll' }),
  } satisfies RequestInit,
})

/**
 * Trigger social signal ingestion via the internal API.
 * This calls the news ingest endpoint which already handles all providers
 * including X/Twitter and Bluesky. The social signal scheduler is a
 * separate scheduling cadence for social-specific polling, complementary
 * to the main news scheduler.
 */
export const triggerSocialSignalIngest = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-social-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(SOCIAL_SIGNAL_LOCK_KEY, requestId, {
    NX: true,
    EX: SOCIAL_SIGNAL_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker social signal ingest skipped because another run is active',
      requestId,
    })
    return { status: 'skipped' as const, requestId }
  }

  try {
    // Reuse the news ingest endpoint — it already handles all providers
    const request = buildSocialSignalIngestRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)

    if (!response.ok) {
      const text = await response.text()
      log({
        level: 'error',
        msg: 'worker social signal ingest http error',
        scheduler: 'social',
        endpoint: request.url,
        requestId,
        httpStatus: response.status,
        validationBody: response.status === 422 ? toSafeValidationBody(text) : null,
      })
      throw new Error(`SOCIAL_SIGNAL_HTTP_${response.status}:${text.slice(0, 200)}`)
    }

    log({
      level: 'info',
      msg: 'worker social signal ingest triggered',
      scheduler: 'social',
      requestId,
    })

    return { status: 'triggered' as const, requestId }
  } catch (error) {
    log({
      level: 'error',
      msg: 'worker social signal ingest trigger failed',
      scheduler: 'social',
      requestId,
      errMessage: toSafeErrorMessage(error),
    })

    return {
      status: 'failed' as const,
      requestId,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    await redisClient.del(SOCIAL_SIGNAL_LOCK_KEY)
  }
}

export const startSocialSignalScheduler = ({
  externalIntegrationsSafeMode,
  socialPollingEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  socialPollingEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker social signal scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!socialPollingEnabled) {
    log({
      level: 'info',
      msg: 'worker social signal scheduler disabled',
      reason: 'SIGNALS_SOCIAL_POLLING_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker social signal scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
