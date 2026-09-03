import { describe, expect, it } from 'vitest'
import type { AdvisorGraph } from '@/features/advisor-graph-data'
import {
  buildRuntimeGraphData,
  humanNodeLabel,
  resolveRuntimeDetailProfile,
  runtimeLinkKey,
  selectPersistentNodeLabels,
  toAdvisorGraphLink,
} from './knowledge-graph-3d-model'

const GRAPH: AdvisorGraph = {
  nodes: [
    { id: 'goal:reserve', label: 'R\u00e9serve', kind: 'goal', importance: 0.8 },
    { id: 'risk:cash', label: 'Risque de tr\u00e9sorerie', kind: 'risk' },
    { id: 'source:note', label: 'Note', kind: 'source' },
  ],
  links: [
    {
      source: 'risk:cash',
      target: 'goal:reserve',
      kind: 'affects',
      summary: 'La marge disponible influence cet objectif.',
    },
    { source: 'source:note', target: 'goal:reserve', kind: 'supports' },
  ],
  meta: {
    origin: 'demo',
    summary: 'Fixture',
    nodeCount: 3,
    linkCount: 2,
    realNodeCount: 0,
    exampleNodeCount: 3,
  },
}

describe('buildRuntimeGraphData', () => {
  it('filters dangling links and gives the force engine owned mutable copies', () => {
    const runtime = buildRuntimeGraphData(
      GRAPH,
      new Set(['goal', 'risk']),
      new Set(['affects', 'supports'])
    )

    expect(runtime.nodes.map(node => node.id)).toEqual(['goal:reserve', 'risk:cash'])
    expect(runtime.links).toHaveLength(1)
    expect(runtime.nodes[0]).not.toBe(GRAPH.nodes[0])
    expect(runtime.links[0]).not.toBe(GRAPH.links[0])

    const runtimeNode = runtime.nodes[0]
    const runtimeLink = runtime.links[0]
    if (!runtimeNode || !runtimeLink) throw new Error('Fixture runtime graph is incomplete')
    runtimeNode.x = 42
    runtimeLink.source = runtimeNode

    expect(GRAPH.nodes[0]).not.toHaveProperty('x')
    expect(GRAPH.links[0]?.source).toBe('risk:cash')
  })

  it('recovers a domain link after the engine replaces endpoint ids with node objects', () => {
    const runtime = buildRuntimeGraphData(
      GRAPH,
      new Set(['goal', 'risk', 'source']),
      new Set(['affects', 'supports'])
    )
    const graphLink = runtime.links[0]
    const source = runtime.nodes.find(node => node.id === 'risk:cash')
    const target = runtime.nodes.find(node => node.id === 'goal:reserve')
    if (!graphLink || !source || !target) throw new Error('Fixture runtime graph is incomplete')
    graphLink.source = source
    graphLink.target = target

    expect(runtimeLinkKey(graphLink)).toBe('risk:cash::affects::goal:reserve')
    expect(toAdvisorGraphLink(graphLink)).toEqual(GRAPH.links[0])
  })
})

describe('resolveRuntimeDetailProfile', () => {
  it('removes continuous effects and caps pixel density for reduced motion', () => {
    expect(resolveRuntimeDetailProfile('cinematic', false, true, 3)).toEqual({
      pixelRatio: 1,
      warmupTicks: 40,
      cooldownTicks: 0,
      arrowResolution: 3,
      particleResolution: 2,
      particlesEnabled: false,
    })
  })

  it('uses the lower mobile profile even when cinematic detail is requested', () => {
    const mobile = resolveRuntimeDetailProfile('cinematic', true, false, 3)
    const desktop = resolveRuntimeDetailProfile('cinematic', false, false, 3)

    expect(mobile.pixelRatio).toBe(1)
    expect(mobile.particlesEnabled).toBe(false)
    expect(mobile.arrowResolution).toBeLessThan(desktop.arrowResolution)
    expect(desktop.pixelRatio).toBe(1.75)
  })
})

describe('selectPersistentNodeLabels', () => {
  const nodes = [
    { id: 'selected', label: 'S\u00e9lection', kind: 'goal' as const, importance: 0.1 },
    { id: 'pinned-1', label: 'Pin 1', kind: 'goal' as const, importance: 0.2 },
    { id: 'pinned-2', label: 'Pin 2', kind: 'goal' as const, importance: 0.9 },
    { id: 'pinned-3', label: 'Pin 3', kind: 'goal' as const, importance: 0.5 },
    { id: 'pinned-4', label: 'Pin 4', kind: 'goal' as const, importance: 0.8 },
    { id: 'pinned-5', label: 'Pin 5', kind: 'goal' as const, importance: 0.7 },
    { id: 'important-1', label: 'Priorit\u00e9 1', kind: 'risk' as const, importance: 1 },
    { id: 'important-2', label: 'Priorit\u00e9 2', kind: 'risk' as const, importance: 0.95 },
    { id: 'important-3', label: 'Priorit\u00e9 3', kind: 'risk' as const, importance: 0.85 },
  ]
  const pins = new Set(['pinned-1', 'pinned-2', 'pinned-3', 'pinned-4', 'pinned-5'])

  it('prioritizes selection, bounded pins, then only a few high-importance nodes', () => {
    expect(selectPersistentNodeLabels(nodes, 'selected', pins, false)).toEqual([
      { nodeId: 'selected', role: 'selected' },
      { nodeId: 'pinned-2', role: 'pinned' },
      { nodeId: 'pinned-4', role: 'pinned' },
      { nodeId: 'pinned-5', role: 'pinned' },
      { nodeId: 'pinned-3', role: 'pinned' },
      { nodeId: 'important-1', role: 'important' },
      { nodeId: 'important-2', role: 'important' },
      { nodeId: 'important-3', role: 'important' },
    ])
  })

  it('uses a stricter mobile cap without duplicating selected or pinned nodes', () => {
    expect(selectPersistentNodeLabels(nodes, 'selected', pins, true)).toEqual([
      { nodeId: 'selected', role: 'selected' },
      { nodeId: 'pinned-2', role: 'pinned' },
      { nodeId: 'pinned-4', role: 'pinned' },
      { nodeId: 'important-1', role: 'important' },
    ])
  })
})

describe('humanNodeLabel', () => {
  it('never falls back to a raw technical id', () => {
    expect(humanNodeLabel({ id: 'goal:reserve', label: 'goal:reserve', kind: 'goal' })).toBe(
      'Objectif'
    )
    expect(humanNodeLabel({ id: 'risk:cash', label: '  ', kind: 'risk' })).toBe('Risque')
  })
})
