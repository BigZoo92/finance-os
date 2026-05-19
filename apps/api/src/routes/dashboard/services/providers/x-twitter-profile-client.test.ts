import { describe, expect, it, mock } from 'bun:test'
import {
  __testing,
  createXTwitterProfileClient,
  type XTwitterFetch,
} from './x-twitter-profile-client'

const fixedProfile = {
  data: {
    id: '12345',
    username: 'unusual_whales',
    name: 'unusual_whales',
    description: 'unusual options flow',
    profile_image_url: 'https://x.com/avatar.jpg',
    profile_banner_url: 'https://x.com/banner.jpg',
    verified: true,
    verified_type: 'business',
    protected: false,
    public_metrics: {
      followers_count: 1500000,
      following_count: 200,
      tweet_count: 150000,
      listed_count: 4000,
    },
    created_at: '2019-04-01T00:00:00.000Z',
  },
}

const okFetcher: XTwitterFetch = async () => ({ status: 200, body: fixedProfile })

describe('cleanHandle', () => {
  it('strips a leading @ and lowercases', () => {
    expect(__testing.cleanHandle('@UnUsual_Whales')).toBe('unusual_whales')
  })
})

describe('normalizeXHandle', () => {
  const { normalizeXHandle } = __testing

  it('strips a leading @ and lowercases', () => {
    const r = normalizeXHandle('@ElonMusk')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('strips a doubled @@ prefix (prod-regression case: "@@tom_doerr")', () => {
    const r = normalizeXHandle('@@tom_doerr')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('tom_doerr')
  })

  it('strips three or more leading @ prefixes defensively', () => {
    const r = normalizeXHandle('@@@elonmusk')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('accepts a bare handle without @', () => {
    const r = normalizeXHandle('unusual_whales')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('unusual_whales')
  })

  it('trims surrounding whitespace', () => {
    const r = normalizeXHandle('  unusual_whales  ')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('unusual_whales')
  })

  it('extracts handle from https://x.com/<handle>', () => {
    const r = normalizeXHandle('https://x.com/elonmusk')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('extracts handle from https://twitter.com/<handle>', () => {
    const r = normalizeXHandle('https://twitter.com/elonmusk')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('extracts handle from URL with query params', () => {
    const r = normalizeXHandle('https://x.com/elonmusk?lang=fr&utm=share')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('extracts handle from URL with trailing slash', () => {
    const r = normalizeXHandle('https://x.com/elonmusk/')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('accepts www.x.com and mobile.twitter.com', () => {
    const a = normalizeXHandle('https://www.x.com/foo')
    const b = normalizeXHandle('https://mobile.twitter.com/foo')
    expect(a.ok && a.handle).toBe('foo')
    expect(b.ok && b.handle).toBe('foo')
  })

  it('extracts handle even when URL has a /status/ suffix (takes the first path segment)', () => {
    const r = normalizeXHandle('https://x.com/elonmusk/status/1234567890')
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.handle).toBe('elonmusk')
  })

  it('rejects URLs from unsupported hosts', () => {
    const r = normalizeXHandle('https://bsky.app/profile/elonmusk')
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.code).toBe('INVALID_HANDLE')
  })

  it('rejects URLs pointing to /i/, /home, /explore', () => {
    expect(normalizeXHandle('https://x.com/i/web/status/1').ok).toBe(false)
    expect(normalizeXHandle('https://x.com/home').ok).toBe(false)
    expect(normalizeXHandle('https://x.com/explore').ok).toBe(false)
  })

  it('rejects empty input', () => {
    expect(normalizeXHandle('').ok).toBe(false)
    expect(normalizeXHandle('   ').ok).toBe(false)
  })

  it('rejects handles with spaces', () => {
    expect(normalizeXHandle('@elon musk').ok).toBe(false)
  })

  it('rejects handles longer than 15 chars', () => {
    expect(normalizeXHandle('a'.repeat(16)).ok).toBe(false)
  })

  it('rejects handles with invalid characters', () => {
    expect(normalizeXHandle('élon').ok).toBe(false)
    expect(normalizeXHandle('elon-musk').ok).toBe(false)
    expect(normalizeXHandle('elon.musk').ok).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(normalizeXHandle(null).ok).toBe(false)
    expect(normalizeXHandle(undefined).ok).toBe(false)
    expect(normalizeXHandle(42).ok).toBe(false)
  })
})

describe('createXTwitterProfileClient.lookupHandle', () => {
  it('returns a fully-populated profile + cost on 200', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: okFetcher,
    })
    const outcome = await client.lookupHandle('@unusual_whales')
    expect(outcome.ok).toBe(true)
    if (!outcome.ok) throw new Error('expected ok')
    expect(outcome.profile.id).toBe('12345')
    expect(outcome.profile.username).toBe('unusual_whales')
    expect(outcome.profile.profileImageUrl).toBe('https://x.com/avatar.jpg')
    expect(outcome.profile.verified).toBe(true)
    expect(outcome.profile.verifiedType).toBe('business')
    expect(outcome.profile.publicMetrics.followersCount).toBe(1500000)
    expect(outcome.userReads).toBe(1)
    expect(outcome.estimatedCostUsd).toBe(0.01)
  })

  it('returns TOKEN_MISSING without spending budget when no bearer token', async () => {
    const fetcher = mock<XTwitterFetch>(async () => ({ status: 200, body: fixedProfile }))
    const client = createXTwitterProfileClient({ bearerToken: '', fetcher })
    const outcome = await client.lookupHandle('test')
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('TOKEN_MISSING')
    expect(outcome.userReads).toBe(0)
    expect(outcome.estimatedCostUsd).toBe(0)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('rejects malformed handles before spending budget', async () => {
    const fetcher = mock<XTwitterFetch>(async () => ({ status: 200, body: fixedProfile }))
    const client = createXTwitterProfileClient({ bearerToken: 'tok', fetcher })
    const outcome = await client.lookupHandle('invalid handle with spaces')
    expect(outcome.ok).toBe(false)
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('INVALID_HANDLE')
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('maps 401 to TOKEN_INVALID', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 401, body: { error: 'bad token' } }),
    })
    const outcome = await client.lookupHandle('test')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('TOKEN_INVALID')
    expect(outcome.statusCode).toBe(401)
  })

  it('maps 402 to PAYMENT_REQUIRED and still counts the user read', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 402, body: {} }),
    })
    const outcome = await client.lookupHandle('test')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('PAYMENT_REQUIRED')
    expect(outcome.userReads).toBe(1)
    expect(outcome.estimatedCostUsd).toBe(0.01)
  })

  it('maps 429 to RATE_LIMITED', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 429, body: {} }),
    })
    const outcome = await client.lookupHandle('test')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('RATE_LIMITED')
  })

  it('maps 404 to NOT_FOUND with zero cost (no resource returned)', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 404, body: {} }),
    })
    const outcome = await client.lookupHandle('does_not_exist')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('NOT_FOUND')
    expect(outcome.userReads).toBe(0)
    expect(outcome.estimatedCostUsd).toBe(0)
  })

  it('maps 5xx to PROVIDER_UNAVAILABLE', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 502, body: {} }),
    })
    const outcome = await client.lookupHandle('test')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('PROVIDER_UNAVAILABLE')
  })

  it('maps network errors to NETWORK_ERROR without cost', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => {
        throw new Error('ECONNRESET')
      },
    })
    const outcome = await client.lookupHandle('test')
    if (outcome.ok) throw new Error('unreachable')
    expect(outcome.code).toBe('NETWORK_ERROR')
    expect(outcome.estimatedCostUsd).toBe(0)
  })
})

describe('createXTwitterProfileClient.lookupHandlesBatch', () => {
  const profileFor = (id: string, username: string, name: string) => ({
    id,
    username,
    name,
    description: `${name}'s bio`,
    profile_image_url: `https://x.com/${username}/avatar.jpg`,
    profile_banner_url: null,
    verified: false,
    verified_type: null,
    protected: false,
    public_metrics: {
      followers_count: 1000,
      following_count: 100,
      tweet_count: 500,
      listed_count: 5,
    },
    created_at: '2020-01-01T00:00:00Z',
  })

  it('hits the batch endpoint once for multiple handles and emits one item per requester', async () => {
    let calls = 0
    let capturedUrl = ''
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async ({ url }) => {
        calls += 1
        capturedUrl = url
        return {
          status: 200,
          body: {
            data: [
              profileFor('1', 'alice', 'Alice'),
              profileFor('2', 'bob', 'Bob'),
              profileFor('3', 'carol', 'Carol'),
            ],
          },
        }
      },
    })
    const outcome = await client.lookupHandlesBatch(['@Alice', 'bob', 'https://x.com/carol'])
    expect(calls).toBe(1)
    expect(capturedUrl).toContain('/users/by?usernames=alice,bob,carol')
    expect(outcome.items).toHaveLength(3)
    const alice = outcome.items.find(i => i.handle === '@Alice')
    expect(alice?.ok).toBe(true)
    if (alice?.ok) {
      expect(alice.canonicalHandle).toBe('alice')
      expect(alice.profile.id).toBe('1')
    }
    expect(outcome.userReads).toBe(3)
    expect(outcome.estimatedCostUsd).toBeCloseTo(0.03, 5)
    expect(outcome.providerError).toBeNull()
  })

  it('rejects invalid handles client-side without spending budget', async () => {
    let calls = 0
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => {
        calls += 1
        return { status: 200, body: { data: [profileFor('1', 'alice', 'Alice')] } }
      },
    })
    const outcome = await client.lookupHandlesBatch(['@alice', 'invalid handle', ''])
    expect(calls).toBe(1) // only the valid one was sent
    const invalidItems = outcome.items.filter(i => !i.ok && i.code === 'INVALID_HANDLE')
    expect(invalidItems).toHaveLength(2)
    expect(outcome.userReads).toBe(1)
  })

  it('returns NOT_FOUND for handles that the X errors[] array reports unknown', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({
        status: 200,
        body: {
          data: [profileFor('1', 'alice', 'Alice')],
          errors: [{ value: 'bob', detail: 'User has been suspended', title: 'Forbidden' }],
        },
      }),
    })
    const outcome = await client.lookupHandlesBatch(['alice', 'bob'])
    const bob = outcome.items.find(i => i.handle === 'bob')
    expect(bob?.ok).toBe(false)
    if (bob && !bob.ok) expect(bob.code).toBe('NOT_FOUND')
    expect(outcome.userReads).toBe(1) // only alice billed
  })

  it('maps 401 to TOKEN_INVALID batch-wide without billing user reads', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 401, body: {} }),
    })
    const outcome = await client.lookupHandlesBatch(['alice', 'bob'])
    expect(outcome.providerError?.code).toBe('TOKEN_INVALID')
    expect(outcome.userReads).toBe(0)
    for (const item of outcome.items) {
      expect(item.ok).toBe(false)
      if (!item.ok) expect(item.code).toBe('TOKEN_INVALID')
    }
  })

  it('returns TOKEN_MISSING immediately when no bearer is configured', async () => {
    let calls = 0
    const client = createXTwitterProfileClient({
      bearerToken: '',
      fetcher: async () => {
        calls += 1
        return { status: 200, body: {} }
      },
    })
    const outcome = await client.lookupHandlesBatch(['alice'])
    expect(calls).toBe(0)
    expect(outcome.providerError?.code).toBe('TOKEN_MISSING')
    expect(outcome.userReads).toBe(0)
  })

  it('surfaces rate-limit headers when the fetcher returns them', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({
        status: 200,
        body: { data: [profileFor('1', 'alice', 'Alice')] },
        rateLimit: { limit: 300, remaining: 142, resetAt: 1717000000 },
      }),
    })
    const outcome = await client.lookupHandlesBatch(['alice'])
    expect(outcome.rateLimit?.remaining).toBe(142)
    expect(outcome.rateLimit?.limit).toBe(300)
  })

  it('throws synchronously when caller passes more than 100 usernames', async () => {
    const client = createXTwitterProfileClient({
      bearerToken: 'tok',
      fetcher: async () => ({ status: 200, body: { data: [] } }),
    })
    const tooMany = Array.from({ length: 101 }, (_, i) => `user${i}`)
    await expect(client.lookupHandlesBatch(tooMany)).rejects.toThrow(/100 usernames per call/)
  })
})
