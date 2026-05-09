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
})
