import { describe, expect, it } from 'bun:test'
import {
  asProviderId,
  type Provider,
  type ProviderCallContext,
  type ProviderHealth,
} from '@finance-os/provider-contract'
import { computeProviderDiagnostics } from './diagnostics'
import { createProviderRegistry } from './registry'
import { providerOk } from './result'

const NOW = new Date('2026-05-09T12:00:00.000Z')

const baseContext = (mode: 'demo' | 'admin'): ProviderCallContext => ({
  mode,
  requestId: 'req-diag',
  now: NOW,
  reason: 'diagnostics-test',
})

const makeProvider = ({
  id,
  status,
  lastSuccessAt = null,
  lastErrorCode = null,
}: {
  id: string
  status: ProviderHealth['status']
  lastSuccessAt?: string | null
  lastErrorCode?: ProviderHealth['lastErrorCode']
}): Provider => {
  const pid = asProviderId(id)
  return {
    id: pid,
    capability: 'market.quotes.read',
    call: async (_input, ctx) =>
      providerOk(
        {},
        {
          requestId: ctx.requestId,
          durationMs: 0,
          sources: [
            {
              providerId: pid,
              capability: 'market.quotes.read',
              freshnessMinutes: 0,
              fromCache: false,
            },
          ],
        }
      ),
    getHealth: () => ({ status, lastSuccessAt, lastErrorCode }),
  }
}

describe('computeProviderDiagnostics', () => {
  it('returns a deterministic demo fixture without touching providers', () => {
    let calls = 0
    const reg = createProviderRegistry([
      {
        id: asProviderId('p'),
        capability: 'market.quotes.read',
        call: async () => {
          throw new Error('should not be called in demo')
        },
        getHealth: () => {
          calls += 1
          return { status: 'ok', lastSuccessAt: null, lastErrorCode: null }
        },
      },
    ])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('demo') })
    expect(out.mode).toBe('demo')
    expect(out.generatedAt).toBe(NOW.toISOString())
    expect(out.providers.length).toBe(0)
    expect(out.summary.total).toBe(0)
    expect(out.caveats.length).toBeGreaterThan(0)
    expect(calls).toBe(0)
  })

  it('returns the no-providers shape when the admin registry is empty', () => {
    const reg = createProviderRegistry([])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    expect(out.mode).toBe('admin')
    expect(out.providers).toEqual([])
    expect(out.summary.total).toBe(0)
    expect(out.caveats.some(c => c.includes('no providers'))).toBe(true)
  })

  it('summarizes admin diagnostics from getHealth snapshots only', () => {
    const reg = createProviderRegistry([
      makeProvider({ id: 'a', status: 'ok' }),
      makeProvider({ id: 'b', status: 'degraded', lastErrorCode: 'rate_limited' }),
      makeProvider({ id: 'c', status: 'down', lastErrorCode: 'auth_failed' }),
    ])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    expect(out.summary).toEqual({
      total: 3,
      healthy: 1,
      degraded: 1,
      down: 1,
      unknown: 0,
      disabled: 0,
    })
    const errored = out.providers.find(p => p.providerId === asProviderId('b'))
    expect(errored?.errorCode).toBe('rate_limited')
    expect(errored?.degraded).toBe(true)
  })

  it('exposes only browser-safe fields per provider', () => {
    const reg = createProviderRegistry([makeProvider({ id: 'a', status: 'ok' })])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    const entry = out.providers[0]
    expect(entry).toBeDefined()
    if (entry === undefined) return
    expect(Object.keys(entry).sort()).toEqual([
      'capabilities',
      'caveats',
      'degraded',
      'errorCode',
      'freshnessMinutes',
      'lastCheckedAt',
      'providerId',
      'status',
    ])
  })

  // Macro Prompt 5 — diagnostics hardening tests.

  it('returns providers sorted alphabetically by providerId regardless of registry order', () => {
    const reg1 = createProviderRegistry([
      makeProvider({ id: 'powens', status: 'ok' }),
      makeProvider({ id: 'binance', status: 'ok' }),
      makeProvider({ id: 'ibkr', status: 'ok' }),
    ])
    const reg2 = createProviderRegistry([
      makeProvider({ id: 'ibkr', status: 'ok' }),
      makeProvider({ id: 'powens', status: 'ok' }),
      makeProvider({ id: 'binance', status: 'ok' }),
    ])
    const out1 = computeProviderDiagnostics({ registry: reg1, context: baseContext('admin') })
    const out2 = computeProviderDiagnostics({ registry: reg2, context: baseContext('admin') })
    expect(out1.providers.map(p => p.providerId)).toEqual(out2.providers.map(p => p.providerId))
    expect(out1.providers.map(p => p.providerId)).toEqual(['binance', 'ibkr', 'powens'])
  })

  it('does NOT report `unconfigured` providers as `down` and surfaces a caveat', () => {
    const reg = createProviderRegistry([
      makeProvider({
        id: 'powens',
        status: 'degraded',
        lastErrorCode: 'unconfigured',
      }),
    ])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    const entry = out.providers[0]
    expect(entry?.status).toBe('degraded')
    expect(entry?.errorCode).toBe('unconfigured')
    expect(entry?.caveats.some(c => c.includes('unconfigured'))).toBe(true)
    expect(out.summary.down).toBe(0)
    expect(out.summary.degraded).toBe(1)
  })

  it('does NOT report `disabled_by_flag` providers as `down` and surfaces a caveat', () => {
    const reg = createProviderRegistry([
      makeProvider({
        id: 'binance',
        status: 'degraded',
        lastErrorCode: 'disabled_by_flag',
      }),
    ])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    const entry = out.providers[0]
    expect(entry?.errorCode).toBe('disabled_by_flag')
    expect(entry?.caveats.some(c => c.includes('disabled by feature flag'))).toBe(true)
    expect(out.summary.down).toBe(0)
  })

  it('summary counts are correct under mixed states (ok + degraded + down + disabled-by-flag)', () => {
    const reg = createProviderRegistry([
      makeProvider({ id: 'a', status: 'ok' }),
      makeProvider({ id: 'b', status: 'degraded', lastErrorCode: 'unconfigured' }),
      makeProvider({ id: 'c', status: 'degraded', lastErrorCode: 'disabled_by_flag' }),
      makeProvider({ id: 'd', status: 'degraded', lastErrorCode: 'rate_limited' }),
      makeProvider({ id: 'e', status: 'down', lastErrorCode: 'provider_unavailable' }),
    ])
    const out = computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    expect(out.summary).toEqual({
      total: 5,
      healthy: 1,
      degraded: 3,
      down: 1,
      unknown: 0,
      disabled: 0,
    })
  })

  it('does not invoke provider.call() when computing diagnostics', () => {
    let calls = 0
    const reg = createProviderRegistry([
      {
        id: asProviderId('powens'),
        capability: 'banking.accounts.read',
        call: async () => {
          calls += 1
          throw new Error('should never be called')
        },
        getHealth: () => ({ status: 'ok', lastSuccessAt: null, lastErrorCode: null }),
      },
      {
        id: asProviderId('ibkr'),
        capability: 'external_investments.positions.read',
        call: async () => {
          calls += 1
          throw new Error('should never be called')
        },
        getHealth: () => ({ status: 'ok', lastSuccessAt: null, lastErrorCode: null }),
      },
    ])
    computeProviderDiagnostics({ registry: reg, context: baseContext('admin') })
    expect(calls).toBe(0)
  })
})
