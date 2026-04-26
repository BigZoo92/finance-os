import { describe, expect, test } from 'bun:test'
import { buildAdvisorKnowledgeContextQuery } from './knowledge-context'
import type { AdvisorSnapshot, DeterministicRecommendation } from './types'

const snapshot = {
  riskProfile: 'balanced',
  targets: {
    emergencyFundMonths: 6,
  },
  metrics: {
    cashDragPct: 0.8,
    emergencyFundMonths: 2,
    topPositionSharePct: 40,
  },
  driftSignals: [{ status: 'overweight' }],
} as AdvisorSnapshot

const recommendations = [
  {
    category: 'cash_optimization',
  },
] as DeterministicRecommendation[]

describe('buildAdvisorKnowledgeContextQuery', () => {
  test('keeps deterministic snapshot first and emits graph retrieval hints', () => {
    const query = buildAdvisorKnowledgeContextQuery({ snapshot, recommendations })

    expect(query.query).toContain('cash drag')
    expect(query.query).toContain('concentration risk')
    expect(query.tags).toContain('cash_optimization')
    expect(query.maxPathDepth).toBe(3)
  })
})
