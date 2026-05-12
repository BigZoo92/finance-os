/**
 * Worker scheduler that triggers the X previous-day timeline sync via an
 * internal HTTP call to the API. Strict gate:
 *   - X_DAILY_PREVIOUS_DAY_SYNC_ENABLED must be true
 *   - X_DAILY_PREVIOUS_DAY_CRON must hit the current minute in
 *     X_DAILY_PREVIOUS_DAY_TIMEZONE
 *   - Lock prevents concurrent invocations
 *
 * The API enforces budget; the worker only schedules.
 */

import { randomUUID } from 'node:crypto'

export const X_DAILY_PREVIOUS_DAY_LOCK_KEY = 'x-twitter-daily-previous-day:run:lock'

type RedisLockClient = {
  set: (
    key: string,
    value: string,
    options: { NX: true; EX: number }
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
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  return {
    hour: Number(parts.find(p => p.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find(p => p.type === 'minute')?.value ?? '0'),
  }
}

export const shouldTriggerXDailySync = ({
  now,
  timezone,
  cron,
  lastTriggeredDay,
}: {
  now: Date
  timezone: string
  cron: string
  lastTriggeredDay: string | null
}) => {
  const dayKey = formatDayKey(now, timezone)
  if (dayKey === lastTriggeredDay) {
    return { shouldTrigger: false, dayKey, skipReason: 'already_triggered_today' as const }
  }
  const [minuteField, hourField] = cron.trim().split(/\s+/)
  const targetMinute = minuteField === '*' ? 0 : Number(minuteField ?? 0)
  const targetHour = hourField === '*' ? 7 : Number(hourField ?? 7)
  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) {
    return { shouldTrigger: false, dayKey, skipReason: 'invalid_cron' as const }
  }
  const zoned = getZonedParts(now, timezone)
  if (zoned.hour !== targetHour || zoned.minute !== targetMinute) {
    return { shouldTrigger: false, dayKey, skipReason: 'outside_cron_minute' as const }
  }
  return { shouldTrigger: true, dayKey, skipReason: null }
}

const buildXDailySyncRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => ({
  url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/signals/x-twitter/daily-previous-day-sync`,
  init: {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...(privateAccessToken ? { 'x-internal-token': privateAccessToken } : {}),
    },
    body: JSON.stringify({
      runMode: 'automatic_capped',
      dryRun: false,
    }),
  } satisfies RequestInit,
})

export const triggerXDailySync = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-x-daily-${randomUUID()}`,
  lockTtlSeconds = 30 * 60,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
  lockTtlSeconds?: number
}) => {
  const lock = await redisClient.set(X_DAILY_PREVIOUS_DAY_LOCK_KEY, requestId, {
    NX: true,
    EX: lockTtlSeconds,
  })
  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker x daily sync skipped because another run is active',
      requestId,
    })
    return { status: 'skipped' as const, requestId }
  }
  try {
    const request = buildXDailySyncRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)
    if (!response.ok) {
      const text = await response.text().catch(() => '')
      throw new Error(`X_DAILY_HTTP_${response.status}:${text.slice(0, 200)}`)
    }
    log({
      level: 'info',
      msg: 'worker x daily sync triggered',
      requestId,
      apiInternalUrl,
    })
    return { status: 'triggered' as const, requestId }
  } catch (error) {
    log({
      level: 'error',
      msg: 'worker x daily sync trigger failed',
      requestId,
      errMessage: toSafeErrorMessage(error),
    })
    return {
      status: 'failed' as const,
      requestId,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    await redisClient.del(X_DAILY_PREVIOUS_DAY_LOCK_KEY)
  }
}

export const startXDailySyncScheduler = ({
  enabled,
  cron,
  timezone,
  tickIntervalMs = 60_000,
  trigger,
  log,
  nowFn = () => new Date(),
}: {
  enabled: boolean
  cron: string
  timezone: string
  tickIntervalMs?: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  nowFn?: () => Date
}) => {
  if (!enabled) {
    log({ level: 'info', msg: 'worker x daily sync scheduler disabled (env off)' })
    return { stop: () => {} }
  }
  let lastTriggeredDay: string | null = null
  let running = false
  const tick = async () => {
    if (running) return
    running = true
    try {
      const now = nowFn()
      const decision = shouldTriggerXDailySync({
        now,
        timezone,
        cron,
        lastTriggeredDay,
      })
      if (!decision.shouldTrigger) return
      lastTriggeredDay = decision.dayKey
      await trigger()
    } catch (error) {
      log({
        level: 'error',
        msg: 'worker x daily sync tick failed',
        errMessage: toSafeErrorMessage(error),
      })
    } finally {
      running = false
    }
  }
  const handle = setInterval(tick, tickIntervalMs)
  // Run once on startup (will respect cron + dayKey)
  void tick()
  log({
    level: 'info',
    msg: 'worker x daily sync scheduler started',
    cron,
    timezone,
  })
  return { stop: () => clearInterval(handle) }
}

export const __testing = { buildXDailySyncRequest }
