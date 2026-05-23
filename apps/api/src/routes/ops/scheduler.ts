import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../auth/context'
import { requireAdmin } from '../../auth/guard'

type SchedulerStatusConfig = {
  dailyIntelligenceEnabled: boolean
  dailyIntelligenceTimezone: string
  dailyIntelligenceNightCron: string
  dailyIntelligenceMorningCron: string
  dailyIntelligenceLegacyCron: string
  dailyIntelligenceDryRunDefault: boolean
  dailyIntelligenceManualTriggerEnabled: boolean
  marketDataAutoRefreshEnabled: boolean
  signalsSocialPollingEnabled: boolean
}

const toBooleanEnv = (value: string | undefined, fallback = false) => {
  if (value === undefined || value.trim().length === 0) {
    return fallback
  }
  const normalized = value.trim().toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
}

const getZonedParts = (date: Date, timeZone: string) => {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    weekday: 'short',
    hourCycle: 'h23',
    hour: '2-digit',
    minute: '2-digit',
  }).formatToParts(date)
  const weekday = parts.find(part => part.type === 'weekday')?.value ?? 'Mon'
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
    weekdayNumber: weekdayByLabel[weekday] ?? 1,
    hour: Number(parts.find(part => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find(part => part.type === 'minute')?.value ?? '0'),
  }
}

const parseCronNumber = (field: string | undefined, fallback: number) => {
  if (field === undefined || field === '*') return fallback
  const parsed = Number(field)
  return Number.isInteger(parsed) ? parsed : null
}

const parseWeekdays = (field: string | undefined) => {
  if (field === undefined || field === '*') return null
  const days = new Set<number>()
  for (const part of field.split(',')) {
    const range = part.trim().match(/^(\d)-(\d)$/)
    if (range) {
      const start = Number(range[1])
      const end = Number(range[2])
      for (let day = start; day <= end; day += 1) days.add(day === 7 ? 0 : day)
      continue
    }
    const day = Number(part.trim())
    if (!Number.isInteger(day)) return null
    days.add(day === 7 ? 0 : day)
  }
  return days.size > 0 ? days : null
}

const getNextRun = ({
  now,
  timezone,
  cron,
  fallbackHour,
}: {
  now: Date
  timezone: string
  cron: string
  fallbackHour: number
}) => {
  const [minuteField, hourField, _dayOfMonth, _month, weekdayField] = cron.trim().split(/\s+/)
  const minute = parseCronNumber(minuteField, 0)
  const hour = parseCronNumber(hourField, fallbackHour)
  const weekdays = parseWeekdays(weekdayField)
  if (minute === null || hour === null || minute < 0 || minute > 59 || hour < 0 || hour > 23) {
    return null
  }

  const start = new Date(now.getTime())
  start.setUTCSeconds(0, 0)
  start.setUTCMinutes(start.getUTCMinutes() + 1)

  for (let offsetMinutes = 0; offsetMinutes < 8 * 24 * 60; offsetMinutes += 1) {
    const candidate = new Date(start.getTime() + offsetMinutes * 60_000)
    const zoned = getZonedParts(candidate, timezone)
    if (weekdays && !weekdays.has(zoned.weekdayNumber)) continue
    if (zoned.hour === hour && zoned.minute === minute) return candidate.toISOString()
  }

  return null
}

const resolveSchedulerState = (enabled: boolean) => (enabled ? 'enabled' : 'disabled')

export const createOpsSchedulerRoute = ({
  config,
  processEnv = process.env,
  now = () => new Date(),
}: {
  config: SchedulerStatusConfig
  processEnv?: NodeJS.ProcessEnv
  now?: () => Date
}) =>
  new Elysia({ prefix: '/ops/scheduler' }).get('/status', context => {
    const requestId = getRequestMeta(context).requestId
    const mode = getAuth(context).mode
    if (mode === 'admin') {
      requireAdmin(context)
    }

    const generatedAt = now()
    const postMortemAutoEnabled = toBooleanEnv(processEnv.AI_POST_MORTEM_AUTO_RUN_ENABLED, false)
    const attentionSystemEnabled = toBooleanEnv(processEnv.ATTENTION_SYSTEM_ENABLED, true)
    const attentionRebuildAutoEnabled = toBooleanEnv(
      processEnv.ATTENTION_REBUILD_AUTO_ENABLED,
      false
    )

    return {
      requestId,
      mode,
      generatedAt: generatedAt.toISOString(),
      dailyIntelligenceEnabled: config.dailyIntelligenceEnabled,
      timezone: config.dailyIntelligenceTimezone,
      nightCron: config.dailyIntelligenceNightCron,
      morningCron: config.dailyIntelligenceMorningCron,
      legacyCron: config.dailyIntelligenceLegacyCron,
      dryRunDefault: config.dailyIntelligenceDryRunDefault,
      manualTriggerEnabled: config.dailyIntelligenceManualTriggerEnabled,
      nextNightRun: config.dailyIntelligenceEnabled
        ? getNextRun({
            now: generatedAt,
            timezone: config.dailyIntelligenceTimezone,
            cron: config.dailyIntelligenceNightCron,
            fallbackHour: 23,
          })
        : null,
      nextMorningRun: config.dailyIntelligenceEnabled
        ? getNextRun({
            now: generatedAt,
            timezone: config.dailyIntelligenceTimezone,
            cron: config.dailyIntelligenceMorningCron,
            fallbackHour: 7,
          })
        : null,
      activeLocks: {
        status: 'not_available_from_api_runtime',
        lockKeys: [
          'daily-intelligence:run:lock:night',
          'daily-intelligence:run:lock:morning',
          'signals:social:ingest:lock',
          'markets:dashboard:refresh:lock',
          'finance-os:post-mortem:scheduler-lock',
          'attention:rebuild:lock',
        ],
      },
      schedulerStatus: {
        socialSchedulerStatus: resolveSchedulerState(config.signalsSocialPollingEnabled),
        marketSchedulerStatus: resolveSchedulerState(config.marketDataAutoRefreshEnabled),
        postMortemSchedulerStatus: resolveSchedulerState(postMortemAutoEnabled),
        attentionRebuildStatus: resolveSchedulerState(
          attentionSystemEnabled && attentionRebuildAutoEnabled
        ),
      },
      caveats: [
        'This endpoint is served by the API container; active Redis lock values are listed but not read in this foundation pass.',
        'Set DAILY_INTELLIGENCE_ENABLED=true on the worker in production to activate the scheduler.',
      ],
    }
  })
