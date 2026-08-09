import type { ExternalInvestmentProvider, createExternalInvestmentsRepository } from '@finance-os/external-investments'
import type { createDbClient } from '@finance-os/db'
import type { getApiEnv } from '@finance-os/env'
import type { createRedisClient } from '@finance-os/redis'

export type ExternalInvestmentsApiDb = ReturnType<typeof createDbClient>['db']
export type ExternalInvestmentsRedisClient = ReturnType<typeof createRedisClient>['client']
export type ExternalInvestmentsApiEnv = ReturnType<typeof getApiEnv>
export type ExternalInvestmentsRepository = ReturnType<typeof createExternalInvestmentsRepository>

export interface ExternalInvestmentsRoutesDependencies {
  db: ExternalInvestmentsApiDb
  redisClient: ExternalInvestmentsRedisClient
  env: ExternalInvestmentsApiEnv
}

export interface ExternalInvestmentsJobQueueRepository {
  enqueueAllProvidersSync: (input?: { requestId?: string }) => Promise<void>
  enqueueProviderSync: (input: {
    provider: ExternalInvestmentProvider
    requestId?: string
  }) => Promise<void>
  enqueueConnectionSync: (input: {
    provider: ExternalInvestmentProvider
    connectionId: number
    requestId?: string
  }) => Promise<void>
  getSyncBacklogCount: () => Promise<number>
}

export interface ExternalInvestmentsRouteRuntime {
  config: {
    enabled: boolean
    safeModeActive: boolean
    staleAfterMinutes: number
    providerEnabled: Record<ExternalInvestmentProvider, boolean>
    providerConfigured: Record<ExternalInvestmentProvider, boolean>
  }
  repository: ExternalInvestmentsRepository
  jobs: ExternalInvestmentsJobQueueRepository
}
