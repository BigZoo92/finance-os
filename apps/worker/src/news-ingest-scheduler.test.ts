import { afterEach, describe, expect, it, setSystemTime } from 'bun:test'
import { createInMemoryRedisClient } from '@finance-os/redis'
import {
  buildDashboardNewsIngestRequest,
  NEWS_INGEST_LOCK_KEY,
  NEWS_INGEST_LOCK_TTL_SECONDS,
  startDashboardNewsScheduler,
  triggerDashboardNewsIngest,
} from './news-ingest-scheduler'

describe('buildDashboardNewsIngestRequest', () => {
  it('normalizes the API URL and injects the internal token only when present', () => {
    const request = buildDashboardNewsIngestRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-news-build',
      privateAccessToken: 'secret-token',
    })

    expect(request.url).toBe('http://api.internal.local/dashboard/news/ingest')
    expect(request.init.method).toBe('POST')
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled' }))
    expect((request.init.headers as Record<string, string>)['x-request-id']).toBe('req-news-build')
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe(
      'secret-token'
    )
  })
})

describe('triggerDashboardNewsIngest', () => {
  afterEach(() => {
    setSystemTime()
  })

  it('skips when another ingest run already owns the lock and leaves that lock intact', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(NEWS_INGEST_LOCK_KEY, 'foreign-token', { NX: true, EX: 60 })
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDashboardNewsIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      },
      requestId: 'req-news-skip',
    })

    expect(result).toEqual({ status: 'skipped', requestId: 'req-news-skip' })
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker news ingest skipped because another run is active')
    expect(await redis.client.get(NEWS_INGEST_LOCK_KEY)).toBe('foreign-token')
  })

  it('posts to the dashboard ingest route with the lease signal and releases the lock on success', async () => {
    const redis = createInMemoryRedisClient()
    const events: Array<Record<string, unknown>> = []
    const requests: Array<{
      url: string
      headers: Record<string, string>
      signalAborted: boolean | null
      lockHeldDuringRequest: boolean
    }> = []

    const result = await triggerDashboardNewsIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local/',
      privateAccessToken: 'internal-token',
      log: event => {
        events.push(event)
      },
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          headers: (init?.headers as Record<string, string>) ?? {},
          signalAborted: init?.signal instanceof AbortSignal ? init.signal.aborted : null,
          lockHeldDuringRequest: (await redis.client.get(NEWS_INGEST_LOCK_KEY)) !== null,
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      requestId: 'req-news-success',
    })

    expect(result).toEqual({
      status: 'triggered',
      requestId: 'req-news-success',
    })
    expect(requests).toEqual([
      {
        url: 'http://api.internal.local/dashboard/news/ingest',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': 'internal-token',
          'x-request-id': 'req-news-success',
        },
        signalAborted: false,
        lockHeldDuringRequest: true,
      },
    ])
    expect(await redis.client.get(NEWS_INGEST_LOCK_KEY)).toBeNull()
    expect(events.at(-1)?.msg).toBe('worker news ingest triggered')
  })

  it('releases the lock when the trigger fails', async () => {
    const redis = createInMemoryRedisClient()

    const result = await triggerDashboardNewsIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: () => {},
      fetchImpl: async () => new Response('boom', { status: 500 }),
      requestId: 'req-news-fail',
    })

    expect(result.status).toBe('failed')
    expect(await redis.client.get(NEWS_INGEST_LOCK_KEY)).toBeNull()
  })

  it('does not release a successor lock when its own lease expired mid-run', async () => {
    const start = new Date('2026-09-25T10:00:00.000Z')
    setSystemTime(start)
    const redis = createInMemoryRedisClient()
    const events: Array<Record<string, unknown>> = []

    const result = await triggerDashboardNewsIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () => {
        // The lease expires while the HTTP call is still pending and a successor takes over.
        setSystemTime(new Date(start.getTime() + (NEWS_INGEST_LOCK_TTL_SECONDS + 1) * 1000))
        expect(
          await redis.client.set(NEWS_INGEST_LOCK_KEY, 'successor-token', { NX: true, EX: 60 })
        ).toBe('OK')
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      requestId: 'req-news-expired',
    })

    expect(result).toEqual({ status: 'triggered', requestId: 'req-news-expired' })
    expect(await redis.client.get(NEWS_INGEST_LOCK_KEY)).toBe('successor-token')
    expect(
      events.some(
        event => event.level === 'warn' && String(event.msg).includes('lock release skipped')
      )
    ).toBe(true)
  })
})

describe('startDashboardNewsScheduler', () => {
  it('returns null with an explicit reason when auto-ingest is disabled', () => {
    const events: Array<Record<string, unknown>> = []

    const timer = startDashboardNewsScheduler({
      externalIntegrationsSafeMode: false,
      autoIngestEnabled: false,
      intervalMs: 1000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
    })

    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('NEWS_AUTO_INGEST_ENABLED=false')
  })

  it('starts the interval when the feature is enabled', () => {
    const events: Array<Record<string, unknown>> = []
    const intervals: number[] = []

    const timer = startDashboardNewsScheduler({
      externalIntegrationsSafeMode: false,
      autoIngestEnabled: true,
      intervalMs: 900000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
      setIntervalFn: ((handler: TimerHandler, timeout?: number) => {
        void handler
        intervals.push(timeout ?? 0)
        return 123 as unknown as ReturnType<typeof setInterval>
      }) as typeof setInterval,
    })

    expect(timer).toBe(123)
    expect(intervals).toEqual([900000])
    expect(events.at(-1)?.msg).toBe('worker news scheduler started')
  })
})
