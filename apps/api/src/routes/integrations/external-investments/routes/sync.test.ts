import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createExternalInvestmentsRuntimePlugin } from '../plugin'
import type {
  ExternalInvestmentsJobQueueRepository,
  ExternalInvestmentsRouteRuntime,
} from '../types'
import { createExternalInvestmentsSyncRoute } from './sync'

const createSyncRuntime = (
  jobs: Pick<
    ExternalInvestmentsJobQueueRepository,
    'enqueueAllProvidersSync' | 'enqueueProviderSync'
  >
): ExternalInvestmentsRouteRuntime => ({
  config: {
    enabled: true,
    safeModeActive: false,
    staleAfterMinutes: 1440,
    providerEnabled: {
      ibkr: true,
      binance: true,
    },
    credentialDefaults: {
      ibkrBaseUrl: 'https://ndcdyn.interactivebrokers.com',
      ibkrUserAgent: 'Finance-OS External Investments/1.0',
      binanceBaseUrl: 'https://api.binance.com',
    },
  },
  repository: {} as ExternalInvestmentsRouteRuntime['repository'],
  jobs: {
    enqueueAllProvidersSync: jobs.enqueueAllProvidersSync,
    enqueueProviderSync: jobs.enqueueProviderSync,
    enqueueConnectionSync: async () => {
      throw new Error('not used in sync route tests')
    },
    getSyncBacklogCount: async () => 0,
  },
  credentials: {
    upsertCredential: async () => {
      throw new Error('not used in sync route tests')
    },
    deleteCredential: async () => {
      throw new Error('not used in sync route tests')
    },
    testCredential: async () => {
      throw new Error('not used in sync route tests')
    },
  },
})

const createSyncTestApp = (runtime: ExternalInvestmentsRouteRuntime) =>
  new Elysia()
    .derive(() => ({
      auth: {
        mode: 'admin',
      } as const,
      internalAuth: {
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-external-sync-test',
        startedAtMs: 0,
      },
    }))
    .use(createExternalInvestmentsRuntimePlugin(runtime))
    .use(createExternalInvestmentsSyncRoute())

describe('createExternalInvestmentsSyncRoute', () => {
  it('accepts all-provider sync requests without a JSON body', async () => {
    const allSyncInputs: Array<{ requestId?: string }> = []
    const app = createSyncTestApp(
      createSyncRuntime({
        enqueueAllProvidersSync: async input => {
          allSyncInputs.push(input ?? {})
        },
        enqueueProviderSync: async () => {
          throw new Error('provider sync should not be called')
        },
      })
    )

    const response = await app.handle(
      new Request('http://finance-os.local/sync', { method: 'POST' })
    )
    const payload = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.enqueued).toEqual(['ibkr', 'binance'])
    expect(allSyncInputs).toEqual([{ requestId: 'req-external-sync-test' }])
  })

  it('accepts provider sync requests without a JSON body', async () => {
    const providerSyncInputs: Array<{ provider: string; requestId?: string }> = []
    const app = createSyncTestApp(
      createSyncRuntime({
        enqueueAllProvidersSync: async () => {
          throw new Error('all-provider sync should not be called')
        },
        enqueueProviderSync: async input => {
          providerSyncInputs.push(input)
        },
      })
    )

    const response = await app.handle(
      new Request('http://finance-os.local/ibkr/sync', { method: 'POST' })
    )
    const payload = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.enqueued).toEqual(['ibkr'])
    expect(providerSyncInputs).toEqual([{ provider: 'ibkr', requestId: 'req-external-sync-test' }])
  })
})
