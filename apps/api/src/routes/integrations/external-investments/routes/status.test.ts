import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createExternalInvestmentsRuntimePlugin } from '../plugin'
import type { ExternalInvestmentsRouteRuntime } from '../types'
import { createExternalInvestmentsStatusRoute } from './status'

const createStatusApp = (providerConfigured: { ibkr: boolean; binance: boolean }) => {
  const runtime: ExternalInvestmentsRouteRuntime = {
    config: {
      enabled: true,
      safeModeActive: false,
      staleAfterMinutes: 1440,
      providerEnabled: { ibkr: true, binance: true },
      providerConfigured,
    },
    repository: {
      getStatus: async () => ({
        connections: [],
        health: [],
        providerConfigured,
      }),
    } as unknown as ExternalInvestmentsRouteRuntime['repository'],
    jobs: {
      enqueueAllProvidersSync: async () => undefined,
      enqueueProviderSync: async () => undefined,
      enqueueConnectionSync: async () => undefined,
      getSyncBacklogCount: async () => 0,
    },
  }

  return new Elysia()
    .derive(() => ({
      auth: { mode: 'admin' } as const,
      internalAuth: { hasValidToken: false, tokenSource: null },
      requestMeta: { requestId: 'req-status-test', startedAtMs: 0 },
    }))
    .use(createExternalInvestmentsRuntimePlugin(runtime))
    .use(createExternalInvestmentsStatusRoute())
}

describe('createExternalInvestmentsStatusRoute', () => {
  it('reports environment configuration presence per provider without credential data', async () => {
    const response = await createStatusApp({ ibkr: true, binance: false }).handle(
      new Request('http://finance-os.local/status')
    )
    const payload = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload.providerConfigured).toEqual({ ibkr: true, binance: false })
    expect(JSON.stringify(payload)).not.toContain('flex-token')
    expect(JSON.stringify(payload)).not.toContain('api-secret')
  })
})
