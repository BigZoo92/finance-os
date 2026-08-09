import {
  createExternalInvestmentsRepository,
  resolveExternalInvestmentServerConfig,
} from '@finance-os/external-investments'
import { createExternalInvestmentsJobQueueRepository } from './repositories/external-investments-job-queue-repository'
import type {
  ExternalInvestmentsRouteRuntime,
  ExternalInvestmentsRoutesDependencies,
} from './types'

export const createExternalInvestmentsRouteRuntime = ({
  db,
  redisClient,
  env,
}: ExternalInvestmentsRoutesDependencies): ExternalInvestmentsRouteRuntime => {
  const serverConfig = resolveExternalInvestmentServerConfig({
    ibkr: {
      ...(env.IBKR_FLEX_TOKEN ? { flexToken: env.IBKR_FLEX_TOKEN } : {}),
      queryIds: env.IBKR_FLEX_QUERY_IDS,
      baseUrl: env.IBKR_FLEX_BASE_URL,
      userAgent: env.IBKR_FLEX_USER_AGENT,
    },
    binance: {
      ...(env.BINANCE_SPOT_API_KEY ? { apiKey: env.BINANCE_SPOT_API_KEY } : {}),
      ...(env.BINANCE_SPOT_API_SECRET ? { apiSecret: env.BINANCE_SPOT_API_SECRET } : {}),
      baseUrl: env.BINANCE_SPOT_BASE_URL,
    },
  })
  const repository = createExternalInvestmentsRepository({
    db,
    staleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
    providerConfigured: serverConfig.configured,
  })
  const jobs = createExternalInvestmentsJobQueueRepository(redisClient)

  return {
    config: {
      enabled: env.EXTERNAL_INVESTMENTS_ENABLED,
      safeModeActive: env.EXTERNAL_INTEGRATIONS_SAFE_MODE || env.EXTERNAL_INVESTMENTS_SAFE_MODE,
      staleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
      providerEnabled: {
        ibkr: env.IBKR_FLEX_ENABLED,
        binance: env.BINANCE_SPOT_ENABLED,
      },
      providerConfigured: serverConfig.configured,
    },
    repository,
    jobs,
  }
}
