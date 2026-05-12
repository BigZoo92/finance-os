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
