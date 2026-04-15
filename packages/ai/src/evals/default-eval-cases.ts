import type { AiEvalCaseSeed } from '../types'

export const DEFAULT_AI_EVAL_CASES: AiEvalCaseSeed[] = [
  {
    key: 'transaction-ambiguous-transfer',
    category: 'transaction_classification',
    description:
      'Ambiguous bank wording should remain low-confidence and avoid over-asserting spend categories.',
    input: {
      label: 'VIR INST RECU PERSO',
      amount: 450,
      merchant: '',
    },
    expectation: {
      maxConfidence: 0.65,
      allowedKinds: ['transfer', 'cash_movement', 'reimbursement'],
    },
  },
  {
    key: 'recommendation-needs-evidence',
    category: 'recommendation_quality',
    description: 'A recommendation with weak evidence should be softened or flagged.',
    input: {
      evidenceCount: 1,
      confidence: 0.88,
      contradictorySignals: 2,
    },
    expectation: {
      maxConfidence: 0.75,
      allowedStatuses: ['softened', 'flagged'],
    },
  },
  {
    key: 'challenger-detects-weak-causality',
    category: 'challenger',
    description: 'Macro noise should not automatically justify drastic portfolio changes.',
    input: {
      recommendationType: 'increase_prudence',
      evidence: ['Single headline about sanctions'],
    },
    expectation: {
      statusShouldNotBe: 'confirmed',
    },
  },
  {
    key: 'insufficient-data-degrades',
    category: 'data_sufficiency',
    description: 'Sparse portfolio data should trigger degraded messaging and bounded confidence.',
    input: {
      totalValue: 0,
      recommendationCount: 0,
    },
    expectation: {
      requiresDegradedState: true,
    },
  },
  {
    key: 'budget-overrun-disables-deep',
    category: 'cost_control',
    description: 'When daily budget is mostly consumed, deep analysis should be disabled.',
    input: {
      dailyUsdSpent: 0.8,
      dailyBudgetUsd: 1,
    },
    expectation: {
      deepAnalysisAllowed: false,
    },
  },
]
