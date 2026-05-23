import { randomUUID } from 'node:crypto'

export const DAILY_INTELLIGENCE_LOCK_KEY = 'daily-intelligence:run:lock'
export const DAILY_INTELLIGENCE_LOCK_TTL_SECONDS = 30 * 60
export const DAILY_INTELLIGENCE_MAX_DURATION_SECONDS = 60 * 60

export type DailyIntelligenceRunKind = 'night' | 'morning' | 'manual' | 'dry_run'
type ScheduledDailyIntelligenceRunKind = 'night' | 'morning'

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

type CronSchedule = {
  minute: number
  hour: number
  weekdays: Set<number> | null
}

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

  const weekdayLabel = parts.find(part => part.type === 'weekday')?.value ?? 'Mon'
  const weekdayByLabel: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  }

  return {
    weekday: weekdayLabel,
    weekdayNumber: weekdayByLabel[weekdayLabel] ?? 1,
    hour: Number(parts.find(part => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find(part => part.type === 'minute')?.value ?? '0'),
  }
}

const parseCronNumber = (field: string | undefined, fallback: number) => {
  if (field === undefined || field === '*') {
    return fallback
  }
  const parsed = Number(field)
  return Number.isInteger(parsed) ? parsed : null
}

const parseWeekdayField = (field: string | undefined): Set<number> | null => {
  if (field === undefined || field === '*') {
    return null
  }

  const days = new Set<number>()
  for (const part of field.split(',')) {
    const normalized = part.trim()
    if (!normalized) {
      continue
    }
    const range = normalized.match(/^(\d)-(\d)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      if (!Number.isInteger(start) || !Number.isInteger(end) || start > end) {
        return null
      }
      for (let day = start; day <= end; day += 1) {
        days.add(day === 7 ? 0 : day)
      }
      continue
    }
    const day = Number(normalized)
    if (!Number.isInteger(day)) {
      return null
    }
    days.add(day === 7 ? 0 : day)
  }

  return days.size > 0 ? days : null
}

export const parseDailyIntelligenceCron = (
  cron: string,
  fallbackHour: number
): CronSchedule | null => {
  const [minuteField, hourField, _dayOfMonth, _month, weekdayField] = cron.trim().split(/\s+/)
  const minute = parseCronNumber(minuteField, 0)
  const hour = parseCronNumber(hourField, fallbackHour)
  const weekdays = parseWeekdayField(weekdayField)

  if (minute === null || hour === null || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return null
  }

  return { minute, hour, weekdays }
}

const matchesSchedule = ({
  now,
  timezone,
  schedule,
}: {
  now: Date
  timezone: string
  schedule: CronSchedule
}) => {
  const zoned = getZonedParts(now, timezone)
  if (schedule.weekdays && !schedule.weekdays.has(zoned.weekdayNumber)) {
    return false
  }
  return zoned.hour === schedule.hour && zoned.minute === schedule.minute
}

export const getNextDailyIntelligenceRun = ({
  now,
  timezone,
  cron,
  fallbackHour = 9,
}: {
  now: Date
  timezone: string
  cron: string
  fallbackHour?: number
}): string | null => {
  const schedule = parseDailyIntelligenceCron(cron, fallbackHour)
  if (!schedule) {
    return null
  }

  const start = new Date(now.getTime())
  start.setUTCSeconds(0, 0)
  start.setUTCMinutes(start.getUTCMinutes() + 1)

  for (let offsetMinutes = 0; offsetMinutes < 8 * 24 * 60; offsetMinutes += 1) {
    const candidate = new Date(start.getTime() + offsetMinutes * 60_000)
    if (matchesSchedule({ now: candidate, timezone, schedule })) {
      return candidate.toISOString()
    }
  }

  return null
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

  const schedule = parseDailyIntelligenceCron(cron, marketOpenHour)
  if (!schedule) {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'invalid_cron',
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

  if (!matchesSchedule({ now, timezone, schedule })) {
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

export const shouldTriggerDailyIntelligenceScheduledRun = ({
  now,
  timezone,
  cron,
  runKind,
  lastTriggeredKey,
}: {
  now: Date
  timezone: string
  cron: string
  runKind: ScheduledDailyIntelligenceRunKind
  lastTriggeredKey: string | null
}) => {
  const dayKey = formatDayKey(now, timezone)
  const triggerKey = `${runKind}:${dayKey}`
  if (triggerKey === lastTriggeredKey) {
    return {
      shouldTrigger: false,
      dayKey,
      triggerKey,
      skipReason: 'already_triggered_today',
    } as const
  }

  const schedule = parseDailyIntelligenceCron(cron, runKind === 'morning' ? 7 : 23)
  if (!schedule) {
    return {
      shouldTrigger: false,
      dayKey,
      triggerKey,
      skipReason: 'invalid_cron',
    } as const
  }

  if (!matchesSchedule({ now, timezone, schedule })) {
    return {
      shouldTrigger: false,
      dayKey,
      triggerKey,
      skipReason: 'outside_cron_minute',
    } as const
  }

  return {
    shouldTrigger: true,
    dayKey,
    triggerKey,
    skipReason: null,
  } as const
}

export const buildDailyIntelligenceSchedulerStatus = ({
  enabled,
  timezone,
  nightCron,
  morningCron,
  now = new Date(),
}: {
  enabled: boolean
  timezone: string
  nightCron: string
  morningCron: string
  now?: Date
}) => ({
  dailyIntelligenceEnabled: enabled,
  timezone,
  nightCron,
  morningCron,
  nextNightRun: enabled
    ? getNextDailyIntelligenceRun({ now, timezone, cron: nightCron, fallbackHour: 23 })
    : null,
  nextMorningRun: enabled
    ? getNextDailyIntelligenceRun({ now, timezone, cron: morningCron, fallbackHour: 7 })
    : null,
})

export const buildDailyIntelligenceRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
  runKind = 'manual',
  dryRun = false,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
  runKind?: DailyIntelligenceRunKind
  dryRun?: boolean
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
      trigger: runKind === 'manual' ? 'manual' : 'scheduled',
      runKind,
      ...(dryRun ? { dryRun: true } : {}),
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
  runKind = 'manual',
  dryRun = false,
  lockTtlSeconds = DAILY_INTELLIGENCE_LOCK_TTL_SECONDS,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
  runKind?: DailyIntelligenceRunKind
  dryRun?: boolean
  lockTtlSeconds?: number
}) => {
  const lockKey = `${DAILY_INTELLIGENCE_LOCK_KEY}:${runKind}`
  const lock = await redisClient.set(lockKey, requestId, {
    NX: true,
    EX: Math.max(1, Math.floor(lockTtlSeconds)),
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker daily intelligence skipped because another run is active',
      requestId,
      runKind,
      lockKey,
    })
    return {
      status: 'skipped' as const,
      requestId,
      runKind,
    }
  }

  try {
    const request = buildDailyIntelligenceRequest({
      apiInternalUrl,
      requestId,
      runKind,
      dryRun,
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
      runKind,
      dryRun,
    })

    return {
      status: 'triggered' as const,
      requestId,
      runKind,
    }
  } catch (error) {
    log({
      level: 'error',
      msg: 'worker daily intelligence trigger failed',
      requestId,
      apiInternalUrl,
      runKind,
      dryRun,
      errMessage: toSafeErrorMessage(error),
    })

    return {
      status: 'failed' as const,
      requestId,
      runKind,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    await redisClient.del(lockKey)
  }
}

export const startDailyIntelligenceScheduler = ({
  externalIntegrationsSafeMode,
  enabled,
  cron,
  nightCron = cron ?? '15 23 * * *',
  morningCron = cron ?? '30 7 * * *',
  timezone,
  marketOpenHour = 9,
  dryRunDefault = false,
  tickIntervalMs = 60_000,
  trigger,
  log,
  nowFn = () => new Date(),
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  enabled: boolean
  cron?: string
  nightCron?: string
  morningCron?: string
  timezone: string
  marketOpenHour?: number
  dryRunDefault?: boolean
  tickIntervalMs?: number
  trigger: (input: {
    runKind: ScheduledDailyIntelligenceRunKind
    dryRun: boolean
  }) => Promise<unknown>
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
      nightCron,
      morningCron,
      timezone,
    })
    return null
  }

  let lastTriggeredNightKey: string | null = null
  let lastTriggeredMorningKey: string | null = null
  const pendingKeys = new Set<string>()

  const runSchedulerTick = () => {
    const now = nowFn()
    const schedules: Array<{
      runKind: ScheduledDailyIntelligenceRunKind
      cron: string
      lastTriggeredKey: string | null
    }> = [
      { runKind: 'night', cron: nightCron, lastTriggeredKey: lastTriggeredNightKey },
      { runKind: 'morning', cron: morningCron, lastTriggeredKey: lastTriggeredMorningKey },
    ]

    for (const schedule of schedules) {
      const decision = shouldTriggerDailyIntelligenceScheduledRun({
        now,
        timezone,
        cron: schedule.cron,
        runKind: schedule.runKind,
        lastTriggeredKey: schedule.lastTriggeredKey,
      })

      if (!decision.shouldTrigger || pendingKeys.has(decision.triggerKey)) {
        continue
      }

      pendingKeys.add(decision.triggerKey)
      void trigger({ runKind: schedule.runKind, dryRun: dryRunDefault })
        .then(result => {
          if (
            typeof result === 'object' &&
            result !== null &&
            'status' in result &&
            result.status === 'triggered'
          ) {
            if (schedule.runKind === 'night') {
              lastTriggeredNightKey = decision.triggerKey
            } else {
              lastTriggeredMorningKey = decision.triggerKey
            }
          }
        })
        .finally(() => {
          pendingKeys.delete(decision.triggerKey)
        })
    }
  }

  runSchedulerTick()
  const timer = setIntervalFn(runSchedulerTick, tickIntervalMs)
  const status = buildDailyIntelligenceSchedulerStatus({
    enabled,
    timezone,
    nightCron,
    morningCron,
    now: nowFn(),
  })

  log({
    level: 'info',
    msg: 'worker daily intelligence scheduler started',
    nightCron,
    morningCron,
    legacyCron: cron ?? null,
    timezone,
    marketOpenHour,
    dryRunDefault,
    tickIntervalMs,
    nextNightRun: status.nextNightRun,
    nextMorningRun: status.nextMorningRun,
  })

  return timer
}
