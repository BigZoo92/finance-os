import { randomUUID } from 'node:crypto'

export const DAILY_INTELLIGENCE_LOCK_KEY = 'daily-intelligence:run:lock'
export const DAILY_INTELLIGENCE_LOCK_TTL_SECONDS = 30 * 60

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
  return raw.slice(0, 2000)
}

const formatDayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const getZonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)

  return {
    weekday: parts.find(part => part.type === 'weekday')?.value ?? 'Mon',
    hour: Number(parts.find(part => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find(part => part.type === 'minute')?.value ?? '0'),
  }
}

export const shouldTriggerDailyIntelligenceRun = ({
  now,
  timezone,
  marketOpenHour,
  cron,
  lastTriggeredDay,
}: {
  now: Date
  timezone: string
  marketOpenHour: number
  cron: string
  lastTriggeredDay: string | null
}) => {
  const dayKey = formatDayKey(now, timezone)
  if (dayKey === lastTriggeredDay) {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'already_triggered_today',
    } as const
  }

  const zoned = getZonedParts(now, timezone)
  if (zoned.weekday === 'Sat' || zoned.weekday === 'Sun') {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'weekend',
    } as const
  }

  const [minuteField, hourField] = cron.trim().split(/\s+/)
  const targetMinute = minuteField === undefined || minuteField === '*' ? 0 : Number(minuteField)
  const targetHour =
    hourField === undefined || hourField === '*' ? marketOpenHour : Number(hourField)

  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'invalid_cron',
    } as const
  }

  if (zoned.hour !== targetHour || zoned.minute !== targetMinute) {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'outside_cron_minute',
    } as const
  }

  return {
    shouldTrigger: true,
    dayKey,
    skipReason: null,
  } as const
}

export const buildDailyIntelligenceRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => ({
  url: `${apiInternalUrl.replace(/\/+$/, '')}/ops/refresh/all`,
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
})

export const triggerDailyIntelligenceRun = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-daily-intelligence-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(DAILY_INTELLIGENCE_LOCK_KEY, requestId, {
    NX: true,
    EX: DAILY_INTELLIGENCE_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker daily intelligence skipped because another run is active',
      requestId,
    })
    return {
      status: 'skipped' as const,
      requestId,
    }
  }

  try {
    const request = buildDailyIntelligenceRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`DAILY_INTELLIGENCE_HTTP_${response.status}:${text.slice(0, 200)}`)
    }

    log({
      level: 'info',
      msg: 'worker daily intelligence run triggered',
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
      msg: 'worker daily intelligence trigger failed',
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
    await redisClient.del(DAILY_INTELLIGENCE_LOCK_KEY)
  }
}

export const startDailyIntelligenceScheduler = ({
  externalIntegrationsSafeMode,
  enabled,
  cron,
  timezone,
  marketOpenHour,
  tickIntervalMs = 60_000,
  trigger,
  log,
  nowFn = () => new Date(),
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  enabled: boolean
  cron: string
  timezone: string
  marketOpenHour: number
  tickIntervalMs?: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  nowFn?: () => Date
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker daily intelligence scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!enabled) {
    log({
      level: 'warn',
      msg: 'worker daily intelligence scheduler disabled',
      reason: 'DAILY_INTELLIGENCE_ENABLED=false',
    })
    return null
  }

  let lastTriggeredDay: string | null = null
  let pendingDay: string | null = null

  const runSchedulerTick = () => {
    const decision = shouldTriggerDailyIntelligenceRun({
      now: nowFn(),
      timezone,
      marketOpenHour,
      cron,
      lastTriggeredDay,
    })

    if (!decision.shouldTrigger || pendingDay === decision.dayKey) {
      return
    }

    pendingDay = decision.dayKey
    void trigger()
      .then(result => {
        if (
          typeof result === 'object' &&
          result !== null &&
          'status' in result &&
          result.status === 'triggered'
        ) {
          lastTriggeredDay = decision.dayKey
        }
      })
      .finally(() => {
        pendingDay = null
      })
  }

  runSchedulerTick()
  const timer = setIntervalFn(runSchedulerTick, tickIntervalMs)

  log({
    level: 'info',
    msg: 'worker daily intelligence scheduler started',
    cron,
    timezone,
    marketOpenHour,
    tickIntervalMs,
  })

  return timer
}
