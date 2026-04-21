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

type AdvisorSchedulerWindowConfig = {
  enabled: boolean
  timezone: string
  openHour: number
  openMinute: number
  leadMinutes: number
  lagMinutes: number
}

const toSafeErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw.length > 2000 ? raw.slice(0, 2000) : raw
}

const formatMarketDayKey = (date: Date, timeZone: string) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)

const getMinuteOfDayInTimeZone = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)

  const hour = Number(parts.find(part => part.type === 'hour')?.value ?? '0')
  const minute = Number(parts.find(part => part.type === 'minute')?.value ?? '0')
  return hour * 60 + minute
}

export const shouldTriggerAdvisorDailyRunInMarketOpenWindow = ({
  now,
  window,
  lastTriggeredMarketDay,
}: {
  now: Date
  window: AdvisorSchedulerWindowConfig
  lastTriggeredMarketDay: string | null
}) => {
  if (!window.enabled) {
    return {
      shouldTrigger: true,
      marketDay: formatMarketDayKey(now, window.timezone),
      skipReason: null,
    } as const
  }

  const marketDay = formatMarketDayKey(now, window.timezone)

  if (marketDay === lastTriggeredMarketDay) {
    return {
      shouldTrigger: false,
      marketDay,
      skipReason: 'already_triggered_today',
    } as const
  }

  const openMinuteOfDay = window.openHour * 60 + window.openMinute
  const lowerBound = openMinuteOfDay - window.leadMinutes
  const upperBound = openMinuteOfDay + window.lagMinutes
  const nowMinuteOfDay = getMinuteOfDayInTimeZone(now, window.timezone)

  if (nowMinuteOfDay < lowerBound || nowMinuteOfDay > upperBound) {
    return {
      shouldTrigger: false,
      marketDay,
      skipReason: 'outside_market_open_window',
    } as const
  }

  return {
    shouldTrigger: true,
    marketDay,
    skipReason: null,
  } as const
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
  marketOpenWindowEnabled = true,
  marketOpenTimezone = 'America/New_York',
  marketOpenHour = 9,
  marketOpenMinute = 30,
  marketOpenLeadMinutes = 45,
  marketOpenLagMinutes = 90,
  trigger,
  log,
  nowFn = () => new Date(),
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  advisorEnabled: boolean
  autoRunEnabled: boolean
  intervalMs: number
  marketOpenWindowEnabled?: boolean
  marketOpenTimezone?: string
  marketOpenHour?: number
  marketOpenMinute?: number
  marketOpenLeadMinutes?: number
  marketOpenLagMinutes?: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  nowFn?: () => Date
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

  let lastTriggeredMarketDay: string | null = null
  let pendingMarketDay: string | null = null
  const windowConfig: AdvisorSchedulerWindowConfig = {
    enabled: marketOpenWindowEnabled,
    timezone: marketOpenTimezone,
    openHour: marketOpenHour,
    openMinute: marketOpenMinute,
    leadMinutes: marketOpenLeadMinutes,
    lagMinutes: marketOpenLagMinutes,
  }

  const runSchedulerTick = () => {
    const decision = shouldTriggerAdvisorDailyRunInMarketOpenWindow({
      now: nowFn(),
      window: windowConfig,
      lastTriggeredMarketDay,
    })

    if (!decision.shouldTrigger) {
      return
    }

    if (pendingMarketDay === decision.marketDay) {
      return
    }

    pendingMarketDay = decision.marketDay
    void trigger()
      .then(result => {
        if (
          typeof result === 'object' &&
          result !== null &&
          'status' in result &&
          result.status === 'triggered'
        ) {
          lastTriggeredMarketDay = decision.marketDay
        }
      })
      .finally(() => {
        pendingMarketDay = null
      })
  }

  runSchedulerTick()
  const timer = setIntervalFn(runSchedulerTick, intervalMs)

  log({
    level: 'info',
    msg: 'worker advisor scheduler started',
    schedulerIntervalMs: intervalMs,
    marketOpenWindowEnabled,
    marketOpenTimezone,
    marketOpenHour,
    marketOpenMinute,
    marketOpenLeadMinutes,
    marketOpenLagMinutes,
  })

  return timer
}
