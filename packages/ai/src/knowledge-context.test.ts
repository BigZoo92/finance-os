import { describe, expect, test } from 'bun:test'
import {
  compactKnowledgeContextForPrompt,
  estimateKnowledgeContextTokens,
  type KnowledgeContextBundle,
} from './knowledge-context'

const bundle: KnowledgeContextBundle = {
  requestId: 'test',
  mode: 'demo',
  generatedAt: '2026-04-26T00:00:00.000Z',
  query: 'cash drag',
  maxTokens: 64,
  tokenEstimate: 8,
  summary: 'Cash drag is opportunity cost from excess unallocated cash.',
  entities: [],
  relations: [],
  graphPaths: [],
  evidence: [],
  contradictoryEvidence: [],
  assumptions: [],
  unknowns: ['No live admin facts in demo mode.'],
  retrievalExplanation: [],
  confidence: 0.8,
  recency: 1,
  provenance: [],
  degraded: false,
  fallbackReason: null,
}

describe('knowledge context helpers', () => {
  test('estimates and compacts prompt context deterministically', () => {
    expect(estimateKnowledgeContextTokens(bundle)).toBeGreaterThan(1)
    const compact = compactKnowledgeContextForPrompt({ bundle, maxTokens: 12 })
    expect(compact).toContain('Knowledge graph context')
    expect(compact.length).toBeLessThanOrEqual(48)
  })
})
