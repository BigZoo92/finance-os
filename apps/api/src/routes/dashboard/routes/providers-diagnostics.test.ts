import { describe, expect, it } from 'bun:test'
import type { Provider } from '@finance-os/provider-contract'
import { createProviderRegistry, type ProviderRegistry } from '@finance-os/provider-runtime'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime } from '../types'
import { createProvidersDiagnosticsRoute } from './providers-diagnostics'

interface DiagnosticsResponse {
  generatedAt: string
  mode: 'demo' | 'admin'
  providers: ReadonlyArray<{
    providerId: string
    status: 'ok' | 'degraded' | 'down' | 'unknown' | 'disabled'
    capabilities: ReadonlyArray<string>
    lastCheckedAt: string | null
    degraded: boolean
    freshnessMinutes: number | null
    errorCode: string | null
    caveats: ReadonlyArray<string>
  }>
  summary: {
    total: number
    healthy: number
    degraded: number
    down: number
    unknown: number
    disabled: number
  }
  caveats: ReadonlyArray<string>
}

const buildProvider = (
  id: string,
  capability:
    | 'knowledge.context_bundle.read'
    | 'quant.patterns.detect'
    | 'news.items.read'
    | 'banking.accounts.read'
    | 'external_investments.positions.read'
    | 'crypto.wallet.read',
  status: 'ok' | 'degraded' | 'down',
  errorCode: string | null = null
): Provider => ({
  id: id as unknown as Provider['id'],
  capability,
  call: async () => {
    throw new Error('not used in diagnostics tests')
  },
  getHealth: () => ({
    status,
    lastSuccessAt: status === 'ok' ? '2026-05-09T12:00:00.000Z' : null,
    lastErrorCode: errorCode as never,
  }),
})

const buildRegistry = (providers: ReadonlyArray<Provider>): ProviderRegistry =>
  createProviderRegistry(providers)

const buildRuntime = (
  registry: ProviderRegistry,
  refreshProviderHealth?: () => Promise<void>
): DashboardRouteRuntime =>
  ({
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: {} as DashboardRouteRuntime['useCases'],
    providerRegistry: registry,
    ...(refreshProviderHealth ? { refreshProviderHealth } : {}),
  }) as DashboardRouteRuntime

const buildApp = ({
  mode,
  hasValidInternalToken = false,
  registry,
  refreshProviderHealth,
}: {
  mode: 'admin' | 'demo'
  hasValidInternalToken?: boolean
  registry: ProviderRegistry
  refreshProviderHealth?: () => Promise<void>
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: hasValidInternalToken,
        tokenSource: hasValidInternalToken ? ('x-internal-token' as const) : null,
      } as const,
      requestMeta: {
        requestId: 'req-diag-test',
        startedAtMs: 0,
      },
    }))
    .use(createDashboardRuntimePlugin(buildRuntime(registry, refreshProviderHealth)))
    .use(createProvidersDiagnosticsRoute())

describe('GET /dashboard/providers/diagnostics', () => {
  it('returns deterministic empty fixture in demo mode', async () => {
    const registry = buildRegistry([
      buildProvider('knowledge-service', 'knowledge.context_bundle.read', 'ok'),
      buildProvider('quant-service', 'quant.patterns.detect', 'ok'),
      buildProvider('news-service', 'news.items.read', 'ok'),
    ])
    const app = buildApp({ mode: 'demo', registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DiagnosticsResponse
    expect(payload.mode).toBe('demo')
    expect(payload.providers).toEqual([])
    expect(payload.summary.total).toBe(0)
    expect(payload.caveats.length).toBeGreaterThan(0)
  })

  it('returns admin diagnostics shape with summary counts and no provider IO', async () => {
    let callCount = 0
    const wrapped = (p: Provider): Provider => ({
      ...p,
      call: async () => {
        callCount += 1
        throw new Error('must not be called by diagnostics')
      },
    })
    const registry = buildRegistry([
      wrapped(buildProvider('knowledge-service', 'knowledge.context_bundle.read', 'ok')),
      wrapped(buildProvider('quant-service', 'quant.patterns.detect', 'degraded', 'transient')),
      wrapped(buildProvider('news-service', 'news.items.read', 'down', 'disabled_by_flag')),
    ])
    const app = buildApp({ mode: 'admin', registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    expect(response.status).toBe(200)
    const payload = (await response.json()) as DiagnosticsResponse
    expect(payload.mode).toBe('admin')
    expect(payload.providers).toHaveLength(3)
    expect(payload.summary.total).toBe(3)
    expect(payload.summary.healthy).toBe(1)
    expect(payload.summary.degraded).toBe(1)
    expect(payload.summary.down).toBe(1)

    const knowledge = payload.providers.find(p => p.providerId === 'knowledge-service')
    expect(knowledge?.status).toBe('ok')
    expect(knowledge?.capabilities).toEqual(['knowledge.context_bundle.read'])
    const news = payload.providers.find(p => p.providerId === 'news-service')
    expect(news?.status).toBe('down')
    expect(news?.errorCode).toBe('disabled_by_flag')

    // Diagnostics MUST never call providers.
    expect(callCount).toBe(0)

    // Closed-shape: no surprise top-level keys (e.g., raw config / credentials).
    const allowedKeys = new Set(['generatedAt', 'mode', 'providers', 'summary', 'caveats'])
    for (const key of Object.keys(payload)) {
      expect(allowedKeys.has(key)).toBe(true)
    }
    const stringified = JSON.stringify(payload)
    expect(stringified).not.toContain('apiKey')
    expect(stringified).not.toContain('token')
    expect(stringified).not.toContain('secret')
  })

  it('admin path with empty registry returns no_providers caveat and zero summary', async () => {
    const registry = buildRegistry([])
    const app = buildApp({ mode: 'admin', registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse
    expect(payload.mode).toBe('admin')
    expect(payload.providers).toEqual([])
    expect(payload.summary.total).toBe(0)
    expect(payload.caveats.length).toBeGreaterThan(0)
  })

  it('valid internal token without admin auth still gets admin shape', async () => {
    const registry = buildRegistry([
      buildProvider('knowledge-service', 'knowledge.context_bundle.read', 'ok'),
    ])
    const app = buildApp({ mode: 'demo', hasValidInternalToken: true, registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse
    expect(payload.mode).toBe('admin')
    expect(payload.providers).toHaveLength(1)
  })

  // Macro Prompt 4 — sensitive providers foundation.

  it('admin path lists sensitive providers (powens / ibkr / binance) with their capabilities', async () => {
    const registry = buildRegistry([
      buildProvider('powens', 'banking.accounts.read', 'degraded', 'unconfigured'),
      buildProvider('ibkr', 'external_investments.positions.read', 'down', 'provider_unavailable'),
      buildProvider('binance', 'crypto.wallet.read', 'ok'),
    ])
    const app = buildApp({ mode: 'admin', registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse

    const powens = payload.providers.find(p => p.providerId === 'powens')
    expect(powens?.capabilities).toEqual(['banking.accounts.read'])
    expect(powens?.status).toBe('degraded')
    expect(powens?.errorCode).toBe('unconfigured')

    const ibkr = payload.providers.find(p => p.providerId === 'ibkr')
    expect(ibkr?.capabilities).toEqual(['external_investments.positions.read'])
    expect(ibkr?.status).toBe('down')
    expect(ibkr?.errorCode).toBe('provider_unavailable')

    const binance = payload.providers.find(p => p.providerId === 'binance')
    expect(binance?.capabilities).toEqual(['crypto.wallet.read'])
    expect(binance?.status).toBe('ok')
  })

  it('admin path awaits refreshProviderHealth before computing diagnostics', async () => {
    let refreshCalls = 0
    const registry = buildRegistry([
      buildProvider('powens', 'banking.accounts.read', 'ok'),
      buildProvider('ibkr', 'external_investments.positions.read', 'ok'),
      buildProvider('binance', 'crypto.wallet.read', 'ok'),
    ])
    const refreshProviderHealth = async () => {
      refreshCalls += 1
    }
    const app = buildApp({ mode: 'admin', registry, refreshProviderHealth })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    expect(response.status).toBe(200)
    expect(refreshCalls).toBe(1)
  })

  it('demo path does NOT call refreshProviderHealth (no DB read for unauthenticated callers)', async () => {
    let refreshCalls = 0
    const registry = buildRegistry([buildProvider('powens', 'banking.accounts.read', 'ok')])
    const refreshProviderHealth = async () => {
      refreshCalls += 1
    }
    const app = buildApp({ mode: 'demo', registry, refreshProviderHealth })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    expect(response.status).toBe(200)
    expect(refreshCalls).toBe(0)
  })

  it('admin diagnostics never expose sensitive sentinels (token / apiKey / signature / account)', async () => {
    let callCount = 0
    const wrapped = (p: Provider): Provider => ({
      ...p,
      call: async () => {
        callCount += 1
        throw new Error('must not be called by diagnostics')
      },
    })
    const registry = buildRegistry([
      wrapped(buildProvider('powens', 'banking.accounts.read', 'degraded', 'transient')),
      wrapped(
        buildProvider('ibkr', 'external_investments.positions.read', 'down', 'provider_unavailable')
      ),
      wrapped(buildProvider('binance', 'crypto.wallet.read', 'ok')),
    ])
    const app = buildApp({ mode: 'admin', registry })
    const response = await app.handle(new Request('http://finance-os.local/providers/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse
    expect(callCount).toBe(0)
    const stringified = JSON.stringify(payload)
    for (const sentinel of [
      'apiKey',
      'apiSecret',
      'token',
      'secret',
      'password',
      'authorization',
      'signature',
      'flexToken',
      'accessToken',
      'refreshToken',
      'powensConnectionId',
      'flexQueryId',
      // Account-id-shaped values (long digit strings).
      '5678-9012-3456',
    ]) {
      expect(stringified).not.toContain(sentinel)
    }
  })
})
