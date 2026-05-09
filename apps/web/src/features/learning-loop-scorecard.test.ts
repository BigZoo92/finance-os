import { describe, expect, it } from 'vitest'
import {
  SCORECARD_FLAG_TONE,
  SCORECARD_GRADE_LABEL_FR,
  SCORECARD_GRADE_TONE,
} from './learning-loop-view-model'
import type {
  DashboardTradingLabStrategyScorecardEvidenceGrade,
  DashboardTradingLabStrategyScorecardQualityFlag,
} from './dashboard-types'

const ALL_GRADES: DashboardTradingLabStrategyScorecardEvidenceGrade[] = [
  'insufficient',
  'weak',
  'promising',
  'strong_but_unproven',
  'invalidated',
]

const ALL_FLAG_SEVERITIES: DashboardTradingLabStrategyScorecardQualityFlag['severity'][] = [
  'info',
  'warning',
  'danger',
]

describe('Strategy scorecard view-model constants', () => {
  it('exposes a French label for every evidence grade', () => {
    for (const grade of ALL_GRADES) {
      const label = SCORECARD_GRADE_LABEL_FR[grade]
      expect(typeof label).toBe('string')
      expect(label.length).toBeGreaterThan(0)
    }
  })

  it('uses the canonical French copy required by the spec', () => {
    expect(SCORECARD_GRADE_LABEL_FR.insufficient).toBe('Evidence insuffisante')
    expect(SCORECARD_GRADE_LABEL_FR.weak).toBe('Fragile')
    expect(SCORECARD_GRADE_LABEL_FR.promising).toBe('Prometteur')
    expect(SCORECARD_GRADE_LABEL_FR.strong_but_unproven).toBe('Solide mais non prouvé')
    expect(SCORECARD_GRADE_LABEL_FR.invalidated).toBe('Invalidé')
  })

  it('assigns a tone to every grade', () => {
    for (const grade of ALL_GRADES) {
      expect(['success', 'info', 'warning', 'danger', 'muted']).toContain(
        SCORECARD_GRADE_TONE[grade]
      )
    }
    // Spot check: invalidated must surface as danger so the UI tone matches the meaning.
    expect(SCORECARD_GRADE_TONE.invalidated).toBe('danger')
    expect(SCORECARD_GRADE_TONE.strong_but_unproven).toBe('success')
    expect(SCORECARD_GRADE_TONE.insufficient).toBe('muted')
  })

  it('assigns a tone to every quality-flag severity', () => {
    for (const severity of ALL_FLAG_SEVERITIES) {
      expect(['info', 'warning', 'danger']).toContain(SCORECARD_FLAG_TONE[severity])
    }
  })

  it('never uses execution vocabulary in any constant', () => {
    const banned = ['buy', 'sell', 'execute', 'execution', 'place order', 'leverage']
    const wb = (term: string) =>
      term.includes(' ')
        ? new RegExp(term, 'i')
        : new RegExp(`\\b${term}\\b`, 'i')
    const allText = Object.values(SCORECARD_GRADE_LABEL_FR).join(' ')
    for (const term of banned) {
      expect(wb(term).test(allText)).toBe(false)
    }
  })
})
