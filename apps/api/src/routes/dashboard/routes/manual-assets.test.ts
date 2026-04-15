import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { createManualAssetsRoute } from './manual-assets'
import type { DashboardManualAssetResponse, DashboardRouteRuntime } from '../types'

const sampleManualAsset: DashboardManualAssetResponse = {
  assetId: 42,
  type: 'manual',
  origin: 'manual',
  source: 'manual',
  name: 'Private equity sidecar',
  currency: 'EUR',
  valuation: 12500,
  valuationAsOf: '2026-04-14T08:00:00.000Z',
  enabled: true,
  note: 'Valorisation saisie manuellement',
  category: 'private_markets',
  metadata: {
    note: 'Valorisation saisie manuellement',
    category: 'private_markets',
  },
  createdAt: '2026-04-14T08:00:00.000Z',
  updatedAt: '2026-04-14T08:00:00.000Z',
}

const createRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime => ({
  repositories: {
    readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
    derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
  },
  useCases: {
    getSummary: async () => {
      throw new Error('not used')
    },
    getTransactions: async () => {
      throw new Error('not used')
    },
    requestTransactionsBackgroundRefresh: async () => false,
    updateTransactionClassification: async () => null,
    getGoals: async () => ({ items: [] }),
    createGoal: async () => {
      throw new Error('not used')
    },
    updateGoal: async () => null,
    archiveGoal: async () => null,
    getDerivedRecomputeStatus: async () => {
      throw new Error('not used')
    },
    runDerivedRecompute: async () => {
      throw new Error('not used')
    },
    getManualAssets: async () => ({ items: [] }),
    createManualAsset: async () => sampleManualAsset,
    updateManualAsset: async () => sampleManualAsset,
    deleteManualAsset: async assetId => ({
      ok: true,
      assetId,
    }),
    ...overrides,
  },
})

const createApp = ({
  mode,
  runtime,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-manual-assets-test',
        startedAtMs: Date.now(),
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createRuntime()))
    .use(createManualAssetsRoute())

describe('createManualAssetsRoute', () => {
  it('returns demo fixtures in demo mode', async () => {
    const app = createApp({ mode: 'demo' })

    const response = await app.handle(new Request('http://finance-os.local/manual-assets'))
    const payload = (await response.json()) as { items: DashboardManualAssetResponse[] }

    expect(response.status).toBe(200)
    expect(payload.items.length).toBeGreaterThan(0)
    expect(payload.items.every(item => item.origin === 'manual')).toBe(true)
  })

  it('returns an empty admin list when no manual asset exists yet', async () => {
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        getManualAssets: async () => ({ items: [] }),
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/manual-assets'))
    const payload = (await response.json()) as { items: DashboardManualAssetResponse[] }

    expect(response.status).toBe(200)
    expect(payload.items).toEqual([])
  })

  it('creates a manual asset in admin mode', async () => {
    const app = createApp({
      mode: 'admin',
      runtime: createRuntime({
        getManualAssets: async () => ({ items: [] }),
        createManualAsset: async input => ({
          ...sampleManualAsset,
          name: input.name,
          valuation: input.valuation,
        }),
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/manual-assets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          assetType: 'manual',
          name: 'Private equity sidecar',
          currency: 'EUR',
          valuation: 12500,
          valuationAsOf: null,
          note: 'Valorisation saisie manuellement',
          category: 'private_markets',
          enabled: true,
        }),
      })
    )
    const payload = (await response.json()) as DashboardManualAssetResponse

    expect(response.status).toBe(200)
    expect(payload.name).toBe('Private equity sidecar')
    expect(payload.valuation).toBe(12500)
  })

  it('blocks manual asset creation in demo mode', async () => {
    const app = createApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/manual-assets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          assetType: 'manual',
          name: 'Not allowed',
          currency: 'EUR',
          valuation: 100,
          valuationAsOf: null,
          note: null,
          category: null,
          enabled: true,
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
  })
})
