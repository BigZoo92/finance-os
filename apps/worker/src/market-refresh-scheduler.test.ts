import { describe, expect, it } from 'bun:test'
import { createInMemoryRedisClient } from '@finance-os/redis'
import {
  buildDashboardMarketsRefreshRequest,
  MARKET_REFRESH_LOCK_KEY,
  startDashboardMarketsScheduler,
  triggerDashboardMarketsRefresh,
} from './market-refresh-scheduler'

describe('buildDashboardMarketsRefreshRequest', () => {
  it('normalizes the API URL and injects the internal token only when present', () => {
    const request = buildDashboardMarketsRefreshRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-markets-build',
      privateAccessToken: 'secret-token',
    })

    expect(request.url).toBe('http://api.internal.local/dashboard/markets/refresh')
    expect(request.init.method).toBe('POST')
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled' }))
    expect((request.init.headers as Record<string, string>)['x-request-id']).toBe(
      'req-markets-build'
    )
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe(
      'secret-token'
    )
  })
})

describe('triggerDashboardMarketsRefresh', () => {
  it('skips when another refresh run already owns the lock and leaves that lock intact', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(MARKET_REFRESH_LOCK_KEY, 'foreign-token', { NX: true, EX: 60 })
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDashboardMarketsRefresh({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      },
      requestId: 'req-markets-skip',
    })

    expect(result).toEqual({ status: 'skipped', requestId: 'req-markets-skip' })
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker market refresh skipped because another run is active')
    expect(await redis.client.get(MARKET_REFRESH_LOCK_KEY)).toBe('foreign-token')
  })

  it('posts to the dashboard refresh route with the lease signal and releases the lock on success', async () => {
    const redis = createInMemoryRedisClient()
    const events: Array<Record<string, unknown>> = []
    const requests: Array<{
      url: string
      headers: Record<string, string>
      signalAborted: boolean | null
    }> = []

    const result = await triggerDashboardMarketsRefresh({
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
        })
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
      requestId: 'req-markets-success',
    })

    expect(result).toEqual({
      status: 'triggered',
      requestId: 'req-markets-success',
    })
    expect(requests).toEqual([
      {
        url: 'http://api.internal.local/dashboard/markets/refresh',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': 'internal-token',
          'x-request-id': 'req-markets-success',
        },
        signalAborted: false,
      },
    ])
    expect(await redis.client.get(MARKET_REFRESH_LOCK_KEY)).toBeNull()
    expect(events.at(-1)?.msg).toBe('worker market refresh triggered')
  })

  it('releases the lock when the trigger fails', async () => {
    const redis = createInMemoryRedisClient()

    const result = await triggerDashboardMarketsRefresh({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      log: () => {},
      fetchImpl: async () => new Response('boom', { status: 500 }),
      requestId: 'req-markets-fail',
    })

    expect(result.status).toBe('failed')
    expect(await redis.client.get(MARKET_REFRESH_LOCK_KEY)).toBeNull()
  })
})

describe('startDashboardMarketsScheduler', () => {
  it('returns null with an explicit reason when auto-refresh is disabled', () => {
    const events: Array<Record<string, unknown>> = []

    const timer = startDashboardMarketsScheduler({
      externalIntegrationsSafeMode: false,
      autoRefreshEnabled: false,
      intervalMs: 1000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
    })

    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('MARKET_DATA_AUTO_REFRESH_ENABLED=false')
  })

  it('starts the interval when the feature is enabled', () => {
    const events: Array<Record<string, unknown>> = []
    const intervals: number[] = []

    const timer = startDashboardMarketsScheduler({
      externalIntegrationsSafeMode: false,
      autoRefreshEnabled: true,
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
    expect(events.at(-1)?.msg).toBe('worker market scheduler started')
  })
})
