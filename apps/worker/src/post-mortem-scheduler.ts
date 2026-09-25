// PR7 — Advisor Post-Mortem worker scheduler.
//
// The worker DOES NOT run post-mortem logic itself. It periodically fires an internal HTTP
// POST against the existing `/dashboard/advisor/post-mortem/run` route, which owns:
//   • feature-flag gate (AI_POST_MORTEM_ENABLED)
//   • budget gate (computeAiBudgetState().deepAnalysisAllowed)
//   • structured-runner / LLM call
//   • DB writes
//   • output validation
//   • execution-directive guardrail
//
// The worker only owns: cron decision, Redis lock, internal HTTP call, structured logs.
//
// All dependencies (Redis, fetch, logger, now) are injected so the trigger function is
// deterministically testable. Mirrors the existing `daily-intelligence-scheduler.ts` pattern.

import { randomUUID } from 'node:crypto'
import { acquireRedisLock, type RedisLockClient } from '@finance-os/redis'

export const POST_MORTEM_SCHEDULER_LOCK_KEY = 'finance-os:post-mortem:scheduler-lock'
export const POST_MORTEM_SCHEDULER_LOCK_TTL_SECONDS_DEFAULT = 30 * 60
export const POST_MORTEM_SCHEDULER_TRIGGER_TIMEOUT_MS_DEFAULT = 30_000

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
    hour: Number(parts.find(part => part.type === 'hour')?.value ?? '0'),
    minute: Number(parts.find(part => part.type === 'minute')?.value ?? '0'),
  }
}

// Cron field parser — same convention as `daily-intelligence-scheduler.ts`. Only `minute` and
// `hour` fields are honoured; the rest of the cron string is documentation. Worker behaviour:
// fire at most once per local day per (cron minute, cron hour) couple in the configured
// timezone.
export const shouldTriggerPostMortemRun = ({
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
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'already_triggered_today',
    } as const
  }

  const [minuteField, hourField] = cron.trim().split(/\s+/)
  const targetMinute = minuteField === undefined || minuteField === '*' ? 0 : Number(minuteField)
  const targetHour = hourField === undefined || hourField === '*' ? 7 : Number(hourField)

  if (!Number.isFinite(targetHour) || !Number.isFinite(targetMinute)) {
    return {
      shouldTrigger: false,
      dayKey,
      skipReason: 'invalid_cron',
    } as const
  }

  const zoned = getZonedParts(now, timezone)
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

// Build the internal HTTP request the worker fires against the API. Centralized so unit tests
// can assert the URL, method, headers, and body shape without spawning an HTTP server.
export const buildPostMortemTriggerRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => ({
  url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/advisor/post-mortem/run`,
  init: {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-request-id': requestId,
      ...(privateAccessToken ? { 'x-internal-token': privateAccessToken } : {}),
    },
    body: JSON.stringify({ trigger: 'scheduled' }),
  } satisfies RequestInit,
})

export type PostMortemTriggerStatus =
  | 'triggered_completed'
  | 'triggered_skipped_disabled'
  | 'triggered_skipped_budget_blocked'
  | 'triggered_skipped_no_due_items'
  | 'triggered_failed'
  | 'lock_skipped'
  | 'request_failed'
  | 'request_timeout'

export interface PostMortemTriggerResult {
  status: PostMortemTriggerStatus
  requestId: string
  apiStatus?: string | null
  errorMessage?: string
}

const RECOGNIZED_API_STATUSES: ReadonlySet<string> = new Set([
  'completed',
  'skipped_disabled',
  'skipped_budget_blocked',
  'skipped_no_due_items',
  'failed',
])

const mapApiStatus = (apiStatus: string | undefined): PostMortemTriggerStatus => {
  switch (apiStatus) {
    case 'completed':
      return 'triggered_completed'
    case 'skipped_disabled':
      return 'triggered_skipped_disabled'
    case 'skipped_budget_blocked':
      return 'triggered_skipped_budget_blocked'
    case 'skipped_no_due_items':
      return 'triggered_skipped_no_due_items'
    case 'failed':
      return 'triggered_failed'
    default:
      return 'request_failed'
  }
}

export const triggerAdvisorPostMortemRun = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-post-mortem-${randomUUID()}`,
  lockTtlSeconds = POST_MORTEM_SCHEDULER_LOCK_TTL_SECONDS_DEFAULT,
  triggerTimeoutMs = POST_MORTEM_SCHEDULER_TRIGGER_TIMEOUT_MS_DEFAULT,
  ownerTokenFn = () => randomUUID(),
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
  lockTtlSeconds?: number
  triggerTimeoutMs?: number
  // Injectable for deterministic tests. The token itself is non-secret but uniquely identifies
  // this run's ownership of the Redis lock.
  ownerTokenFn?: () => string
}): Promise<PostMortemTriggerResult> => {
  // Owner token: a per-run UUID stored as the lock value. The shared primitive releases only
  // while the stored value still matches this token, so worker A can never delete worker B's
  // freshly-acquired lock after A's TTL expired.
  const lock = await acquireRedisLock({
    client: redisClient,
    key: POST_MORTEM_SCHEDULER_LOCK_KEY,
    ttlSeconds: lockTtlSeconds,
    token: ownerTokenFn(),
  })

  if (!lock) {
    log({
      level: 'warn',
      msg: 'worker post-mortem run skipped because another run is active',
      requestId,
      lockKey: POST_MORTEM_SCHEDULER_LOCK_KEY,
    })
    // No release attempt: we never acquired the lock.
    return { status: 'lock_skipped', requestId }
  }

  log({
    level: 'info',
    msg: 'worker post-mortem lock acquired',
    requestId,
    lockKey: POST_MORTEM_SCHEDULER_LOCK_KEY,
    // The owner token is intentionally omitted from logs; it's a non-secret but unnecessary detail.
  })

  // The request is bounded by the trigger timeout and by the lock lease, whichever ends first.
  const signal = AbortSignal.any([
    lock.signal,
    AbortSignal.timeout(Math.max(1, Math.floor(triggerTimeoutMs))),
  ])

  try {
    const request = buildPostMortemTriggerRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, {
      ...request.init,
      signal,
    })

    if (!response.ok) {
      const text = await response.text().catch(() => '')
      const errorMessage = `POST_MORTEM_HTTP_${response.status}:${text.slice(0, 200)}`
      log({
        level: 'error',
        msg: 'worker post-mortem trigger http error',
        requestId,
        apiInternalUrl,
        httpStatus: response.status,
      })
      return {
        status: 'request_failed',
        requestId,
        errorMessage,
        apiStatus: null,
      }
    }

    let apiStatus: string | undefined
    try {
      const payload = (await response.json()) as { status?: string }
      apiStatus = typeof payload.status === 'string' ? payload.status : undefined
    } catch {
      apiStatus = undefined
    }

    const mapped = mapApiStatus(apiStatus)
    const recognized = apiStatus !== undefined && RECOGNIZED_API_STATUSES.has(apiStatus)

    log({
      level: mapped === 'triggered_failed' || !recognized ? 'error' : 'info',
      msg:
        mapped === 'triggered_completed'
          ? 'worker post-mortem trigger success'
          : `worker post-mortem trigger ${apiStatus ?? 'unknown'}`,
      requestId,
      apiInternalUrl,
      apiStatus: apiStatus ?? null,
    })

    return {
      status: mapped,
      requestId,
      apiStatus: apiStatus ?? null,
    }
  } catch (error) {
    const isAbort = (error as { name?: string })?.name === 'AbortError' || signal.aborted
    if (isAbort) {
      log({
        level: 'error',
        msg: 'worker post-mortem trigger request timeout',
        requestId,
        apiInternalUrl,
        triggerTimeoutMs,
      })
      return { status: 'request_timeout', requestId, errorMessage: 'request_timeout' }
    }
    log({
      level: 'error',
      msg: 'worker post-mortem trigger failed',
      requestId,
      apiInternalUrl,
      errMessage: toSafeErrorMessage(error),
    })
    return {
      status: 'request_failed',
      requestId,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    // Compare-and-delete with the owner token: 'not_owner' means another worker took over after
    // our TTL expired, so its lock is left intact.
    const released = await lock.release()
    if (released === 'not_owner') {
      log({
        level: 'warn',
        msg: 'worker post-mortem lock release skipped: token mismatch',
        requestId,
        lockKey: POST_MORTEM_SCHEDULER_LOCK_KEY,
      })
    } else if (released === 'error') {
      log({
        level: 'warn',
        msg: 'worker post-mortem lock release failed',
        requestId,
        lockKey: POST_MORTEM_SCHEDULER_LOCK_KEY,
      })
    }
  }
}

export const startPostMortemScheduler = ({
  externalIntegrationsSafeMode,
  enabled,
  cron,
  timezone,
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
  tickIntervalMs?: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  nowFn?: () => Date
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker post-mortem scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!enabled) {
    log({
      level: 'warn',
      msg: 'worker post-mortem scheduler disabled',
      reason: 'AI_POST_MORTEM_AUTO_RUN_ENABLED=false',
    })
    return null
  }

  let lastTriggeredDay: string | null = null
  let pendingDay: string | null = null

  const runSchedulerTick = () => {
    const decision = shouldTriggerPostMortemRun({
      now: nowFn(),
      timezone,
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
          typeof (result as { status: unknown }).status === 'string' &&
          (result as { status: string }).status.startsWith('triggered_')
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
    msg: 'worker post-mortem scheduler started',
    cron,
    timezone,
    tickIntervalMs,
  })

  return timer
}
