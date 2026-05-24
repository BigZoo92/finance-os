import { describe, expect, it } from 'bun:test'
import { __testing, createXTwitterHttpTimelineFetcher } from './x-twitter-http-fetcher'

const makeFetcher = (
  responses: Array<Response | Error>
): typeof fetch & { calls: Array<{ url: string; headers: Headers }> } => {
  let i = 0
  const calls: Array<{ url: string; headers: Headers }> = []
  const fn = (async (input: unknown, init?: { headers?: unknown }) => {
    const url = typeof input === 'string' ? input : (input as { url: string }).url
    const rawHeaders = init?.headers as ConstructorParameters<typeof Headers>[0]
    const headers = new Headers(rawHeaders)
    calls.push({ url, headers })
    const next = responses[i++]
    if (next instanceof Error) throw next
    if (!next) throw new Error('no response in stub')
    return next
  }) as unknown as typeof fetch & { calls: Array<{ url: string; headers: Headers }> }
  fn.calls = calls
  return fn
}

const jsonResponse = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

describe('mapErrorCode', () => {
  it('maps X error statuses to typed codes', () => {
    expect(__testing.mapErrorCode(401)).toBe('TOKEN_INVALID')
    expect(__testing.mapErrorCode(402)).toBe('PAYMENT_REQUIRED')
    expect(__testing.mapErrorCode(403)).toBe('FORBIDDEN')
    expect(__testing.mapErrorCode(429)).toBe('RATE_LIMITED')
    expect(__testing.mapErrorCode(503)).toBe('PROVIDER_UNAVAILABLE')
  })
})

describe('createXTwitterHttpTimelineFetcher', () => {
  it('builds a properly scoped request and parses tweets on 200', async () => {
    const fetchStub = makeFetcher([
      jsonResponse(200, {
        data: [
          {
            id: '111',
            text: 'hello $SPY',
            author_id: 'A1',
            created_at: '2026-05-11T12:00:00Z',
            lang: 'en',
            public_metrics: { like_count: 100, retweet_count: 5 },
          },
        ],
        meta: { next_token: 'NEXT', result_count: 1 },
      }),
    ])
    const fetcher = createXTwitterHttpTimelineFetcher({
      bearerToken: 'tok-redacted',
      fetch: fetchStub,
    })
    const page = await fetcher({
      userId: 'A1',
      startTime: '2026-05-10T22:00:00.000Z',
      endTime: '2026-05-11T22:00:00.000Z',
      paginationToken: null,
      maxResults: 5,
    })
    expect(page.statusCode).toBe(200)
    expect(page.errorCode).toBeNull()
    expect(page.tweets).toHaveLength(1)
    expect(page.tweets[0]?.id).toBe('111')
    expect(page.meta.nextToken).toBe('NEXT')

    const call = fetchStub.calls[0]
    expect(call).toBeDefined()
    if (!call) throw new Error('Expected at least one fetch call')
    expect(call.url).toContain('/2/users/A1/tweets')
    expect(call.url).toContain('start_time=2026-05-10T22')
    expect(call.url).toContain('max_results=5')
    expect(call.url).toContain('exclude=retweets')
    expect(call.headers.get('authorization')).toBe('Bearer tok-redacted')
  })

  it('forwards pagination_token on subsequent calls', async () => {
    const fetchStub = makeFetcher([
      jsonResponse(200, { data: [], meta: { next_token: null } }),
    ])
    const fetcher = createXTwitterHttpTimelineFetcher({ bearerToken: 'tok', fetch: fetchStub })
    await fetcher({
      userId: 'A2',
      startTime: '2026-05-10T22:00:00.000Z',
      endTime: '2026-05-11T22:00:00.000Z',
      paginationToken: 'PAGE2',
      maxResults: 10,
    })
    expect(fetchStub.calls[0]?.url).toContain('pagination_token=PAGE2')
  })

  it('maps 402 to PAYMENT_REQUIRED and emits a usage event with zero post reads', async () => {
    const usageEvents: unknown[] = []
    const fetchStub = makeFetcher([jsonResponse(402, { detail: 'credits required' })])
    const fetcher = createXTwitterHttpTimelineFetcher({
      bearerToken: 'tok',
      fetch: fetchStub,
      onUsage: async event => {
        usageEvents.push(event)
      },
    })
    const page = await fetcher({
      userId: 'A1',
      startTime: '2026-05-10T22:00:00.000Z',
      endTime: '2026-05-11T22:00:00.000Z',
      paginationToken: null,
      maxResults: 10,
    })
    expect(page.statusCode).toBe(402)
    expect(page.errorCode).toBe('PAYMENT_REQUIRED')
    expect(usageEvents).toHaveLength(1)
    expect(usageEvents[0]).toMatchObject({
      statusCode: 402,
      errorCode: 'PAYMENT_REQUIRED',
      postReads: 0,
    })
  })

  it('treats network failures as NETWORK_ERROR without spending budget', async () => {
    const fetchStub = makeFetcher([new Error('ECONNRESET')])
    const fetcher = createXTwitterHttpTimelineFetcher({ bearerToken: 'tok', fetch: fetchStub })
    const page = await fetcher({
      userId: 'A1',
      startTime: '2026-05-10T22:00:00.000Z',
      endTime: '2026-05-11T22:00:00.000Z',
      paginationToken: null,
      maxResults: 10,
    })
    expect(page.statusCode).toBe(0)
    expect(page.errorCode).toBe('NETWORK_ERROR')
  })

  it('does not leak the bearer token in any returned field', async () => {
    const fetchStub = makeFetcher([jsonResponse(429, { error: 'rate limited' })])
    const fetcher = createXTwitterHttpTimelineFetcher({
      bearerToken: 'super-secret-token',
      fetch: fetchStub,
    })
    const page = await fetcher({
      userId: 'A1',
      startTime: '2026-05-10T22:00:00.000Z',
      endTime: '2026-05-11T22:00:00.000Z',
      paginationToken: null,
      maxResults: 10,
    })
    const serialised = JSON.stringify(page)
    expect(serialised).not.toContain('super-secret-token')
  })
})
