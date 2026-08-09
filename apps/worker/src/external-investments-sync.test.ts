import { describe, expect, it } from 'bun:test'
import {
  buildExternalInvestmentRequestSyncKey,
  claimExternalInvestmentRequestSync,
  resolveExternalInvestmentWorkerServerConfig,
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

describe('external investment worker environment configuration', () => {
  const baseEnv = {
    IBKR_FLEX_QUERY_IDS: [] as string[],
    IBKR_FLEX_BASE_URL: 'https://ndcdyn.interactivebrokers.com',
    IBKR_FLEX_USER_AGENT: 'Finance-OS External Investments/1.0',
    BINANCE_SPOT_BASE_URL: 'https://api.binance.com',
  }

  it('uses IBKR Flex environment credentials without requiring Binance', () => {
    const config = resolveExternalInvestmentWorkerServerConfig({
      ...baseEnv,
      IBKR_FLEX_TOKEN: 'flex-token',
      IBKR_FLEX_QUERY_IDS: ['daily-query'],
    })

    expect(config.configured).toEqual({ ibkr: true, binance: false })
    expect(config.credentials.ibkr).toMatchObject({
      flexToken: 'flex-token',
      queryIds: ['daily-query'],
    })
  })

  it('uses Binance environment credentials without requiring IBKR', () => {
    const config = resolveExternalInvestmentWorkerServerConfig({
      ...baseEnv,
      BINANCE_SPOT_API_KEY: 'api-key',
      BINANCE_SPOT_API_SECRET: 'api-secret',
    })

    expect(config.configured).toEqual({ ibkr: false, binance: true })
    expect(config.credentials.binance).toMatchObject({
      apiKey: 'api-key',
      apiSecret: 'api-secret',
    })
  })
})
