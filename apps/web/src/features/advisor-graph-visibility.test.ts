import { describe, expect, it } from 'vitest'
import type { AdvisorGraph } from './advisor-graph-data'
import { deriveVisibleAdvisorGraph, searchVisibleAdvisorGraph } from './advisor-graph-visibility'

const graph: AdvisorGraph = {
  nodes: [
    {
      id: 'goal:one',
      label: 'Apport immobilier',
      summary: 'Objectif de moyen terme',
      kind: 'goal',
      importance: 0.9,
      source: 'provider-secret',
    },
    {
      id: 'investment:one',
      label: 'ETF Monde',
      kind: 'investment',
      importance: 0.7,
    },
    {
      id: 'source:one',
      label: 'Document de référence',
      kind: 'source',
      importance: 0.5,
    },
  ],
  links: [
    { source: 'goal:one', target: 'investment:one', kind: 'related_to' },
    { source: 'goal:one', target: 'source:one', kind: 'derived_from' },
  ],
  meta: {
    origin: 'real',
    summary: 'Mémoire réelle',
    nodeCount: 3,
    linkCount: 2,
    realNodeCount: 3,
    exampleNodeCount: 0,
  },
}

describe('deriveVisibleAdvisorGraph', () => {
  it('uses the same node and relation boundary for rendering and interaction', () => {
    const visible = deriveVisibleAdvisorGraph({
      graph,
      visibleNodeKinds: new Set(['goal', 'investment']),
      visibleLinkKinds: new Set(['related_to']),
    })

    expect(visible.nodes.map(node => node.label)).toEqual(['Apport immobilier', 'ETF Monde'])
    expect(visible.links).toEqual([
      { source: 'goal:one', target: 'investment:one', kind: 'related_to' },
    ])
    expect(visible.meta.nodeCount).toBe(2)
    expect(visible.meta.linkCount).toBe(1)
  })
})

describe('searchVisibleAdvisorGraph', () => {
  it('searches human labels, summaries, and type names without indexing technical source values', () => {
    expect(searchVisibleAdvisorGraph(graph, 'immobilier').map(node => node.id)).toEqual([
      'goal:one',
    ])
    expect(searchVisibleAdvisorGraph(graph, 'objectif').map(node => node.id)).toEqual(['goal:one'])
    expect(searchVisibleAdvisorGraph(graph, 'provider-secret')).toEqual([])
  })

  it('normalizes accents and ranks stronger memories first', () => {
    expect(searchVisibleAdvisorGraph(graph, 'reference').map(node => node.id)).toEqual([
      'source:one',
    ])
  })
})
