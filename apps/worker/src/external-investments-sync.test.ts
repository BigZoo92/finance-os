import { describe, expect, it } from 'bun:test'
import {
  buildExternalInvestmentRequestSyncKey,
  claimExternalInvestmentRequestSync,
} from './external-investments-sync'

const createRedisStub = () => {
  const keys = new Set<string>()
  return {
    async set(key: string) {
      if (keys.has(key)) {
        return null
      }
      keys.add(key)
      return 'OK'
    },
    keys,
  }
}

describe('external investment request sync idempotence', () => {
  it('uses request id and provider connection id in the duplicate key', () => {
    expect(
      buildExternalInvestmentRequestSyncKey({
        requestId: 'req-1',
        providerConnectionId: 'ibkr:flex',
      })
    ).toBe('external-sync:req-1:ibkr:flex')
  })

  it('allows only one sync claim for the same request and provider connection', async () => {
    const redis = createRedisStub()

    await expect(
      claimExternalInvestmentRequestSync({
        redisClient: redis,
        requestId: 'req-1',
        providerConnectionId: 'ibkr:flex',
      })
    ).resolves.toBe(true)
    await expect(
      claimExternalInvestmentRequestSync({
        redisClient: redis,
        requestId: 'req-1',
        providerConnectionId: 'ibkr:flex',
      })
    ).resolves.toBe(false)
  })

  it('allows different providers or request ids to sync independently', async () => {
    const redis = createRedisStub()

    await expect(
      claimExternalInvestmentRequestSync({
        redisClient: redis,
        requestId: 'req-1',
        providerConnectionId: 'ibkr:flex',
      })
    ).resolves.toBe(true)
    await expect(
      claimExternalInvestmentRequestSync({
        redisClient: redis,
        requestId: 'req-1',
        providerConnectionId: 'binance:spot',
      })
    ).resolves.toBe(true)
    await expect(
      claimExternalInvestmentRequestSync({
        redisClient: redis,
        requestId: 'req-2',
        providerConnectionId: 'ibkr:flex',
      })
    ).resolves.toBe(true)
  })
})
