import { describe, expect, it } from 'bun:test'
import { asProviderId, type Provider, type ProviderHealth } from '@finance-os/provider-contract'
import { createProviderRegistry } from './registry'
import { providerOk } from './result'

const makeFakeProvider = ({
  id,
  capability,
  status = 'ok',
}: {
  id: string
  capability: 'market.quotes.read' | 'news.items.read' | 'quant.metrics.compute'
  status?: ProviderHealth['status']
}): Provider => {
  const pid = asProviderId(id)
  return {
    id: pid,
    capability,
    call: async (_input, ctx) =>
      providerOk(
        { id, capability },
        {
          requestId: ctx.requestId,
          durationMs: 0,
          sources: [{ providerId: pid, capability, freshnessMinutes: 0, fromCache: false }],
        }
      ),
    getHealth: () => ({
      status,
      lastSuccessAt: null,
      lastErrorCode: null,
    }),
  }
}

describe('createProviderRegistry', () => {
  it('lists providers and capabilities in registration order', () => {
    const a = makeFakeProvider({ id: 'a', capability: 'market.quotes.read' })
    const b = makeFakeProvider({ id: 'b', capability: 'news.items.read' })
    const reg = createProviderRegistry([a, b])
    expect(reg.listProviders().map(p => p.id)).toEqual([a.id, b.id])
    expect([...reg.listCapabilities()].sort()).toEqual(['market.quotes.read', 'news.items.read'])
  })

  it('looks up by id and by (capability, id)', () => {
    const a = makeFakeProvider({ id: 'a', capability: 'market.quotes.read' })
    const reg = createProviderRegistry([a])
    expect(reg.getProvider(a.id)).toBe(a)
    expect(reg.get('market.quotes.read', a.id)).toBe(a)
    expect(reg.get('news.items.read', a.id)).toBeUndefined()
  })

  it('groups providers by capability', () => {
    const a = makeFakeProvider({ id: 'a', capability: 'market.quotes.read' })
    const b = makeFakeProvider({ id: 'b', capability: 'market.quotes.read' })
    const c = makeFakeProvider({ id: 'c', capability: 'news.items.read' })
    const reg = createProviderRegistry([a, b, c])
    const market = reg.findProvidersByCapability('market.quotes.read')
    expect(market.map(p => p.id)).toEqual([a.id, b.id])
  })

  it('rejects duplicate provider ids', () => {
    const a = makeFakeProvider({ id: 'dup', capability: 'market.quotes.read' })
    const b = makeFakeProvider({ id: 'dup', capability: 'news.items.read' })
    expect(() => {
      createProviderRegistry([a, b])
    }).toThrow(/duplicate provider id/)
  })

  it('healthAll reflects each providers getHealth snapshot', () => {
    const a = makeFakeProvider({ id: 'a', capability: 'market.quotes.read', status: 'ok' })
    const b = makeFakeProvider({
      id: 'b',
      capability: 'news.items.read',
      status: 'degraded',
    })
    const reg = createProviderRegistry([a, b])
    const health = reg.healthAll()
    expect(health.get(a.id)?.status).toBe('ok')
    expect(health.get(b.id)?.status).toBe('degraded')
  })
})
