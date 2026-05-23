import { describe, expect, it } from 'bun:test'
import {
  buildSocialSignalIngestRequest,
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

  it('logs validation details when the API rejects the trigger contract', async () => {
    const logs: Array<Record<string, unknown>> = []
    const redisClient = {
      set: async () => 'OK',
      del: async () => 1,
    }

    const result = await triggerSocialSignalIngest({
      redisClient,
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
  })
})
