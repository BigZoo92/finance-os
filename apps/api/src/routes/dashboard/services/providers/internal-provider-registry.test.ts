import { describe, expect, it } from 'bun:test'
import type { ProviderLogTarget } from '@finance-os/provider-runtime'
import type { KnowledgeServiceClientConfig } from '../knowledge-service-client'
import { createInternalProviderRegistry } from './internal-provider-registry'

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

describe('createInternalProviderRegistry', () => {
  it('mounts knowledge-service and quant-service providers and exposes them by capability', () => {
    const registry = createInternalProviderRegistry({
      knowledge: { config: knowledgeConfig },
      quantPatterns: { config: { enabled: true, url: 'http://quant.local', timeoutMs: 1_000 } },
      logTarget: noopLogTarget,
    })

    const ids = registry.listProviders().map(p => String(p.id))
    expect(ids).toContain('knowledge-service')
    expect(ids).toContain('quant-service')

    const knowledge = registry.findProvidersByCapability('knowledge.context_bundle.read')
    expect(knowledge.length).toBe(1)

    const quant = registry.findProvidersByCapability('quant.patterns.detect')
    expect(quant.length).toBe(1)

    // Health snapshots are reachable for every mounted provider without performing IO.
    const health = registry.healthAll()
    expect(health.size).toBe(2)
  })
})
