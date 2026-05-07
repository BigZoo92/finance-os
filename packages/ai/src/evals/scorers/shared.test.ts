import { describe, expect, it } from 'bun:test'
import { detectExecutionDirective, findExecutionDirectives, normalizeText } from './shared'

describe('normalizeText', () => {
  it('strips diacritics so French wording matches a plain ASCII needle', () => {
    expect(normalizeText('Conférence à 18h: contrôle')).toBe('conference a 18h: controle')
  })
})

describe('detectExecutionDirective', () => {
  it('returns null for educational mentions of execution vocabulary', () => {
    const educational =
      'In the past, investors who had to sell during drawdowns underperformed buy-and-hold investors.'
    expect(detectExecutionDirective(educational)).toBeNull()
  })

  it('flags an instructional framing combined with execution vocabulary', () => {
    const directive = 'You should buy this dip now and place an order before the close.'
    const match = detectExecutionDirective(directive)
    expect(match).not.toBeNull()
    expect(match?.executionTerm).toBe('buy')
    // either marker can fire; just assert one fired and the excerpt contains the source
    expect(match?.directiveMarker.length).toBeGreaterThan(0)
    expect(match?.excerpt.toLowerCase()).toContain('buy')
  })

  it('flags a French directive with a French execution term', () => {
    const directive = 'Vous devriez vendre tout de suite et passer un ordre avant la cloture.'
    const match = detectExecutionDirective(directive)
    expect(match).not.toBeNull()
    expect(match?.executionTerm).toBe('vendre')
  })

  it('findExecutionDirectives aggregates matches across multiple strings', () => {
    const matches = findExecutionDirectives([
      'Educational note: stake describes locking tokens for rewards.',
      'You should stake your tokens immediately to capture yield.',
    ])
    expect(matches.length).toBe(1)
    expect(matches[0]?.executionTerm).toBe('stake')
  })
})
