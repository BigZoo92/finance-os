import { describe, expect, it } from 'bun:test'
import {
  buildAttentionRebuildRequest,
  startAttentionRebuildScheduler,
  triggerAttentionRebuild,
} from './attention-rebuild-scheduler'

describe('buildAttentionRebuildRequest', () => {
  it('targets /dashboard/trading-lab/attention/rebuild and forwards the internal token', () => {
    const request = buildAttentionRebuildRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-attn-build',
      privateAccessToken: 'secret-token',
    })

    expect(request.url).toBe(
      'http://api.internal.local/dashboard/trading-lab/attention/rebuild'
    )
    expect(request.init.method).toBe('POST')
    expect((request.init.headers as Record<string, string>)['x-request-id']).toBe('req-attn-build')
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBe('secret-token')
  })

  it('omits internal token when not provided', () => {
    const request = buildAttentionRebuildRequest({
      apiInternalUrl: 'http://api.internal.local',
      requestId: 'req-attn-build-no-token',
    })
    expect((request.init.headers as Record<string, string>)['x-internal-token']).toBeUndefined()
  })
})

describe('triggerAttentionRebuild', () => {
  it('skips when another rebuild already owns the lock', async () => {
    const events: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerAttentionRebuild({
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
      requestId: 'req-attn-skip',
    })

    expect(result.status).toBe('skipped')
    expect(fetchCalled).toBe(false)
    expect(events[0]?.msg).toBe('worker attention rebuild skipped because another run is active')
  })

  it('triggers on lock acquisition and releases lock', async () => {
    const events: Array<Record<string, unknown>> = []
    let releaseCount = 0

    const result = await triggerAttentionRebuild({
      redisClient: {
        set: async () => 'OK',
        del: async () => {
          releaseCount += 1
          return 1
        },
      },
      apiInternalUrl: 'http://api.internal.local',
      log: event => {
        events.push(event)
      },
      fetchImpl: async () =>
        new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      requestId: 'req-attn-ok',
    })

    expect(result.status).toBe('triggered')
    expect(releaseCount).toBe(1)
    expect(events.find(e => e.msg === 'worker attention rebuild triggered')).toBeDefined()
  })

  it('marks failed on non-2xx response', async () => {
    const result = await triggerAttentionRebuild({
      redisClient: {
        set: async () => 'OK',
        del: async () => 1,
      },
      apiInternalUrl: 'http://api.internal.local',
      log: () => {},
      fetchImpl: async () => new Response('boom', { status: 500 }),
      requestId: 'req-attn-fail',
    })

    expect(result.status).toBe('failed')
  })
})

describe('startAttentionRebuildScheduler', () => {
  it('returns null when ATTENTION_SYSTEM_ENABLED=false', () => {
    const events: Array<Record<string, unknown>> = []
    const timer = startAttentionRebuildScheduler({
      externalIntegrationsSafeMode: false,
      attentionSystemEnabled: false,
      autoRebuildEnabled: true,
      intervalMs: 1000,
      trigger: async () => {},
      log: e => events.push(e),
      setIntervalFn: (() => {
        throw new Error('should not be called')
      }) as typeof setInterval,
    })
    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('ATTENTION_SYSTEM_ENABLED=false')
  })

  it('returns null when ATTENTION_REBUILD_AUTO_ENABLED=false', () => {
    const events: Array<Record<string, unknown>> = []
    const timer = startAttentionRebuildScheduler({
      externalIntegrationsSafeMode: false,
      attentionSystemEnabled: true,
      autoRebuildEnabled: false,
      intervalMs: 1000,
      trigger: async () => {},
      log: e => events.push(e),
      setIntervalFn: (() => {
        throw new Error('should not be called')
      }) as typeof setInterval,
    })
    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('ATTENTION_REBUILD_AUTO_ENABLED=false')
  })

  it('returns null and logs when EXTERNAL_INTEGRATIONS_SAFE_MODE=true', () => {
    const events: Array<Record<string, unknown>> = []
    const timer = startAttentionRebuildScheduler({
      externalIntegrationsSafeMode: true,
      attentionSystemEnabled: true,
      autoRebuildEnabled: true,
      intervalMs: 1000,
      trigger: async () => {},
      log: e => events.push(e),
      setIntervalFn: (() => {
        throw new Error('should not be called')
      }) as typeof setInterval,
    })
    expect(timer).toBeNull()
    expect(events[0]?.reason).toBe('EXTERNAL_INTEGRATIONS_SAFE_MODE=true')
  })

  it('starts the timer when all gates pass', () => {
    let scheduled = false
    const timer = startAttentionRebuildScheduler({
      externalIntegrationsSafeMode: false,
      attentionSystemEnabled: true,
      autoRebuildEnabled: true,
      intervalMs: 1000,
      trigger: async () => {},
      log: () => {},
      setIntervalFn: ((fn: () => void, ms: number) => {
        expect(typeof fn).toBe('function')
        expect(ms).toBe(1000)
        scheduled = true
        return 'fake-timer' as unknown as ReturnType<typeof setInterval>
      }) as typeof setInterval,
    })
    expect(scheduled).toBe(true)
    expect(timer).toBe('fake-timer' as unknown as ReturnType<typeof setInterval>)
  })
})
