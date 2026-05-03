import { describe, expect, it } from 'vitest'
import {
  EXAMPLE_ID_PREFIX,
  MIN_REAL_NODES_FOR_RENDER,
  buildAdvisorDemoGraph,
  buildAdvisorGraphFromKnowledge,
} from './advisor-graph-data'
import type {
  KnowledgeContextBundleResponse,
  KnowledgeQueryResponse,
} from './knowledge-types'

const buildBundle = (
  entityCount: number
): KnowledgeContextBundleResponse => ({
  requestId: 'req-test',
  mode: 'admin',
  generatedAt: '2026-04-26T00:00:00.000Z',
  query: 'test',
  maxTokens: 1800,
  tokenEstimate: 0,
  summary: 'test bundle',
  entities: Array.from({ length: entityCount }, (_, index) => ({
    id: `real:concept:${index}`,
    type: 'FinancialConcept',
    title: `Concept réel ${index}`,
    summary: `Résumé réel ${index}`,
    confidence: 0.8,
    recency: 1,
    provenanceRefs: ['real:source'],
    why: ['real match'],
  })),
  relations: Array.from({ length: Math.max(0, entityCount - 1) }, (_, index) => ({
    id: `real:rel:${index}`,
    type: 'SUPPORTED_BY',
    fromId: `real:concept:${index}`,
    toId: `real:concept:${index + 1}`,
    confidence: 0.7,
  })),
  graphPaths: [],
  evidence: [],
  contradictoryEvidence: [],
  assumptions: [],
  unknowns: [],
  retrievalExplanation: [],
  confidence: 0.8,
  recency: 1,
  degraded: false,
  fallbackReason: null,
})

const buildEmptyQuery = (): KnowledgeQueryResponse => ({
  ok: true,
  requestId: 'req-test',
  mode: 'admin',
  query: 'test',
  retrievalMode: 'hybrid',
  generatedAt: '2026-04-26T00:00:00.000Z',
  hits: [],
  metrics: {},
  degraded: false,
  fallbackReason: null,
})

describe('buildAdvisorDemoGraph', () => {
  it('returns a curated demo graph with origin=demo and no example tags', () => {
    const graph = buildAdvisorDemoGraph()
    expect(graph.meta.origin).toBe('demo')
    expect(graph.nodes.length).toBeGreaterThan(MIN_REAL_NODES_FOR_RENDER)
    expect(graph.links.length).toBeGreaterThan(0)
    expect(graph.nodes.some(n => n.isExample)).toBe(false)
    expect(graph.meta.exampleNodeCount).toBe(0)
    expect(graph.meta.realNodeCount).toBe(0)
  })

  it('contains personal, recommendation and contradiction kinds for visual richness', () => {
    const graph = buildAdvisorDemoGraph()
    const kinds = new Set(graph.nodes.map(n => n.kind))
    expect(kinds.has('personal_snapshot')).toBe(true)
    expect(kinds.has('recommendation')).toBe(true)
    expect(kinds.has('contradiction')).toBe(true)
    expect(kinds.has('source')).toBe(true)
  })

  it('produces no dangling links (every link endpoint exists in nodes)', () => {
    const graph = buildAdvisorDemoGraph()
    const ids = new Set(graph.nodes.map(n => n.id))
    for (const link of graph.links) {
      expect(ids.has(link.source)).toBe(true)
      expect(ids.has(link.target)).toBe(true)
    }
  })
})

describe('buildAdvisorGraphFromKnowledge — real-only default', () => {
  it('returns origin=empty when no input is provided (no auto-merge with demo)', () => {
    const graph = buildAdvisorGraphFromKnowledge({})
    expect(graph.meta.origin).toBe('empty')
    expect(graph.nodes).toHaveLength(0)
    expect(graph.meta.exampleNodeCount).toBe(0)
    expect(graph.nodes.some(n => n.isExample)).toBe(false)
  })

  it('returns origin=empty for sparse real data without preview opt-in', () => {
    const bundle = buildBundle(2)
    const graph = buildAdvisorGraphFromKnowledge({ bundle })
    expect(graph.meta.origin).toBe('empty')
    // Real nodes are still surfaced for transparency, just below threshold.
    expect(graph.meta.realNodeCount).toBe(2)
    expect(graph.meta.exampleNodeCount).toBe(0)
    // No example node was silently merged in.
    expect(graph.nodes.some(n => n.isExample)).toBe(false)
    expect(graph.nodes.some(n => n.id.startsWith(EXAMPLE_ID_PREFIX))).toBe(false)
  })

  it('returns origin=real for healthy real data and never tags examples', () => {
    const bundle = buildBundle(8)
    const graph = buildAdvisorGraphFromKnowledge({ bundle })
    expect(graph.meta.origin).toBe('real')
    expect(graph.meta.realNodeCount).toBe(8)
    expect(graph.meta.exampleNodeCount).toBe(0)
    expect(graph.nodes.some(n => n.isExample)).toBe(false)
    expect(graph.nodes.some(n => n.id.startsWith(EXAMPLE_ID_PREFIX))).toBe(false)
  })

  it('honors a custom minRealNodes threshold', () => {
    const bundle = buildBundle(2)
    const graph = buildAdvisorGraphFromKnowledge({ bundle, minRealNodes: 2 })
    expect(graph.meta.origin).toBe('real')
    expect(graph.meta.realNodeCount).toBe(2)
  })
})

describe('buildAdvisorGraphFromKnowledge — explicit preview opt-in', () => {
  it('merges curated examples only when preview is true', () => {
    const bundle = buildBundle(2)
    const graph = buildAdvisorGraphFromKnowledge({ bundle, preview: true })
    expect(graph.meta.origin).toBe('mixed')
    expect(graph.meta.realNodeCount).toBe(2)
    expect(graph.meta.exampleNodeCount).toBeGreaterThan(0)
    expect(graph.nodes.length).toBe(graph.meta.realNodeCount + graph.meta.exampleNodeCount)
  })

  it('tags every merged example node with isExample=true and an example: id prefix', () => {
    const bundle = buildBundle(0)
    const graph = buildAdvisorGraphFromKnowledge({ bundle, preview: true })
    expect(graph.meta.origin).toBe('mixed')
    expect(graph.meta.realNodeCount).toBe(0)
    expect(graph.meta.exampleNodeCount).toBeGreaterThan(0)
    for (const node of graph.nodes) {
      expect(node.isExample).toBe(true)
      expect(node.id.startsWith(EXAMPLE_ID_PREFIX)).toBe(true)
    }
  })

  it('keeps real nodes untagged when mixed with examples', () => {
    const bundle = buildBundle(2)
    const graph = buildAdvisorGraphFromKnowledge({ bundle, preview: true })
    const realNodes = graph.nodes.filter(n => !n.isExample)
    const exampleNodes = graph.nodes.filter(n => n.isExample)
    expect(realNodes.length).toBe(2)
    for (const real of realNodes) {
      expect(real.id.startsWith(EXAMPLE_ID_PREFIX)).toBe(false)
    }
    for (const example of exampleNodes) {
      expect(example.id.startsWith(EXAMPLE_ID_PREFIX)).toBe(true)
    }
  })

  it('preview=true with empty real data still produces a mixed-origin graph (no real nodes)', () => {
    const graph = buildAdvisorGraphFromKnowledge({ preview: true })
    expect(graph.meta.origin).toBe('mixed')
    expect(graph.meta.realNodeCount).toBe(0)
    expect(graph.meta.exampleNodeCount).toBeGreaterThan(0)
    expect(graph.nodes.every(n => n.isExample)).toBe(true)
  })
})

describe('buildAdvisorGraphFromKnowledge — degraded flag propagation', () => {
  it('forwards a degraded query response into graph meta', () => {
    const query: KnowledgeQueryResponse = {
      ...buildEmptyQuery(),
      degraded: true,
      fallbackReason: 'service unavailable',
    }
    const graph = buildAdvisorGraphFromKnowledge({ query })
    expect(graph.meta.degraded).toBe(true)
  })
})

describe('buildAdvisorGraphFromKnowledge — adapter integrity', () => {
  it('produces no dangling links across modes', () => {
    const bundle = buildBundle(6)
    for (const preview of [false, true]) {
      const graph = buildAdvisorGraphFromKnowledge({ bundle, preview })
      const ids = new Set(graph.nodes.map(n => n.id))
      for (const link of graph.links) {
        expect(ids.has(link.source)).toBe(true)
        expect(ids.has(link.target)).toBe(true)
      }
    }
  })

  it('uses augmented metadata to ensure example IDs cannot collide with real IDs', () => {
    // Real ID intentionally chosen to share a name with a demo node
    // ("goal:retirement"). Without prefixing this would collide.
    const bundle: KnowledgeContextBundleResponse = {
      ...buildBundle(0),
      entities: [
        {
          id: 'goal:retirement',
          type: 'Goal',
          title: 'Mon objectif retraite',
          summary: 'Réel',
          confidence: 0.9,
          recency: 1,
          provenanceRefs: ['real:source'],
          why: [],
        },
      ],
    }
    const graph = buildAdvisorGraphFromKnowledge({ bundle, preview: true, minRealNodes: 1 })
    expect(graph.meta.origin).toBe('mixed')
    const real = graph.nodes.find(n => n.id === 'goal:retirement')
    const example = graph.nodes.find(n => n.id === `${EXAMPLE_ID_PREFIX}goal:retirement`)
    expect(real).toBeDefined()
    expect(real?.isExample).toBeFalsy()
    expect(example).toBeDefined()
    expect(example?.isExample).toBe(true)
  })
})

