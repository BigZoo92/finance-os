import { describe, expect, it } from 'bun:test'
import { matchPersonaScenario } from './demo-scenario-library'

describe('demo scenario library', () => {
  it('matches keyword personas deterministically', () => {
    const student = matchPersonaScenario('Student Campus')

    expect(student.personaId).toBe('student')
    expect(student.scenarioId).toBe('student_budget')
    expect(student.boundedVariation).toBeGreaterThanOrEqual(0)
    expect(student.boundedVariation).toBeLessThanOrEqual(2)
  })

  it('falls back to hash strategy when profile has no keyword', () => {
    const first = matchPersonaScenario('profile-zeta')
    const second = matchPersonaScenario('profile-zeta')

    expect(first.personaId).toBe(second.personaId)
    expect(first.scenarioId).toBe(second.scenarioId)
    expect(first.matchReason).toBe('hash_fallback')
  })
})
