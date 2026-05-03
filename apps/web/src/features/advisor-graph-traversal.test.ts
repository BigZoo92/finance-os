import { describe, expect, it } from 'vitest'
import {
  buildAdvisorDemoGraph,
  findShortestPath,
  getNeighborhood,
  linkKey,
  type AdvisorGraph,
} from './advisor-graph-data'
import {
  ADVISOR_GRAPH_LENSES,
  ADVISOR_GRAPH_LENS_BY_ID,
  ADVISOR_GRAPH_QUICK_FILTERS,
  ADVISOR_GRAPH_TOURS,
} from './advisor-graph-lenses'

const tinyGraph: AdvisorGraph = {
  nodes: [
    { id: 'a', label: 'A', kind: 'concept' },
    { id: 'b', label: 'B', kind: 'recommendation' },
    { id: 'c', label: 'C', kind: 'risk' },
    { id: 'd', label: 'D', kind: 'source' },
    { id: 'e', label: 'E', kind: 'asset' },
  ],
  links: [
    { source: 'a', target: 'b', kind: 'supports' },
    { source: 'b', target: 'c', kind: 'affects' },
    { source: 'c', target: 'd', kind: 'derived_from' },
    { source: 'a', target: 'e', kind: 'mentions' },
  ],
  meta: {
    origin: 'real',
    summary: 'tiny',
    nodeCount: 5,
    linkCount: 4,
    realNodeCount: 5,
    exampleNodeCount: 0,
  },
}

describe('linkKey', () => {
  it('produces a stable directional key', () => {
    expect(linkKey({ source: 'a', target: 'b', kind: 'supports' })).toBe('a::supports::b')
    expect(linkKey({ source: 'b', target: 'a', kind: 'supports' })).toBe('b::supports::a')
  })
})

describe('findShortestPath', () => {
  it('returns null when from === to', () => {
    expect(findShortestPath(tinyGraph, 'a', 'a')).toBeNull()
  })

  it('returns null when either id is missing', () => {
    expect(findShortestPath(tinyGraph, 'a', 'zzz')).toBeNull()
    expect(findShortestPath(tinyGraph, 'zzz', 'a')).toBeNull()
  })

  it('finds the BFS shortest path over undirected edges', () => {
    const path = findShortestPath(tinyGraph, 'a', 'd')
    expect(path).not.toBeNull()
    if (!path) return
    expect(path.nodes.map(n => n.id)).toEqual(['a', 'b', 'c', 'd'])
    expect(path.links).toHaveLength(3)
    expect(path.linkKeys.has('a::supports::b')).toBe(true)
    expect(path.nodeIds.has('c')).toBe(true)
  })

  it('walks edges in both directions (treats links as undirected)', () => {
    // Reverse direction — same path should still resolve.
    const path = findShortestPath(tinyGraph, 'd', 'a')
    expect(path).not.toBeNull()
    if (!path) return
    expect(path.nodes.map(n => n.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('returns null when no path exists', () => {
    const disconnected: AdvisorGraph = {
      ...tinyGraph,
      nodes: [
        ...tinyGraph.nodes,
        { id: 'orphan', label: 'Orphan', kind: 'unknown' },
      ],
    }
    expect(findShortestPath(disconnected, 'a', 'orphan')).toBeNull()
  })

  it('finds a path inside the curated demo graph', () => {
    const demo = buildAdvisorDemoGraph()
    const fromId = 'snapshot:me'
    const toId = 'concept:diversification'
    const path = findShortestPath(demo, fromId, toId)
    expect(path).not.toBeNull()
    if (!path) return
    expect(path.nodes[0]?.id).toBe(fromId)
    expect(path.nodes[path.nodes.length - 1]?.id).toBe(toId)
    // All path links must exist among the demo's links.
    const demoLinkKeys = new Set(demo.links.map(linkKey))
    for (const k of path.linkKeys) {
      // Direction-neutral check (BFS is undirected, link could be reversed).
      const [src, kind, tgt] = k.split('::')
      const reversed = `${tgt}::${kind}::${src}`
      expect(demoLinkKeys.has(k) || demoLinkKeys.has(reversed)).toBe(true)
    }
  })
})

describe('getNeighborhood', () => {
  it('returns just the seed at depth 0', () => {
    expect(Array.from(getNeighborhood(tinyGraph, 'b', 0))).toEqual(['b'])
  })

  it('expands one step', () => {
    const set = getNeighborhood(tinyGraph, 'b', 1)
    expect(set.has('b')).toBe(true)
    expect(set.has('a')).toBe(true)
    expect(set.has('c')).toBe(true)
    expect(set.has('d')).toBe(false)
  })

  it('expands further at higher depth', () => {
    const set = getNeighborhood(tinyGraph, 'b', 2)
    expect(set.has('d')).toBe(true)
    expect(set.has('e')).toBe(true)
  })

  it('returns just the seed when seed is unknown', () => {
    expect(Array.from(getNeighborhood(tinyGraph, 'zzz', 3))).toEqual(['zzz'])
  })
})

describe('ADVISOR_GRAPH_LENSES integrity', () => {
  it('every lens id is unique and the by-id map matches', () => {
    const ids = ADVISOR_GRAPH_LENSES.map(l => l.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const lens of ADVISOR_GRAPH_LENSES) {
      expect(ADVISOR_GRAPH_LENS_BY_ID[lens.id]).toBe(lens)
    }
  })

  it('every lens has at least one included kind', () => {
    for (const lens of ADVISOR_GRAPH_LENSES) {
      expect(lens.includedKinds.length).toBeGreaterThan(0)
    }
  })

  it('emphasized kinds are a subset of included kinds for each lens', () => {
    for (const lens of ADVISOR_GRAPH_LENSES) {
      const included = new Set(lens.includedKinds)
      for (const k of lens.emphasizedKinds) {
        expect(included.has(k)).toBe(true)
      }
    }
  })

  it('a lens starter, when defined, picks a node belonging to the demo graph', () => {
    const demo = buildAdvisorDemoGraph()
    for (const lens of ADVISOR_GRAPH_LENSES) {
      if (!lens.pickStarter) continue
      const node = lens.pickStarter(demo)
      if (node === null) continue
      expect(demo.nodes.some(n => n.id === node.id)).toBe(true)
    }
  })
})

describe('ADVISOR_GRAPH_TOURS integrity', () => {
  it('every tour points to a valid lens id', () => {
    const lensIds = new Set(ADVISOR_GRAPH_LENSES.map(l => l.id))
    for (const tour of ADVISOR_GRAPH_TOURS) {
      expect(lensIds.has(tour.lensId)).toBe(true)
    }
  })

  it('every tour starter is either null or a node in the demo graph', () => {
    const demo = buildAdvisorDemoGraph()
    for (const tour of ADVISOR_GRAPH_TOURS) {
      const node = tour.pickStarter(demo)
      if (node === null) continue
      expect(demo.nodes.some(n => n.id === node.id)).toBe(true)
    }
  })

  it('tour ids are unique', () => {
    const ids = ADVISOR_GRAPH_TOURS.map(t => t.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})

describe('ADVISOR_GRAPH_QUICK_FILTERS integrity', () => {
  it('quick filter ids are unique', () => {
    const ids = ADVISOR_GRAPH_QUICK_FILTERS.map(f => f.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('predicates pick the expected nodes in the demo graph', () => {
    const demo = buildAdvisorDemoGraph()
    const stale = ADVISOR_GRAPH_QUICK_FILTERS.find(f => f.id === 'stale_only')
    const high = ADVISOR_GRAPH_QUICK_FILTERS.find(f => f.id === 'high_confidence_only')
    const personal = ADVISOR_GRAPH_QUICK_FILTERS.find(f => f.id === 'personal_only')
    const fragile = ADVISOR_GRAPH_QUICK_FILTERS.find(f => f.id === 'contradictions_only')
    expect(stale).toBeDefined()
    expect(high).toBeDefined()
    expect(personal).toBeDefined()
    expect(fragile).toBeDefined()
    if (!stale || !high || !personal || !fragile) return
    expect(demo.nodes.some(n => stale.predicate(n))).toBe(true)
    expect(demo.nodes.some(n => high.predicate(n))).toBe(true)
    expect(demo.nodes.some(n => personal.predicate(n))).toBe(true)
    expect(demo.nodes.some(n => fragile.predicate(n))).toBe(true)
  })
})
