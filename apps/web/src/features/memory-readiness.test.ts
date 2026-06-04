import { describe, expect, it } from 'vitest'
import {
  describeMemoryReadiness,
  type EnrichmentStatusResponse,
  type EnrichmentStorage,
} from './memory-readiness'

const storage = (overrides: Partial<EnrichmentStorage>): EnrichmentStorage => ({
  reachable: true,
  backend: 'production',
  productionConfigured: true,
  productionActive: true,
  fallbackActive: false,
  qdrantReachable: true,
  qdrantCollectionExists: true,
  qdrantCollection: 'finance_os_knowledge',
  qdrantPoints: 0,
  neo4jReachable: true,
  neo4jNodes: 0,
  neo4jRelationships: 0,
  neo4jDatabase: 'neo4j',
  empty: true,
  emptyBecauseNoIngest: true,
  ...overrides,
})

const adminStatus = (s: EnrichmentStorage | null): EnrichmentStatusResponse => ({
  mode: 'admin',
  serviceHealth: { status: 'ok' },
  storage: s,
})

describe('describeMemoryReadiness', () => {
  it('is demo when no status / demo mode', () => {
    expect(describeMemoryReadiness(null).state).toBe('demo')
    expect(describeMemoryReadiness({ mode: 'demo', storage: null }).state).toBe('demo')
  })

  it('is empty (not ready) when Qdrant collection is empty and Neo4j has 0 nodes', () => {
    const result = describeMemoryReadiness(
      adminStatus(storage({ qdrantPoints: 0, neo4jNodes: 0, neo4jRelationships: 0, empty: true }))
    )
    expect(result.state).toBe('empty')
    expect(result.state).not.toBe('ready')
  })

  it('is fallback when production backends are not active', () => {
    const result = describeMemoryReadiness(
      adminStatus(storage({ fallbackActive: true, productionActive: false, backend: 'local' }))
    )
    expect(result.state).toBe('fallback')
    expect(result.label.toLowerCase()).toContain('fallback')
  })

  it('is degraded when the storage status is unreachable', () => {
    expect(describeMemoryReadiness(adminStatus(null)).state).toBe('degraded')
    expect(
      describeMemoryReadiness(adminStatus(storage({ reachable: false }))).state
    ).toBe('degraded')
  })

  it('is ready only when production is active and the graph holds data', () => {
    const result = describeMemoryReadiness(
      adminStatus(storage({ empty: false, neo4jNodes: 128, qdrantPoints: 512 }))
    )
    expect(result.state).toBe('ready')
    expect(result.detail).toContain('128')
  })
})
