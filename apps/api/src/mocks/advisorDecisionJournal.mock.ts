import type {
  DashboardAdvisorDecisionJournalEntryResponse,
  DashboardAdvisorDecisionJournalListResponse,
} from '../routes/dashboard/advisor-contract'

const DEMO_ENTRIES: DashboardAdvisorDecisionJournalEntryResponse[] = [
  {
    id: 1,
    recommendationId: null,
    runId: null,
    recommendationKey: 'cash-drag',
    decision: 'accepted',
    reasonCode: 'accepted',
    freeNote: 'Reduction du cash en cours sur le PEA.',
    decidedBy: 'admin',
    decidedAt: '2026-04-12T09:00:00.000Z',
    expectedOutcomeAt: '2026-05-12T09:00:00.000Z',
    scope: 'demo',
    metadata: null,
    createdAt: '2026-04-12T09:00:00.000Z',
    updatedAt: '2026-04-12T09:00:00.000Z',
    outcomes: [
      {
        id: 1,
        decisionId: 1,
        observedAt: '2026-04-30T09:00:00.000Z',
        outcomeKind: 'positive',
        deltaMetrics: { cashAllocationPctDelta: -3.5 },
        learningTags: ['cash_drag', 'pea'],
        freeNote: 'Allocation cash ramenee dans la bande cible.',
        createdAt: '2026-04-30T09:00:00.000Z',
        updatedAt: '2026-04-30T09:00:00.000Z',
      },
    ],
  },
  {
    id: 2,
    recommendationId: null,
    runId: null,
    recommendationKey: 'sector-rotation',
    decision: 'deferred',
    reasonCode: 'deferred_need_more_data',
    freeNote: 'On attend la confirmation des prochains signaux macro.',
    decidedBy: 'admin',
    decidedAt: '2026-04-22T09:00:00.000Z',
    expectedOutcomeAt: null,
    scope: 'demo',
    metadata: null,
    createdAt: '2026-04-22T09:00:00.000Z',
    updatedAt: '2026-04-22T09:00:00.000Z',
    outcomes: [],
  },
  {
    id: 3,
    recommendationId: null,
    runId: null,
    recommendationKey: 'crypto-rebalance',
    decision: 'rejected',
    reasonCode: 'rejected_risk_mismatch',
    freeNote: 'Au-dela du budget de risque crypto fixe.',
    decidedBy: 'admin',
    decidedAt: '2026-04-28T09:00:00.000Z',
    expectedOutcomeAt: null,
    scope: 'demo',
    metadata: null,
    createdAt: '2026-04-28T09:00:00.000Z',
    updatedAt: '2026-04-28T09:00:00.000Z',
    outcomes: [],
  },
]

export const getAdvisorDecisionJournalMock = (): DashboardAdvisorDecisionJournalListResponse => ({
  items: DEMO_ENTRIES.map(entry => ({
    ...entry,
    outcomes: entry.outcomes.map(outcome => ({ ...outcome })),
  })),
})

export const getAdvisorDecisionJournalEntryMock = (
  decisionId: number
): DashboardAdvisorDecisionJournalEntryResponse | null => {
  const match = DEMO_ENTRIES.find(entry => entry.id === decisionId)
  if (!match) {
    return null
  }
  return {
    ...match,
    outcomes: match.outcomes.map(outcome => ({ ...outcome })),
  }
}
