import { describe, expect, it } from 'bun:test'
import { createExternalInvestmentsRoutes } from './router'
import type { ExternalInvestmentsRoutesDependencies } from './types'

const createRoutes = () =>
  createExternalInvestmentsRoutes({
    db: {} as ExternalInvestmentsRoutesDependencies['db'],
    redisClient: {} as ExternalInvestmentsRoutesDependencies['redisClient'],
    env: {
      EXTERNAL_INVESTMENTS_ENABLED: true,
      EXTERNAL_INTEGRATIONS_SAFE_MODE: false,
      EXTERNAL_INVESTMENTS_SAFE_MODE: false,
      EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES: 1440,
      IBKR_FLEX_ENABLED: true,
      IBKR_FLEX_QUERY_IDS: [],
      IBKR_FLEX_BASE_URL: 'https://ndcdyn.interactivebrokers.com',
      IBKR_FLEX_USER_AGENT: 'Finance-OS External Investments/1.0',
      BINANCE_SPOT_ENABLED: true,
      BINANCE_SPOT_BASE_URL: 'https://api.binance.com',
    } as unknown as ExternalInvestmentsRoutesDependencies['env'],
  })

describe('createExternalInvestmentsRoutes', () => {
  it('does not mount credential mutation or test endpoints', async () => {
    const app = createRoutes()
    const requests = [
      new Request('http://finance-os.local/integrations/external-investments/ibkr/credential', {
        method: 'PUT',
      }),
      new Request('http://finance-os.local/integrations/external-investments/binance/credential', {
        method: 'DELETE',
      }),
      new Request(
        'http://finance-os.local/integrations/external-investments/ibkr/credential/test',
        { method: 'POST' }
      ),
    ]

    for (const request of requests) {
      const response = await app.handle(request)
      expect(response.status).toBe(404)
    }
  })
})
