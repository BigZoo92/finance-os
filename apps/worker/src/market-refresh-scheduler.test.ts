import { describe, expect, it } from 'bun:test'
import {
  buildDashboardMarketsRefreshRequest,
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
    expect((request.init.headers as Record<string, string>)['x-request-id']).toBe('req-markets-build')
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe('secret-token')
  })
})

describe('triggerDashboardMarketsRefresh', () => {
  it('skips when another refresh run already owns the lock', async () => {
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDashboardMarketsRefresh({
      redisClient: {
        set: async () => null,
        del: async () => 0,
      },
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

    expect(result.status).toBe('skipped')
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker market refresh skipped because another run is active')
  })

  it('posts to the dashboard refresh route and releases the lock on success', async () => {
    const events: Array<Record<string, unknown>> = []
    const deletedKeys: string[] = []
    const requests: Array<{ url: string; headers: Record<string, string> }> = []

    const result = await triggerDashboardMarketsRefresh({
      redisClient: {
        set: async () => 'OK',
        del: async key => {
          deletedKeys.push(key)
          return 1
        },
      },
      apiInternalUrl: 'http://api.internal.local/',
      privateAccessToken: 'internal-token',
      log: event => {
        events.push(event)
      },
      fetchImpl: async (url, init) => {
        requests.push({
          url: String(url),
          headers: (init?.headers as Record<string, string>) ?? {},
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
      },
    ])
    expect(deletedKeys).toEqual(['markets:dashboard:refresh:lock'])
    expect(events.at(-1)?.msg).toBe('worker market refresh triggered')
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
