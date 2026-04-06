import { describe, expect, it } from 'bun:test'
import { buildFailsoftEnvelope, parseFailsoftSourceOrder } from './failsoft-policy'

describe('failsoft policy', () => {
  it('hard-locks demo mode to deterministic source', () => {
    const envelope = buildFailsoftEnvelope({
      mode: 'demo',
      requestId: 'req-demo',
      domain: 'news',
      staleAgeSeconds: null,
      hasCacheData: false,
      providerFailureRate: 1,
      cacheStale: true,
      sourceOrder: ['live', 'cache', 'demo'],
      policyEnabled: true,
      domainEnabled: true,
    })

    expect(envelope.status).toBe('ok')
    expect(envelope.source).toBe('demo')
    expect(envelope.policy.sourceOrder).toEqual(['demo'])
  })

  it('marks admin as unavailable when cache is empty under enabled policy', () => {
    const envelope = buildFailsoftEnvelope({
      mode: 'admin',
      requestId: 'req-admin',
      domain: 'news',
      staleAgeSeconds: null,
      hasCacheData: false,
      providerFailureRate: 1,
      cacheStale: true,
      sourceOrder: ['live', 'cache', 'demo'],
      policyEnabled: true,
      domainEnabled: true,
    })

    expect(envelope.status).toBe('unavailable')
    expect(envelope.slo.hardFailRate).toBe(1)
    expect(envelope.reasonCode).toBe('cache_empty')
  })

  it('parses source order and drops unsupported values', () => {
    expect(parseFailsoftSourceOrder('live,cache,demo')).toEqual(['live', 'cache', 'demo'])
    expect(parseFailsoftSourceOrder('cache,foo,demo')).toEqual(['cache', 'demo'])
    expect(parseFailsoftSourceOrder('')).toEqual(['live', 'cache', 'demo'])
  })
})
