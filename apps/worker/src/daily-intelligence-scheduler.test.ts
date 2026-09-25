import { describe, expect, it } from 'bun:test'
import { createInMemoryRedisClient } from '@finance-os/redis'
import {
  buildDailyIntelligenceRequest,
  buildDailyIntelligenceSchedulerStatus,
  DAILY_INTELLIGENCE_LOCK_KEY,
  getNextDailyIntelligenceRun,
  shouldTriggerDailyIntelligenceRun,
  shouldTriggerDailyIntelligenceScheduledRun,
  triggerDailyIntelligenceRun,
} from './daily-intelligence-scheduler'

describe('daily intelligence scheduler', () => {
  it('triggers on weekdays at 09:00 Europe/Paris by default', () => {
    const decision = shouldTriggerDailyIntelligenceRun({
      now: new Date('2026-05-04T07:00:00.000Z'),
      timezone: 'Europe/Paris',
      marketOpenHour: 9,
      cron: '0 9 * * 1-5',
      lastTriggeredDay: null,
    })

    expect(decision.shouldTrigger).toBe(true)
    expect(decision.dayKey).toBe('2026-05-04')
  })

  it('does not trigger on weekends', () => {
    const decision = shouldTriggerDailyIntelligenceRun({
      now: new Date('2026-05-03T07:00:00.000Z'),
      timezone: 'Europe/Paris',
      marketOpenHour: 9,
      cron: '0 9 * * 1-5',
      lastTriggeredDay: null,
    })

    expect(decision.shouldTrigger).toBe(false)
    expect(decision.skipReason).toBe('weekend')
  })

  it('targets the unified refresh route with the internal token', () => {
    const request = buildDailyIntelligenceRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-daily',
      privateAccessToken: 'private-token',
      runKind: 'morning',
    })

    expect(request.url).toBe('http://api.internal.local/ops/refresh/all')
    expect(request.init.headers).toMatchObject({
      'x-request-id': 'req-daily',
      'x-internal-token': 'private-token',
    })
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled', runKind: 'morning' }))
  })

  it('triggers independent night and morning schedules', () => {
    const night = shouldTriggerDailyIntelligenceScheduledRun({
      now: new Date('2026-05-04T21:15:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '15 23 * * *',
      runKind: 'night',
      lastTriggeredKey: null,
    })
    const morning = shouldTriggerDailyIntelligenceScheduledRun({
      now: new Date('2026-05-04T05:30:00.000Z'),
      timezone: 'Europe/Paris',
      cron: '30 7 * * *',
      runKind: 'morning',
      lastTriggeredKey: null,
    })

    expect(night.shouldTrigger).toBe(true)
    expect(night.triggerKey).toBe('night:2026-05-04')
    expect(morning.shouldTrigger).toBe(true)
    expect(morning.triggerKey).toBe('morning:2026-05-04')
  })

  it('computes next night and morning run timestamps in the configured timezone', () => {
    const now = new Date('2026-05-04T05:29:00.000Z')
    expect(
      getNextDailyIntelligenceRun({
        now,
        timezone: 'Europe/Paris',
        cron: '30 7 * * *',
        fallbackHour: 7,
      })
    ).toBe('2026-05-04T05:30:00.000Z')

    const status = buildDailyIntelligenceSchedulerStatus({
      enabled: true,
      timezone: 'Europe/Paris',
      nightCron: '15 23 * * *',
      morningCron: '30 7 * * *',
      now,
    })

    expect(status.nextMorningRun).toBe('2026-05-04T05:30:00.000Z')
    expect(status.nextNightRun).toBe('2026-05-04T21:15:00.000Z')
  })
})

describe('triggerDailyIntelligenceRun', () => {
  const nightLockKey = `${DAILY_INTELLIGENCE_LOCK_KEY}:night`

  it('skips when another run of the same kind owns the lock and leaves that lock intact', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(nightLockKey, 'foreign-token', { NX: true, EX: 60 })
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDailyIntelligenceRun({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      },
      requestId: 'req-daily-skip',
      runKind: 'night',
    })

    expect(result).toEqual({ status: 'skipped', requestId: 'req-daily-skip', runKind: 'night' })
    expect(fetchCalled).toBe(false)
    expect(events[0]).toMatchObject({
      msg: 'worker daily intelligence skipped because another run is active',
      lockKey: nightLockKey,
    })
    expect(await redis.client.get(nightLockKey)).toBe('foreign-token')
  })

  it('posts with the lease signal and releases the run-kind lock on success', async () => {
    const redis = createInMemoryRedisClient()
    const signals: Array<boolean | null> = []

    const result = await triggerDailyIntelligenceRun({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: () => {},
      fetchImpl: async (_url, init) => {
        signals.push(init?.signal instanceof AbortSignal ? init.signal.aborted : null)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      requestId: 'req-daily-ok',
      runKind: 'night',
      lockTtlSeconds: 120,
    })

    expect(result).toEqual({ status: 'triggered', requestId: 'req-daily-ok', runKind: 'night' })
    expect(signals).toEqual([false])
    expect(await redis.client.get(nightLockKey)).toBeNull()
  })

  it('releases the lock when the trigger fails', async () => {
    const redis = createInMemoryRedisClient()

    const result = await triggerDailyIntelligenceRun({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: () => {},
      fetchImpl: async () => new Response('boom', { status: 500 }),
      requestId: 'req-daily-fail',
      runKind: 'night',
    })

    expect(result.status).toBe('failed')
    expect(await redis.client.get(nightLockKey)).toBeNull()
  })
})
