import { describe, expect, it } from 'bun:test'
import { resolveExternalInvestmentServerConfig } from './server-config'

const input = (
  overrides: {
    ibkrToken?: string
    ibkrQueryIds?: string[]
    binanceApiKey?: string
    binanceApiSecret?: string
  } = {}
) => ({
  ibkr: {
    ...(overrides.ibkrToken ? { flexToken: overrides.ibkrToken } : {}),
    queryIds: overrides.ibkrQueryIds ?? [],
    baseUrl: 'https://ndcdyn.interactivebrokers.com',
    userAgent: 'Finance-OS External Investments/1.0',
  },
  binance: {
    ...(overrides.binanceApiKey ? { apiKey: overrides.binanceApiKey } : {}),
    ...(overrides.binanceApiSecret ? { apiSecret: overrides.binanceApiSecret } : {}),
    baseUrl: 'https://api.binance.com',
  },
})

describe('resolveExternalInvestmentServerConfig', () => {
  it('marks IBKR configured only when token and at least one query id are present', () => {
    const configured = resolveExternalInvestmentServerConfig(
      input({ ibkrToken: 'flex-token', ibkrQueryIds: ['daily', 'monthly'] })
    )
    const missingQuery = resolveExternalInvestmentServerConfig(input({ ibkrToken: 'flex-token' }))

    expect(configured.configured.ibkr).toBe(true)
    expect(configured.credentials.ibkr).toMatchObject({
      provider: 'ibkr',
      queryIds: ['daily', 'monthly'],
    })
    expect(missingQuery.configured.ibkr).toBe(false)
    expect(missingQuery.credentials.ibkr).toBeNull()
  })

  it('marks Binance configured only when both key and secret are present', () => {
    const configured = resolveExternalInvestmentServerConfig(
      input({ binanceApiKey: 'api-key', binanceApiSecret: 'api-secret' })
    )
    const missingSecret = resolveExternalInvestmentServerConfig(input({ binanceApiKey: 'api-key' }))

    expect(configured.configured.binance).toBe(true)
    expect(configured.credentials.binance).toMatchObject({ provider: 'binance', apiKey: 'api-key' })
    expect(missingSecret.configured.binance).toBe(false)
    expect(missingSecret.credentials.binance).toBeNull()
  })

  it('keeps provider configuration isolated when only one provider is configured', () => {
    const ibkrOnly = resolveExternalInvestmentServerConfig(
      input({ ibkrToken: 'flex-token', ibkrQueryIds: ['daily'] })
    )
    const binanceOnly = resolveExternalInvestmentServerConfig(
      input({ binanceApiKey: 'api-key', binanceApiSecret: 'api-secret' })
    )

    expect(ibkrOnly.configured).toEqual({ ibkr: true, binance: false })
    expect(binanceOnly.configured).toEqual({ ibkr: false, binance: true })
  })
})
