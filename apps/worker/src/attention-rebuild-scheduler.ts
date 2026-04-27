/**
 * Worker scheduler that periodically rebuilds attention items via the API.
 *
 * - gated by ATTENTION_REBUILD_AUTO_ENABLED (default false) and
 *   ATTENTION_SYSTEM_ENABLED.
 * - uses a Redis lock so only one rebuild runs at a time.
 * - propagates a per-tick requestId for tracing.
 * - fail-soft: errors are logged but never crash the worker loop.
 */
import { randomUUID } from 'node:crypto'

export const ATTENTION_REBUILD_LOCK_KEY = 'attention:rebuild:lock'
export const ATTENTION_REBUILD_LOCK_TTL_SECONDS = 5 * 60

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

export const buildAttentionRebuildRequest = ({
  apiInternalUrl,
  requestId,
  privateAccessToken,
}: {
  apiInternalUrl: string
  requestId: string
  privateAccessToken?: string
}) => {
  return {
    url: `${apiInternalUrl.replace(/\/+$/, '')}/dashboard/trading-lab/attention/rebuild`,
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-request-id': requestId,
        ...(privateAccessToken ? { 'x-internal-token': privateAccessToken } : {}),
      },
      body: JSON.stringify({ trigger: 'scheduled' }),
    } satisfies RequestInit,
  }
}

export const triggerAttentionRebuild = async ({
  redisClient,
  apiInternalUrl,
  privateAccessToken,
  log,
  fetchImpl = fetch,
  requestId = `wrk-attn-${randomUUID()}`,
}: {
  redisClient: RedisLockClient
  apiInternalUrl: string
  privateAccessToken?: string
  log: SchedulerLogger
  fetchImpl?: typeof fetch
  requestId?: string
}) => {
  const lock = await redisClient.set(ATTENTION_REBUILD_LOCK_KEY, requestId, {
    NX: true,
    EX: ATTENTION_REBUILD_LOCK_TTL_SECONDS,
  })

  if (lock !== 'OK') {
    log({
      level: 'warn',
      msg: 'worker attention rebuild skipped because another run is active',
      requestId,
    })
    return { status: 'skipped' as const, requestId }
  }

  try {
    const request = buildAttentionRebuildRequest({
      apiInternalUrl,
      requestId,
      ...(privateAccessToken ? { privateAccessToken } : {}),
    })
    const response = await fetchImpl(request.url, request.init)
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`ATTENTION_REBUILD_HTTP_${response.status}:${text.slice(0, 200)}`)
    }
    log({
      level: 'info',
      msg: 'worker attention rebuild triggered',
      requestId,
    })
    return { status: 'triggered' as const, requestId }
  } catch (error) {
    log({
      level: 'error',
      msg: 'worker attention rebuild trigger failed',
      requestId,
      errMessage: toSafeErrorMessage(error),
    })
    return {
      status: 'failed' as const,
      requestId,
      errorMessage: toSafeErrorMessage(error),
    }
  } finally {
    await redisClient.del(ATTENTION_REBUILD_LOCK_KEY)
  }
}

export const startAttentionRebuildScheduler = ({
  externalIntegrationsSafeMode,
  attentionSystemEnabled,
  autoRebuildEnabled,
  intervalMs,
  trigger,
  log,
  setIntervalFn = setInterval,
}: {
  externalIntegrationsSafeMode: boolean
  attentionSystemEnabled: boolean
  autoRebuildEnabled: boolean
  intervalMs: number
  trigger: () => Promise<unknown>
  log: SchedulerLogger
  setIntervalFn?: typeof setInterval
}) => {
  if (externalIntegrationsSafeMode) {
    log({
      level: 'warn',
      msg: 'worker attention scheduler disabled',
      reason: 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true',
    })
    return null
  }

  if (!attentionSystemEnabled) {
    log({
      level: 'warn',
      msg: 'worker attention scheduler disabled',
      reason: 'ATTENTION_SYSTEM_ENABLED=false',
    })
    return null
  }

  if (!autoRebuildEnabled) {
    log({
      level: 'warn',
      msg: 'worker attention scheduler disabled',
      reason: 'ATTENTION_REBUILD_AUTO_ENABLED=false',
    })
    return null
  }

  const timer = setIntervalFn(() => {
    void trigger()
  }, intervalMs)

  log({
    level: 'info',
    msg: 'worker attention scheduler started',
    schedulerIntervalMs: intervalMs,
  })

  return timer
}
