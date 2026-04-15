import { describe, expect, it } from 'bun:test'
import {
  buildDashboardAdvisorDailyRequest,
  startDashboardAdvisorScheduler,
  triggerDashboardAdvisorDailyRun,
} from './advisor-daily-scheduler'

describe('buildDashboardAdvisorDailyRequest', () => {
  it('normalizes the API URL and injects the internal token only when present', () => {
    const request = buildDashboardAdvisorDailyRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-advisor-build',
      privateAccessToken: 'secret-token',
    })

    expect(request.url).toBe('http://api.internal.local/dashboard/advisor/run-daily')
    expect(request.init.method).toBe('POST')
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'scheduled' }))
    expect((request.init.headers as Record<string, string>)['x-request-id']).toBe('req-advisor-build')
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe(
      'secret-token'
    )
  })
})

describe('triggerDashboardAdvisorDailyRun', () => {
  it('skips when another advisor run already owns the lock', async () => {
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerDashboardAdvisorDailyRun({
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
      requestId: 'req-advisor-skip',
    })

    expect(result.status).toBe('skipped')
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker advisor daily run skipped because another run is active')
  })

  it('posts to the dashboard advisor route and releases the lock on success', async () => {
    const events: Array<Record<string, unknown>> = []
    const deletedKeys: string[] = []
    const requests: Array<{ url: string; headers: Record<string, string> }> = []

    const result = await triggerDashboardAdvisorDailyRun({
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
      requestId: 'req-advisor-success',
    })

    expect(result).toEqual({
      status: 'triggered',
      requestId: 'req-advisor-success',
    })
    expect(requests).toEqual([
      {
        url: 'http://api.internal.local/dashboard/advisor/run-daily',
        headers: {
          'content-type': 'application/json',
          'x-internal-token': 'internal-token',
          'x-request-id': 'req-advisor-success',
        },
      },
    ])
    expect(deletedKeys).toEqual(['advisor:dashboard:daily:lock'])
    expect(events.at(-1)?.msg).toBe('worker advisor daily run triggered')
  })
})

describe('startDashboardAdvisorScheduler', () => {
  it('returns null with an explicit reason when the feature is disabled', () => {
    const events: Array<Record<string, unknown>> = []

    const timer = startDashboardAdvisorScheduler({
      externalIntegrationsSafeMode: false,
      advisorEnabled: false,
      autoRunEnabled: true,
      intervalMs: 1000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
    })

    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('AI_ADVISOR_ENABLED=false')
  })

  it('returns null with an explicit reason when auto-run is disabled', () => {
    const events: Array<Record<string, unknown>> = []

    const timer = startDashboardAdvisorScheduler({
      externalIntegrationsSafeMode: false,
      advisorEnabled: true,
      autoRunEnabled: false,
      intervalMs: 1000,
      trigger: async () => undefined,
      log: event => {
        events.push(event)
      },
    })

    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('AI_DAILY_AUTO_RUN_ENABLED=false')
  })

  it('starts the interval when the feature is enabled', () => {
    const events: Array<Record<string, unknown>> = []
    const intervals: number[] = []

    const timer = startDashboardAdvisorScheduler({
      externalIntegrationsSafeMode: false,
      advisorEnabled: true,
      autoRunEnabled: true,
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
    expect(events.at(-1)?.msg).toBe('worker advisor scheduler started')
  })
})
