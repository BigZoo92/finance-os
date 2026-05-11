import { describe, expect, it } from 'bun:test'
import {
  FORBIDDEN_PROVIDER_CAPABILITIES,
  type ForbiddenProviderCapability,
} from '@finance-os/provider-contract'
import type { ProviderLogTarget } from '@finance-os/provider-runtime'
import type { KnowledgeServiceClientConfig } from '../knowledge-service-client'
import type { ExternalInvestmentsProviderSnapshot } from './external-investments-provider-shared'
import { createInternalProviderRegistry } from './internal-provider-registry'
import type { PowensProviderConnectionSnapshot } from './powens-provider'

const knowledgeConfig: KnowledgeServiceClientConfig = {
  enabled: true,
  url: 'http://knowledge.local',
  timeoutMs: 1_000,
  maxContextTokens: 1024,
  retrievalMode: 'hybrid',
  maxPathDepth: 3,
  minConfidence: 0.5,
}

const noopLogTarget: ProviderLogTarget = { logEvent: () => {} }

const buildHandle = (
  overrides: {
    powensConnections?: ReadonlyArray<PowensProviderConnectionSnapshot>
    ibkrSnapshot?: ExternalInvestmentsProviderSnapshot | null
    binanceSnapshot?: ExternalInvestmentsProviderSnapshot | null
  } = {}
) => {
  let powensCalls = 0
  let ibkrCalls = 0
  let binanceCalls = 0
  const handle = createInternalProviderRegistry({
    knowledge: { config: knowledgeConfig },
    quantPatterns: { config: { enabled: true, url: 'http://quant.local', timeoutMs: 1_000 } },
    news: { adapters: [] },
    powens: {
      listConnectionStatuses: async () => {
        powensCalls += 1
        return overrides.powensConnections ?? []
      },
    },
    ibkr: {
      getProviderSnapshot: async () => {
        ibkrCalls += 1
        return overrides.ibkrSnapshot ?? null
      },
    },
    binance: {
      getProviderSnapshot: async () => {
        binanceCalls += 1
        return overrides.binanceSnapshot ?? null
      },
    },
    logTarget: noopLogTarget,
  })
  return {
    handle,
    counters: {
      get powensCalls() {
        return powensCalls
      },
      get ibkrCalls() {
        return ibkrCalls
      },
      get binanceCalls() {
        return binanceCalls
      },
    },
  }
}

describe('createInternalProviderRegistry', () => {
  it('mounts internal + sensitive providers and exposes them by capability', () => {
    const { handle } = buildHandle()
    const ids = handle.registry.listProviders().map(p => String(p.id))
    expect(ids).toContain('knowledge-service')
    expect(ids).toContain('quant-service')
    expect(ids).toContain('news-service')
    expect(ids).toContain('powens')
    expect(ids).toContain('ibkr')
    expect(ids).toContain('binance')
    expect(ids.length).toBe(6)

    expect(handle.registry.findProvidersByCapability('knowledge.context_bundle.read').length).toBe(
      1
    )
    expect(handle.registry.findProvidersByCapability('quant.patterns.detect').length).toBe(1)
    expect(handle.registry.findProvidersByCapability('news.items.read').length).toBe(1)
    expect(handle.registry.findProvidersByCapability('banking.accounts.read').length).toBe(1)
    expect(
      handle.registry.findProvidersByCapability('external_investments.positions.read').length
    ).toBe(1)
    expect(handle.registry.findProvidersByCapability('crypto.wallet.read').length).toBe(1)

    // Health snapshots are reachable for every mounted provider WITHOUT performing IO.
    const health = handle.registry.healthAll()
    expect(health.size).toBe(6)
  })

  it('listing capabilities never includes any forbidden write/execution capability', () => {
    const { handle } = buildHandle()
    const capabilities = handle.registry.listCapabilities()
    const forbidden = new Set<string>(
      FORBIDDEN_PROVIDER_CAPABILITIES as ReadonlyArray<ForbiddenProviderCapability>
    )
    for (const cap of capabilities) {
      expect(forbidden.has(cap)).toBe(false)
      expect(cap).not.toContain('order')
      expect(cap).not.toContain('transfer')
      expect(cap).not.toContain('payment')
      expect(cap).not.toContain('execute')
      expect(cap).not.toContain('charge')
      expect(cap).not.toContain('swap')
    }
  })

  it('initial healthAll() returns degraded+unconfigured snapshots for sensitive providers without IO', () => {
    const { handle, counters } = buildHandle()
    const health = handle.registry.healthAll()
    const powens = health.get(handle.registry.getProvider('powens' as never)?.id ?? ('' as never))
    expect(powens?.status).toBe('degraded')
    expect(powens?.lastErrorCode).toBe('unconfigured')
    // healthAll() must not invoke any of the injected closures.
    expect(counters.powensCalls).toBe(0)
    expect(counters.ibkrCalls).toBe(0)
    expect(counters.binanceCalls).toBe(0)
  })

  it('refreshSensitiveProviderHealth invokes all sensitive closures in parallel', async () => {
    const { handle, counters } = buildHandle({
      powensConnections: [
        {
          status: 'connected',
          lastSyncStatus: 'OK',
          lastSuccessAt: new Date('2026-05-09T11:30:00Z'),
          lastFailedAt: null,
        },
      ],
      ibkrSnapshot: {
        enabled: true,
        status: 'healthy',
        lastSuccessAt: '2026-05-09T11:30:00.000Z',
        lastFailureAt: null,
        credentialConfigured: true,
        successCount: 4,
        failureCount: 0,
      },
      binanceSnapshot: null,
    })
    await handle.refreshSensitiveProviderHealth()
    expect(counters.powensCalls).toBe(1)
    expect(counters.ibkrCalls).toBe(1)
    expect(counters.binanceCalls).toBe(1)

    const health = handle.registry.healthAll()
    const powens = health.get('powens' as never)
    expect(powens?.status).toBe('ok')
    const ibkr = health.get('ibkr' as never)
    expect(ibkr?.status).toBe('ok')
    const binance = health.get('binance' as never)
    expect(binance?.status).toBe('degraded')
    expect(binance?.lastErrorCode).toBe('unconfigured')
  })

  it('refreshSensitiveProviderHealth swallows errors thrown by individual closures', async () => {
    const handle = createInternalProviderRegistry({
      knowledge: { config: knowledgeConfig },
      quantPatterns: { config: { enabled: true, url: 'http://quant.local', timeoutMs: 1_000 } },
      news: { adapters: [] },
      powens: {
        listConnectionStatuses: async () => {
          throw new Error('powens db boom')
        },
      },
      ibkr: {
        getProviderSnapshot: async () => {
          throw new Error('ibkr db boom')
        },
      },
      binance: {
        getProviderSnapshot: async () => {
          throw new Error('binance db boom')
        },
      },
      logTarget: noopLogTarget,
    })
    // Must NOT throw — failures are absorbed inside each wrapper.
    await handle.refreshSensitiveProviderHealth()
    const health = handle.registry.healthAll()
    expect(health.get('powens' as never)?.status).toBe('degraded')
    expect(health.get('ibkr' as never)?.status).toBe('degraded')
    expect(health.get('binance' as never)?.status).toBe('degraded')
  })
})
