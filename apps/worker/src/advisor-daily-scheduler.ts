import { randomUUID } from 'node:crypto'

export const ADVISOR_DAILY_LOCK_KEY = 'advisor:dashboard:daily:lock'
export const ADVISOR_DAILY_LOCK_TTL_SECONDS = 30 * 60

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

export const buildDashboardAdvisorDailyRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => {
  return {
    url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/advisor/run-daily`,
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

export const triggerDashboardAdvisorDailyRun = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-advisor-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(ADVISOR_DAILY_LOCK_KEY, requestId, {
    NX: true,
    EX: ADVISOR_DAILY_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker advisor daily run skipped because another run is active',
      requestId,
    })
    return {
      status: 'skipped' as const,
      requestId,
    }
  }

  try {
    const request = buildDashboardAdvisorDailyRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`ADVISOR_DAILY_HTTP_${response.status}:${text.slice(0, 200)}`)
    }

    log({
      level: 'info',
      msg: 'worker advisor daily run triggered',
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
      msg: 'worker advisor daily run trigger failed',
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
    await redisClient.del(ADVISOR_DAILY_LOCK_KEY)
  }
}

export const startDashboardAdvisorScheduler = ({
  externalIntegrationsSafeMode,
  advisorEnabled,
  autoRunEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  advisorEnabled: boolean
  autoRunEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker advisor scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!advisorEnabled) {
    log({
      level: 'warn',
      msg: 'worker advisor scheduler disabled',
      reason: 'AI_ADVISOR_ENABLED=false',
    })
    return null
  }

  if (!autoRunEnabled) {
    log({
      level: 'warn',
      msg: 'worker advisor scheduler disabled',
      reason: 'AI_DAILY_AUTO_RUN_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker advisor scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
