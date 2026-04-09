import { describe, expect, it } from 'bun:test'
import {
  buildDashboardNewsIngestRequest,
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
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe('secret-token')
  })
})

describe('triggerDashboardNewsIngest', () => {
  it('skips when another ingest run already owns the lock', async () => {
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDashboardNewsIngest({
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
      requestId: 'req-news-skip',
    })

    expect(result.status).toBe('skipped')
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker news ingest skipped because another run is active')
  })

  it('posts to the dashboard ingest route and releases the lock on success', async () => {
    const events: Array<Record<string, unknown>> = []
    const deletedKeys: string[] = []
    const requests: Array<{ url: string; headers: Record<string, string> }> = []

    const result = await triggerDashboardNewsIngest({
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
      },
    ])
    expect(deletedKeys).toEqual(['news:dashboard:ingest:lock'])
    expect(events.at(-1)?.msg).toBe('worker news ingest triggered')
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
