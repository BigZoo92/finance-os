import { describe, expect, it } from 'bun:test'
import { createInMemoryRedisClient } from '@finance-os/redis'
import {
  __testing,
  shouldTriggerXDailySync,
  startXDailySyncScheduler,
  triggerXDailySync,
  X_DAILY_PREVIOUS_DAY_LOCK_KEY,
} from './x-twitter-daily-sync-scheduler'

describe('shouldTriggerXDailySync', () => {
  it('skips when the same dayKey was already triggered', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'Europe/Paris',
      cron: '0 7 * * *',
      lastTriggeredDay: '2026-05-12',
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('already_triggered_today')
  })

  it('triggers when current minute matches the cron in the configured timezone', () => {
    // 09:00 Europe/Paris in summer is 07:00Z
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'Europe/Paris',
      cron: '0 9 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(true)
  })

  it('skips outside the cron minute', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T08:01:00Z'),
      timezone: 'UTC',
      cron: '0 8 * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('outside_cron_minute')
  })

  it('marks invalid cron as invalid_cron', () => {
    const decision = shouldTriggerXDailySync({
      now: new Date('2026-05-12T07:00:00Z'),
      timezone: 'UTC',
      cron: 'NaN NaN * * *',
      lastTriggeredDay: null,
    })
    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('invalid_cron')
  })
})

describe('buildXDailySyncRequest', () => {
  it('targets the dashboard daily-previous-day-sync endpoint', () => {
    const req = __testing.buildXDailySyncRequest({
      apiInternalUrl: 'http://api:3001',
      requestId: 'req-1',
      privateAccessToken: 'tok',
    })
    expect(req.url).toBe('http://api:3001/dashboard/signals/x-twitter/daily-previous-day-sync')
    expect((req.init.headers as Record<string, string>)['x-internal-token']).toBe('tok')
    expect(req.init.body).toContain('automatic_capped')
  })
})

describe('triggerXDailySync', () => {
  it('skips when another sync already owns the lock and leaves that lock intact', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(X_DAILY_PREVIOUS_DAY_LOCK_KEY, 'foreign-token', { NX: true, EX: 60 })
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerXDailySync({
      redisClient: redis.client,
      apiInternalUrl: 'http://api:3001',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      },
      requestId: 'req-x-skip',
    })

    expect(result).toEqual({ status: 'skipped', requestId: 'req-x-skip' })
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker x daily sync skipped because another run is active')
    expect(await redis.client.get(X_DAILY_PREVIOUS_DAY_LOCK_KEY)).toBe('foreign-token')
  })

  it('posts with the lease signal and releases the lock on success', async () => {
    const redis = createInMemoryRedisClient()
    const signals: Array<boolean | null> = []

    const result = await triggerXDailySync({
      redisClient: redis.client,
      apiInternalUrl: 'http://api:3001',
      log: () => {},
      fetchImpl: async (_url, init) => {
        signals.push(init?.signal instanceof AbortSignal ? init.signal.aborted : null)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      requestId: 'req-x-ok',
      lockTtlSeconds: 120,
    })

    expect(result).toEqual({ status: 'triggered', requestId: 'req-x-ok' })
    expect(signals).toEqual([false])
    expect(await redis.client.get(X_DAILY_PREVIOUS_DAY_LOCK_KEY)).toBeNull()
  })

  it('releases the lock when the trigger fails', async () => {
    const redis = createInMemoryRedisClient()

    const result = await triggerXDailySync({
      redisClient: redis.client,
      apiInternalUrl: 'http://api:3001',
      log: () => {},
      fetchImpl: async () => new Response('boom', { status: 500 }),
      requestId: 'req-x-fail',
    })

    expect(result.status).toBe('failed')
    expect(await redis.client.get(X_DAILY_PREVIOUS_DAY_LOCK_KEY)).toBeNull()
  })
})

describe('startXDailySyncScheduler', () => {
  it('returns a no-op when enabled=false', () => {
    let invocations = 0
    const handle = startXDailySyncScheduler({
      enabled: false,
      cron: '0 7 * * *',
      timezone: 'Europe/Paris',
      trigger: async () => {
        invocations += 1
      },
      log: () => {},
    })
    handle.stop()
    expect(invocations).toBe(0)
  })
})
