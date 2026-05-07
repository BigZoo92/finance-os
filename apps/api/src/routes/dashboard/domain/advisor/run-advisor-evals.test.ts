import { describe, expect, it } from 'bun:test'
import { DEFAULT_AI_EVAL_CASES, type AiBudgetState, type AiEvalCaseSeed } from '@finance-os/ai'
import type { AdvisorSnapshot, DeterministicRecommendation } from '@finance-os/finance-engine'
import { runAdvisorEvals } from './run-advisor-evals'

const baseBudget: AiBudgetState = {
  dailyUsdSpent: 0,
  monthlyUsdSpent: 0,
  dailyBudgetUsd: 1,
  monthlyBudgetUsd: 30,
  challengerAllowed: true,
  deepAnalysisAllowed: true,
  blocked: false,
  reasons: [],
}

const baseSnapshot: AdvisorSnapshot = {
  asOf: '2026-05-01',
  range: '30d',
  currency: 'EUR',
  riskProfile: 'balanced',
  targets: {} as AdvisorSnapshot['targets'],
  metrics: { totalValue: 50000 } as unknown as AdvisorSnapshot['metrics'],
  allocationBuckets: [],
  assetClassAllocations: [],
  driftSignals: [],
  scenarios: [],
  assumptions: [],
  diagnostics: {
    signalsRiskCount: 0,
    signalsOpportunityCount: 0,
    contradictorySignalCount: 0,
    topExpenseSharePct: 0,
  },
}

const sampleRecommendation: DeterministicRecommendation = {
  id: 'cash-drag',
  type: 'rebalance',
  title: 'Cash drag',
  description: 'Cash drag detected',
  category: 'opportunity',
  whyNow: 'Cash level above target',
  evidence: ['cashAllocationPct=26', 'targetCash=12'],
  assumptions: [],
  confidence: 0.6,
  riskLevel: 'low',
  expectedImpact: { summary: 'reduces drag', value: 1.2, unit: 'pct' },
  effort: 'low',
  reversibility: 'high',
  blockingFactors: [],
  alternatives: [],
  deterministicMetricsUsed: ['cashAllocationPct'],
  priorityScore: 50,
}

describe('runAdvisorEvals', () => {
  it('passes the seeded baseline when the existing categories are healthy and the new scored cases meet expectations', () => {
    // Replace the seeded cases with overrides that pass the deterministic scorers, plus the
    // existing-category cases unchanged. This isolates legacy behaviour from new scorer behaviour.
    const passingScoredOverrides: AiEvalCaseSeed[] = [
      {
        key: 'causal-passing',
        category: 'causal_reasoning',
        description: '',
        input: {
          candidateOutput: {
            whyNow:
              'There is correlation between the headline and the move; alternatives may explain part of it.',
            evidence: ['e1', 'e2'],
            alternatives: ['Liquidity-driven move'],
            confidence: 0.5,
          },
        },
        expectation: {
          maxConfidence: 0.7,
          minEvidenceCount: 2,
          requireUncertaintyMarkers: true,
          requireAlternatives: true,
        },
      },
      {
        key: 'strategy-passing',
        category: 'strategy_quality',
        description: '',
        input: {
          candidateOutput: {
            description:
              'Paper-only hypothesis with fees, slippage and drawdown considered.',
            caveats: ['Paper-only run, not financial advice'],
            invalidationCriteria: ['Stop if walk-forward Sharpe collapses'],
            tradeCount: 200,
            confidence: 0.5,
            walkForwardOutOfSampleCount: 50,
          },
        },
        expectation: {
          minTradeCount: 100,
          maxConfidenceWhenLowSample: 0.6,
          requireFeesOrSlippageMention: true,
          requireDrawdownMention: true,
          requirePaperFraming: true,
          requireInvalidationCriteria: true,
          requireWalkForwardOutOfSample: true,
        },
      },
      {
        key: 'risk-passing',
        category: 'risk_calibration',
        description: '',
        input: {
          candidateOutput: {
            whyNow: 'Data is partial and the position is concentrated; uncertainty is high.',
            description: 'Hold the position and consider DCA alternatives.',
            caveats: ['data is uncertain', 'concentration may be limited'],
            confidence: 0.4,
            riskLevel: 'high',
            flags: {
              dataStale: true,
              missingCostBasis: true,
              cryptoExposure: true,
              highConcentration: true,
              insufficientEmergencyFund: false,
            },
          },
        },
        expectation: {
          maxConfidenceWhenStale: 0.55,
          maxConfidenceWhenMissingData: 0.55,
          minRiskLevelWhenCryptoOrConcentration: 'high',
          requireCautiousLanguageWhenDegraded: true,
          forbidIncreasedRiskWhenEmergencyFundLow: true,
        },
      },
    ]

    const legacyCases = DEFAULT_AI_EVAL_CASES.filter(
      c => !['causal_reasoning', 'strategy_quality', 'risk_calibration'].includes(c.category)
    )

    const result = runAdvisorEvals({
      cases: [...legacyCases, ...passingScoredOverrides],
      snapshot: baseSnapshot,
      recommendations: [sampleRecommendation],
      budgetState: baseBudget,
      degraded: false,
    })

    expect(result.status).toBe('completed')
    expect(result.failedCases).toBe(0)
    expect(result.summary.failedCaseKeys).toEqual([])
    expect(result.summary.failedCaseDetails).toEqual([])
  })

  it('surfaces a structured failure entry when a new scored case fails', () => {
    const failingScoredCase: AiEvalCaseSeed = {
      key: 'causal-failing',
      category: 'causal_reasoning',
      description: '',
      input: {
        candidateOutput: {
          whyNow: 'The drop was caused by the announcement; certainty is high.',
          evidence: ['headline'],
          alternatives: [],
          confidence: 0.95,
        },
      },
      expectation: {
        maxConfidence: 0.6,
        minEvidenceCount: 2,
        requireUncertaintyMarkers: true,
        requireAlternatives: true,
      },
    }

    const result = runAdvisorEvals({
      cases: [failingScoredCase],
      snapshot: baseSnapshot,
      recommendations: [],
      budgetState: baseBudget,
      degraded: false,
    })

    expect(result.status).toBe('degraded')
    expect(result.failedCases).toBe(1)
    expect(result.summary.failedCaseKeys).toContain('causal-failing')
    expect(result.summary.failedCaseDetails.length).toBe(1)
    expect(result.summary.failedCaseDetails[0]?.caseId).toBe('causal-failing')
    expect(result.summary.failedCaseDetails[0]?.category).toBe('causal_reasoning')
    expect(
      (result.summary.failedCaseDetails[0]?.failedExpectations ?? []).length
    ).toBeGreaterThan(0)
  })

  it('keeps the existing budget-overrun case behaviour unchanged', () => {
    const tightBudget: AiBudgetState = {
      ...baseBudget,
      dailyUsdSpent: 0.95,
      dailyBudgetUsd: 1,
      deepAnalysisAllowed: true,
    }
    const result = runAdvisorEvals({
      cases: [
        {
          key: 'budget-overrun-disables-deep',
          category: 'cost_control',
          description: '',
          input: {},
          expectation: { deepAnalysisAllowed: false },
        },
      ],
      snapshot: baseSnapshot,
      recommendations: [],
      budgetState: tightBudget,
      degraded: false,
    })
    expect(result.summary.failedCaseKeys).toContain('budget-overrun-disables-deep')
  })

  it('keeps the existing recommendation-needs-evidence case behaviour unchanged', () => {
    const overconfident: DeterministicRecommendation = {
      ...sampleRecommendation,
      evidence: ['only one'],
      confidence: 0.95,
    }
    const result = runAdvisorEvals({
      cases: [
        {
          key: 'recommendation-needs-evidence',
          category: 'recommendation_quality',
          description: '',
          input: {},
          expectation: {},
        },
      ],
      snapshot: baseSnapshot,
      recommendations: [overconfident],
      budgetState: baseBudget,
      degraded: false,
    })
    expect(result.summary.failedCaseKeys).toContain('recommendation-needs-evidence')
  })
})
