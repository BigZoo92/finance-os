import { describe, expect, it } from 'bun:test'
import {
  POST_MORTEM_SCHEDULER_LOCK_KEY,
  buildPostMortemTriggerRequest,
  shouldTriggerPostMortemRun,
  startPostMortemScheduler,
  triggerAdvisorPostMortemRun,
} from './post-mortem-scheduler'

interface FakeRedisState {
  // PR7-fix — emulates the production node-redis surface used by the scheduler:
  //   • SET key value NX EX ttl  → 'OK' if key was free, null otherwise
  //   • EVAL release-lock keys=[k] arguments=[token] → 1 if stored value === token (and DEL
  //     occurs), 0 otherwise. Mirrors `packages/redis/src/in-memory.test.ts` contract.
  storedValue: string | null
  setCalls: Array<{ key: string; value: string; nx: true; ex: number }>
  evalCalls: Array<{ key: string; argument: string; matched: boolean }>
  evalThrows?: Error
}

const buildFakeRedis = (initial: { storedValue?: string | null; evalThrows?: Error } = {}) => {
  const state: FakeRedisState = {
    storedValue: initial.storedValue ?? null,
    setCalls: [],
    evalCalls: [],
    ...(initial.evalThrows ? { evalThrows: initial.evalThrows } : {}),
  }
  const client = {
    async set(
      key: string,
      value: string,
      options: { NX: true; EX: number }
    ): Promise<string | null> {
      state.setCalls.push({ key, value, nx: options.NX, ex: options.EX })
      if (state.storedValue !== null) return null
      state.storedValue = value
      return 'OK'
    },
    async eval(
      _script: string,
      options: { keys: string[]; arguments: string[] }
    ): Promise<number> {
      if (state.evalThrows) throw state.evalThrows
      const argument = options.arguments[0] ?? ''
      const key = options.keys[0] ?? ''
      const matched = state.storedValue === argument
      state.evalCalls.push({ key, argument, matched })
      if (matched) {
        state.storedValue = null
        return 1
      }
      return 0
    },
  }
  return { client, state }
}

interface CapturedLog {
  level: 'info' | 'warn' | 'error'
  msg: string
  [key: string]: unknown
}

const buildCapturingLogger = () => {
  const events: CapturedLog[] = []
  const log = (event: CapturedLog) => {
    events.push(event)
  }
  return { log, events }
}

const buildJsonResponse = (body: object, init?: { status?: number }) =>
  new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: { 'content-type': 'application/json' },
  })

describe('shouldTriggerPostMortemRun', () => {
  it('triggers at the configured cron minute in the configured timezone', () => {
    const decision = shouldTriggerPostMortemRun({
      // 07:00 Europe/Paris on a winter day = 06:00 UTC.
      now: new Date('2026-01-15T06:00:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '0 7 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(true)
    expect(decision.dayKey).toBe('2026-01-15')
  })

  it('skips outside the cron minute', () => {
    const decision = shouldTriggerPostMortemRun({
      now: new Date('2026-01-15T05:30:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '0 7 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('outside_cron_minute')
  })

  it('skips if already triggered for the current day', () => {
    const decision = shouldTriggerPostMortemRun({
      now: new Date('2026-01-15T06:00:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '0 7 * * *',
      lastTriggeredDay: '2026-01-15',
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('already_triggered_today')
  })

  it('falls back gracefully on invalid cron', () => {
    const decision = shouldTriggerPostMortemRun({
      now: new Date('2026-01-15T06:00:00.000Z'),
      timezone: 'Europe/Paris',
      cron: 'not a cron',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('invalid_cron')
  })
})

describe('buildPostMortemTriggerRequest', () => {
  it('targets the post-mortem run route with the internal token header', () => {
    const request = buildPostMortemTriggerRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-pm-1',
      privateAccessToken: 'private-token',
    })
    expect(request.url).toBe('http://api.internal.local/dashboard/advisor/post-mortem/run')
    expect(request.init.headers).toMatchObject({
      'x-request-id': 'req-pm-1',
      'x-internal-token': 'private-token',
      'content-type': 'application/json',
    })
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled' }))
  })

  it('omits the internal token header when no private access token is provided', () => {
    const request = buildPostMortemTriggerRequest({
      apiInternalUrl: 'http://api.internal.local',
      requestId: 'req-pm-2',
    })
    const headers = request.init.headers as Record<string, string>
    expect(headers['x-internal-token']).toBeUndefined()
  })
})

describe('triggerAdvisorPostMortemRun', () => {
  it('skips and does not call fetch when the lock is already held', async () => {
    const { client: redis, state } = buildFakeRedis({ storedValue: 'foreign-token' })
    const { log, events } = buildCapturingLogger()
    let fetchCalls = 0
    const fetchImpl = (async () => {
      fetchCalls += 1
      throw new Error('fetch should not be called when lock is held')
    }) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
    })

    expect(result.status).toBe('lock_skipped')
    expect(fetchCalls).toBe(0)
    expect(state.setCalls.length).toBe(1)
    expect(state.setCalls[0]?.key).toBe(POST_MORTEM_SCHEDULER_LOCK_KEY)
    // PR7-fix — the lock-skipped path must NOT release anything we did not acquire. Compare-
    // and-delete is never even attempted. The foreign worker's lock value is preserved.
    expect(state.evalCalls.length).toBe(0)
    expect(state.storedValue).toBe('foreign-token')
    expect(events.some(e => e.msg.includes('skipped because another run is active'))).toBe(true)
  })

  it('fires exactly one HTTP call and logs success on apiStatus=completed', async () => {
    const { client: redis, state } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    let fetchCalls = 0
    const fetchImpl = (async () => {
      fetchCalls += 1
      return buildJsonResponse({ status: 'completed', persistedIds: [1, 2, 3] })
    }) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      privateAccessToken: 'super-secret-private-access-token-value',
      log,
      fetchImpl,
      ownerTokenFn: () => 'owner-A',
    })

    expect(result.status).toBe('triggered_completed')
    expect(result.apiStatus).toBe('completed')
    expect(fetchCalls).toBe(1)
    // PR7-fix — release went through compare-and-delete with the owner token. The eval
    // returned 1 (matched), the stored value is now null. Lock fully released.
    expect(state.evalCalls.length).toBe(1)
    expect(state.evalCalls[0]).toMatchObject({
      key: POST_MORTEM_SCHEDULER_LOCK_KEY,
      argument: 'owner-A',
      matched: true,
    })
    expect(state.storedValue).toBeNull()
    expect(events.some(e => e.msg === 'worker post-mortem trigger success')).toBe(true)
    // PR7-fix — neither the internal token nor the owner token must appear in any log line.
    for (const event of events) {
      const serialized = JSON.stringify(event)
      expect(serialized.includes('super-secret-private-access-token-value')).toBe(false)
      expect(serialized.includes('owner-A')).toBe(false)
    }
  })

  it('logs a safe skip when the API returns skipped_disabled', async () => {
    const { client: redis } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    const fetchImpl = (async () =>
      buildJsonResponse({ status: 'skipped_disabled' })) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
    })

    expect(result.status).toBe('triggered_skipped_disabled')
    expect(result.apiStatus).toBe('skipped_disabled')
    expect(events.some(e => e.msg.includes('skipped_disabled'))).toBe(true)
  })

  it('logs a safe skip when the API returns skipped_budget_blocked', async () => {
    const { client: redis } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    const fetchImpl = (async () =>
      buildJsonResponse({ status: 'skipped_budget_blocked' })) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
    })

    expect(result.status).toBe('triggered_skipped_budget_blocked')
    expect(events.some(e => e.msg.includes('skipped_budget_blocked'))).toBe(true)
  })

  it('logs a safe skip when the API returns skipped_no_due_items', async () => {
    const { client: redis } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    const fetchImpl = (async () =>
      buildJsonResponse({ status: 'skipped_no_due_items' })) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
    })

    expect(result.status).toBe('triggered_skipped_no_due_items')
    expect(events.some(e => e.msg.includes('skipped_no_due_items'))).toBe(true)
  })

  it('reports request_failed when the API returns 5xx', async () => {
    const { client: redis, state } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    const fetchImpl = (async () =>
      new Response('upstream error', { status: 503 })) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
    })

    expect(result.status).toBe('request_failed')
    expect(events.some(e => e.level === 'error')).toBe(true)
    // Lock is always released even when the request fails — via compare-and-delete with the
    // owner token, so we never clobber a foreign worker's lock.
    expect(state.evalCalls.length).toBe(1)
    expect(state.evalCalls[0]?.matched).toBe(true)
    expect(state.storedValue).toBeNull()
  })

  it('reports request_timeout when the request is aborted, and does not throw', async () => {
    const { client: redis, state } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()
    // Simulate an in-flight fetch that is aborted via the AbortController.
    const fetchImpl = ((_url: string, init?: RequestInit) => {
      return new Promise((_, reject) => {
        const signal = init?.signal
        if (!signal) return
        if (signal.aborted) {
          const error = new Error('aborted')
          ;(error as { name: string }).name = 'AbortError'
          reject(error)
          return
        }
        signal.addEventListener('abort', () => {
          const error = new Error('aborted')
          ;(error as { name: string }).name = 'AbortError'
          reject(error)
        })
      })
    }) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
      // Tiny timeout so the test resolves quickly.
      triggerTimeoutMs: 5,
    })

    expect(result.status).toBe('request_timeout')
    expect(events.some(e => e.msg.includes('timeout'))).toBe(true)
    // PR7-fix — the timeout path still attempts safe release via compare-and-delete.
    expect(state.evalCalls.length).toBe(1)
    expect(state.evalCalls[0]?.matched).toBe(true)
    expect(state.storedValue).toBeNull()
  })

  it('PR7-fix: does NOT release the lock if the stored value differs from the owner token', async () => {
    // Simulate a TTL-expiry race: worker A acquires the lock, A's TTL expires, worker B
    // acquires a fresh lock with its own owner token. A's `finally` block tries to release —
    // and must NOT delete B's lock.
    const { client: redis, state } = buildFakeRedis()
    const { log, events } = buildCapturingLogger()

    // Force the SET to succeed (we simulate worker A's first acquisition).
    // Then between the SET and the release, mutate the stored value to simulate worker B's
    // takeover after worker A's TTL expired.
    const fetchImpl = (async () => {
      // Simulate worker B taking over while worker A's HTTP call is still pending.
      state.storedValue = 'worker-B-token'
      return buildJsonResponse({ status: 'completed' })
    }) as unknown as typeof fetch

    const result = await triggerAdvisorPostMortemRun({
      redisClient: redis,
      apiInternalUrl: 'http://api.internal.local',
      log,
      fetchImpl,
      ownerTokenFn: () => 'worker-A-token',
    })

    expect(result.status).toBe('triggered_completed')
    // The compare-and-delete call ran but did NOT match worker-B's token.
    expect(state.evalCalls.length).toBe(1)
    expect(state.evalCalls[0]).toMatchObject({
      argument: 'worker-A-token',
      matched: false,
    })
    // Worker B's lock is still intact.
    expect(state.storedValue).toBe('worker-B-token')
    // A warn log was emitted for the token-mismatch release.
    expect(events.some(e => e.msg.includes('token mismatch'))).toBe(true)
  })

  it('PR7-fix: lock release error is logged (warn) and does NOT throw', async () => {
    const { client: redis, state } = buildFakeRedis({
      evalThrows: new Error('redis-disconnected'),
    })
    const { log, events } = buildCapturingLogger()
    const fetchImpl = (async () =>
      buildJsonResponse({ status: 'completed' })) as unknown as typeof fetch

    let caught: unknown = null
    let result: Awaited<ReturnType<typeof triggerAdvisorPostMortemRun>> | null = null
    try {
      result = await triggerAdvisorPostMortemRun({
        redisClient: redis,
        apiInternalUrl: 'http://api.internal.local',
        log,
        fetchImpl,
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeNull()
    expect(result?.status).toBe('triggered_completed')
    expect(events.some(e => e.msg.includes('lock release failed'))).toBe(true)
    // The fake never executed the (errored) compare-and-delete, so the stored value is the
    // owner token from the SET call.
    expect(state.storedValue).not.toBeNull()
  })
})

describe('startPostMortemScheduler', () => {
  it('returns null and does not call trigger when EXTERNAL_INTEGRATIONS_SAFE_MODE is true', () => {
    let triggerCalls = 0
    const { log, events } = buildCapturingLogger()
    const timer = startPostMortemScheduler({
      externalIntegrationsSafeMode: true,
      enabled: true,
      cron: '0 7 * * *',
      timezone: 'Europe/Paris',
      trigger: async () => {
        triggerCalls += 1
        return { status: 'triggered_completed' as const, requestId: 'r' }
      },
      log,
      // No setIntervalFn override — but since we return early there's no interval anyway.
    })
    expect(timer).toBeNull()
    expect(triggerCalls).toBe(0)
    expect(events.some(e => e.reason === 'EXTERNAL_INTEGRATIONS_SAFE_MODE=true')).toBe(true)
  })

  it('returns null and does not call trigger when AI_POST_MORTEM_AUTO_RUN_ENABLED is false', () => {
    let triggerCalls = 0
    const { log, events } = buildCapturingLogger()
    const timer = startPostMortemScheduler({
      externalIntegrationsSafeMode: false,
      enabled: false,
      cron: '0 7 * * *',
      timezone: 'Europe/Paris',
      trigger: async () => {
        triggerCalls += 1
        return { status: 'triggered_completed' as const, requestId: 'r' }
      },
      log,
    })
    expect(timer).toBeNull()
    expect(triggerCalls).toBe(0)
    expect(events.some(e => e.reason === 'AI_POST_MORTEM_AUTO_RUN_ENABLED=false')).toBe(true)
  })

  it('returns a timer and ticks once at startup when enabled', async () => {
    let triggerCalls = 0
    const { log } = buildCapturingLogger()
    const timer = startPostMortemScheduler({
      externalIntegrationsSafeMode: false,
      enabled: true,
      cron: '0 7 * * *',
      timezone: 'Europe/Paris',
      trigger: async () => {
        triggerCalls += 1
        return { status: 'triggered_completed' as const, requestId: 'r' }
      },
      log,
      // Freeze time well outside the cron minute so the initial tick decides not to fire.
      nowFn: () => new Date('2026-01-15T12:00:00.000Z'),
      setIntervalFn: (() => 0) as unknown as typeof setInterval,
    })
    // Allow microtask queue to flush.
    await Promise.resolve()
    expect(timer).not.toBeNull()
    expect(triggerCalls).toBe(0) // outside cron minute → no trigger
  })
})
