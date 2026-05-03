import { describe, expect, it } from 'vitest'
import {
  mapAdvisorKnowledgeGraphDtoToViewModel,
  type AdvisorKnowledgeGraphDto,
} from './advisor-graph-dto'

const baseDto: AdvisorKnowledgeGraphDto = {
  nodes: [
    { id: 'a', label: 'A', kind: 'recommendation', origin: 'real', confidence: 0.8, importance: 0.6 },
    { id: 'b', label: 'B', kind: 'concept', origin: 'real' },
    { id: 'example:c', label: 'C', kind: 'risk', origin: 'example', confidence: 0.6 },
  ],
  links: [
    { source: 'a', target: 'b', kind: 'supports', origin: 'real', confidence: 0.9 },
    { source: 'a', target: 'example:c', kind: 'related_to', origin: 'example' },
  ],
  meta: {
    origin: 'mixed',
    generatedAt: '2026-04-26T00:00:00.000Z',
    scope: 'overview',
    nodeCount: 3,
    linkCount: 2,
    freshness: 'fresh',
    redacted: true,
    source: 'advisor-artifacts',
  },
}

describe('mapAdvisorKnowledgeGraphDtoToViewModel', () => {
  it('maps DTO nodes/links 1:1 into the renderer view-model', () => {
    const view = mapAdvisorKnowledgeGraphDtoToViewModel(baseDto)
    expect(view.nodes).toHaveLength(3)
    expect(view.links).toHaveLength(2)
    expect(view.nodes[0]?.id).toBe('a')
    expect(view.links[0]?.kind).toBe('supports')
  })

  it('translates DTO origin = "example" to view-model isExample = true', () => {
    const view = mapAdvisorKnowledgeGraphDtoToViewModel(baseDto)
    const example = view.nodes.find(n => n.id === 'example:c')
    const real = view.nodes.find(n => n.id === 'a')
    expect(example?.isExample).toBe(true)
    expect(real?.isExample).toBeUndefined()
  })

  it('forwards confidence/importance and skips undefined optional fields', () => {
    const view = mapAdvisorKnowledgeGraphDtoToViewModel(baseDto)
    const a = view.nodes.find(n => n.id === 'a')
    expect(a?.confidence).toBe(0.8)
    expect(a?.importance).toBe(0.6)
    const b = view.nodes.find(n => n.id === 'b')
    expect(b?.confidence).toBeUndefined()
    expect(b?.importance).toBeUndefined()
  })

  it('counts realNodeCount / exampleNodeCount in the view-model meta', () => {
    const view = mapAdvisorKnowledgeGraphDtoToViewModel(baseDto)
    expect(view.meta.realNodeCount).toBe(2)
    expect(view.meta.exampleNodeCount).toBe(1)
  })

  it('translates DTO meta.origin = "degraded" to view-model "empty"', () => {
    const dto: AdvisorKnowledgeGraphDto = {
      ...baseDto,
      nodes: [],
      links: [],
      meta: { ...baseDto.meta, origin: 'degraded', degraded: true, reason: 'service down' },
    }
    const view = mapAdvisorKnowledgeGraphDtoToViewModel(dto)
    expect(view.meta.origin).toBe('empty')
    expect(view.meta.degraded).toBe(true)
    expect(view.meta.summary).toBe('service down')
  })
})
