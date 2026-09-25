import { describe, expect, it } from 'bun:test'
import { createInMemoryRedisClient } from '@finance-os/redis'
import {
  buildSocialSignalIngestRequest,
  SOCIAL_SIGNAL_LOCK_KEY,
  triggerSocialSignalIngest,
} from './social-signal-scheduler'

describe('social signal scheduler', () => {
  it('sends the explicit social_poll trigger to the news ingest API', () => {
    const request = buildSocialSignalIngestRequest({
      apiInternalUrl: 'http://api.internal.local/',
      requestId: 'req-social',
      privateAccessToken: 'private-token',
    })

    expect(request.url).toBe('http://api.internal.local/dashboard/news/ingest')
    expect(request.init.headers).toMatchObject({
      'x-request-id': 'req-social',
      'x-internal-token': 'private-token',
    })
    expect(request.init.body).toBe(JSON.stringify({ trigger: 'social_poll' }))
  })

  it('skips when another social run already owns the lock and leaves that lock intact', async () => {
    const redis = createInMemoryRedisClient()
    await redis.client.set(SOCIAL_SIGNAL_LOCK_KEY, 'foreign-token', { NX: true, EX: 60 })
    const logs: Array<Record<string, unknown>> = []
    let fetchCalled = false

    const result = await triggerSocialSignalIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      requestId: 'req-social-skip',
      log: event => logs.push(event),
      fetchImpl: async () => {
        fetchCalled = true
        return new Response(null, { status: 200 })
      },
    })

    expect(result).toEqual({ status: 'skipped', requestId: 'req-social-skip' })
    expect(fetchCalled).toBe(false)
    expect(logs[0]?.msg).toBe('worker social signal ingest skipped because another run is active')
    expect(await redis.client.get(SOCIAL_SIGNAL_LOCK_KEY)).toBe('foreign-token')
  })

  it('passes the lease signal to the request and releases the lock on success', async () => {
    const redis = createInMemoryRedisClient()
    const signals: Array<boolean | null> = []

    const result = await triggerSocialSignalIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      requestId: 'req-social-ok',
      log: () => {},
      fetchImpl: async (_url, init) => {
        signals.push(init?.signal instanceof AbortSignal ? init.signal.aborted : null)
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      },
    })

    expect(result).toEqual({ status: 'triggered', requestId: 'req-social-ok' })
    expect(signals).toEqual([false])
    expect(await redis.client.get(SOCIAL_SIGNAL_LOCK_KEY)).toBeNull()
  })

  it('logs validation details when the API rejects the trigger contract', async () => {
    const logs: Array<Record<string, unknown>> = []
    const redis = createInMemoryRedisClient()

    const result = await triggerSocialSignalIngest({
      redisClient: redis.client,
      apiInternalUrl: 'http://api.internal.local',
      requestId: 'req-social-422',
      log: event => logs.push(event),
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            type: 'validation',
            on: 'body',
            found: { trigger: 'social_poll' },
          }),
          { status: 422 }
        ),
    })

    expect(result.status).toBe('failed')
    expect(logs).toContainEqual(
      expect.objectContaining({
        msg: 'worker social signal ingest http error',
        scheduler: 'social',
        httpStatus: 422,
        validationBody: {
          type: 'validation',
          on: 'body',
          found: { trigger: 'social_poll' },
        },
      })
    )
    expect(await redis.client.get(SOCIAL_SIGNAL_LOCK_KEY)).toBeNull()
  })
})
