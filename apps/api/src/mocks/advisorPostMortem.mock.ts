import type {
  DashboardAdvisorPostMortemListResponse,
  DashboardAdvisorPostMortemRow,
} from '../routes/dashboard/advisor-contract'

const DEMO_ROWS: DashboardAdvisorPostMortemRow[] = [
  {
    id: 1,
    runId: null,
    recommendationId: null,
    decisionId: null,
    recommendationKey: 'cash-drag',
    status: 'completed',
    horizonDays: 30,
    evaluatedAt: '2026-04-30T09:00:00.000Z',
    expectedOutcomeAt: '2026-04-29T09:00:00.000Z',
    inputSummary: { itemCount: 1 },
    findings: {
      summary:
        'Cash drag reduction broadly held; uncertainty remains on whether the rate path explains the move.',
      overallOutcome: 'mixed',
      evidenceReview: {
        supportedSignals: ['Cash allocation moved toward target band'],
        contradictedSignals: [],
        missingEvidence: ['No counterfactual on alternative allocations'],
        staleOrWeakEvidence: [],
      },
      outcomeDrivers: {
        likelyDrivers: ['Allocation discipline'],
        alternativeExplanations: ['Macro tailwind unrelated to the recommendation'],
        unknowns: ['Net flows from non-tracked accounts'],
      },
      lessons: {
        keep: ['Surface drift bands explicitly'],
        change: ['Cap confidence when corroborating evidence is thin'],
        avoid: ['Treating macro coincidence as causation'],
      },
    },
    calibration: {
      previousConfidence: 'high',
      calibratedConfidence: 'medium',
      rationale: 'Out-of-sample evidence was thinner than the original write-up implied.',
    },
    learningActions: [
      {
        kind: 'caveat',
        title: 'Cap confidence when corroborating evidence is thin',
        description:
          'When a recommendation cites a single-period observation, calibrated confidence must stay at or under medium until additional evidence appears.',
        scope: 'advisory-only',
        confidence: 'medium',
        appliesTo: ['advisor.recommendation.causal_reasoning'],
      },
    ],
    riskNotes: { graphIngest: 'deferred', scope: 'advisory-only' },
    skippedReason: null,
    errorCode: null,
    createdAt: '2026-04-30T09:00:00.000Z',
    updatedAt: '2026-04-30T09:00:00.000Z',
  },
]

export const getAdvisorPostMortemListMock = (): DashboardAdvisorPostMortemListResponse => ({
  items: DEMO_ROWS.map(row => ({
    ...row,
    learningActions: row.learningActions ? [...row.learningActions] : null,
  })),
})

export const getAdvisorPostMortemByIdMock = (
  id: number
): DashboardAdvisorPostMortemRow | null => {
  const found = DEMO_ROWS.find(row => row.id === id)
  if (!found) return null
  return { ...found, learningActions: found.learningActions ? [...found.learningActions] : null }
}
