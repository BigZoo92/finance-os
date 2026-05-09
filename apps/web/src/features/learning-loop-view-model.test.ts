import { describe, expect, it } from 'vitest'
import {
  buildDecisionPayload,
  buildEvalScorecard,
  buildHypothesisCreatePayload,
  buildPostMortemFeed,
  describePostMortemRunStatus,
  defaultReasonCode,
  groupForCategory,
  reasonCodesForDecision,
  readHypothesisExtras,
  splitLines,
  summarizePostMortemRunResponse,
} from './learning-loop-view-model'
import type {
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorPostMortemRow,
  DashboardAdvisorPostMortemRunResponse,
} from './dashboard-types'

describe('learning-loop-view-model', () => {
  describe('decision payload', () => {
    it('reasonCodesForDecision returns only codes that apply to that decision (plus "other")', () => {
      const accepted = reasonCodesForDecision('accepted').map(c => c.value)
      expect(accepted).toContain('accepted')
      expect(accepted).toContain('other')
      expect(accepted).not.toContain('rejected_low_confidence')

      const deferred = reasonCodesForDecision('deferred').map(c => c.value)
      expect(deferred).toContain('deferred_need_more_data')
      expect(deferred).toContain('other')
    })

    it('defaultReasonCode picks the natural code, never "other" when one exists', () => {
      expect(defaultReasonCode('accepted')).toBe('accepted')
      expect(defaultReasonCode('deferred')).toBe('deferred_need_more_data')
      expect(defaultReasonCode('ignored')).toBe('ignored_no_action')
    })

    it('builds a clean payload from the form state', () => {
      const result = buildDecisionPayload({
        recommendationId: 42,
        recommendationKey: 'cash-drag',
        runId: 7,
        state: {
          decision: 'accepted',
          reasonCode: 'accepted',
          freeNote: '  En cours sur le PEA  ',
          expectedOutcomeAt: '2026-06-30',
        },
      })
      expect(result.ok).toBe(true)
      expect(result.payload).toEqual({
        recommendationId: 42,
        recommendationKey: 'cash-drag',
        runId: 7,
        decision: 'accepted',
        reasonCode: 'accepted',
        freeNote: 'En cours sur le PEA',
        expectedOutcomeAt: '2026-06-30T00:00:00.000Z',
      })
    })

    it('rejects invalid expectedOutcomeAt without firing the API call', () => {
      const result = buildDecisionPayload({
        recommendationId: 1,
        recommendationKey: null,
        state: {
          decision: 'deferred',
          reasonCode: 'deferred_need_more_data',
          freeNote: '',
          expectedOutcomeAt: 'definitely-not-a-date',
        },
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/Date/)
    })

    it('rejects free notes longer than the API max length', () => {
      const result = buildDecisionPayload({
        recommendationId: 1,
        recommendationKey: null,
        state: {
          decision: 'rejected',
          reasonCode: 'rejected_low_confidence',
          freeNote: 'a'.repeat(2001),
          expectedOutcomeAt: '',
        },
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/2000/)
    })
  })

  describe('eval scorecard', () => {
    it('groups categories into quality / safety / economics buckets', () => {
      expect(groupForCategory('transaction_classification')).toBe('quality')
      expect(groupForCategory('causal_reasoning')).toBe('quality')
      expect(groupForCategory('strategy_quality')).toBe('quality')
      expect(groupForCategory('challenger')).toBe('safety')
      expect(groupForCategory('risk_calibration')).toBe('safety')
      expect(groupForCategory('post_mortem_safety')).toBe('safety')
      expect(groupForCategory('cost_control')).toBe('economics')
    })

    it('builds an empty view-model when evals are undefined', () => {
      const view = buildEvalScorecard(undefined)
      expect(view.hasData).toBe(false)
      expect(view.run.status).toBeNull()
      expect(view.trendsAvailable).toBe(false)
    })

    it('summarises cases by group and surfaces failedCaseDetails when present', () => {
      const evals: DashboardAdvisorEvalsResponse = {
        cases: [
          {
            id: 1,
            caseKey: 'a',
            category: 'causal_reasoning',
            description: 'd1',
            input: {},
            expectation: {},
            active: true,
          },
          {
            id: 2,
            caseKey: 'b',
            category: 'risk_calibration',
            description: 'd2',
            input: {},
            expectation: {},
            active: true,
          },
          {
            id: 3,
            caseKey: 'c',
            category: 'cost_control',
            description: 'd3',
            input: {},
            expectation: {},
            active: true,
          },
        ],
        latestRun: {
          id: 99,
          runId: 100,
          status: 'degraded',
          totalCases: 3,
          passedCases: 2,
          failedCases: 1,
          summary: {
            failedCaseKeys: ['a'],
            failedCaseDetails: [
              {
                caseId: 'a',
                category: 'causal_reasoning',
                failedExpectations: ['missing_uncertainty_markers'],
              },
            ],
          },
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      }
      const view = buildEvalScorecard(evals)
      expect(view.hasData).toBe(true)
      const groupLabels = view.groups.map(g => g.group)
      expect(groupLabels).toEqual(['quality', 'safety', 'economics'])
      const quality = view.groups.find(g => g.group === 'quality')
      expect(quality?.rows.map(r => r.category)).toEqual(['causal_reasoning'])
      expect(view.run.failedCaseKeys).toEqual(['a'])
      expect(view.run.failedCaseDetails).toEqual([
        {
          caseId: 'a',
          category: 'causal_reasoning',
          failedExpectations: ['missing_uncertainty_markers'],
        },
      ])
    })

    it('tolerates missing failedCaseDetails without throwing', () => {
      const evals: DashboardAdvisorEvalsResponse = {
        cases: [],
        latestRun: {
          id: 1,
          runId: null,
          status: 'completed',
          totalCases: 0,
          passedCases: 0,
          failedCases: 0,
          summary: { failedCaseKeys: [] },
          createdAt: '2026-05-01T00:00:00.000Z',
        },
      }
      const view = buildEvalScorecard(evals)
      expect(view.run.failedCaseDetails).toEqual([])
    })
  })

  describe('post-mortem feed + run-status mapping', () => {
    it('describes each run status with a stable French label', () => {
      const completed = describePostMortemRunStatus('completed')
      expect(completed.tone).toBe('success')
      const disabled = describePostMortemRunStatus('skipped_disabled')
      expect(disabled.tone).toBe('info')
      expect(disabled.label).toMatch(/Désactivé/)
      const blocked = describePostMortemRunStatus('skipped_budget_blocked')
      expect(blocked.tone).toBe('warn')
      const failed = describePostMortemRunStatus('failed')
      expect(failed.tone).toBe('error')
    })

    it('builds feed rows from raw post-mortem responses, surfacing graphIngest deferral', () => {
      const rows: DashboardAdvisorPostMortemRow[] = [
        {
          id: 1,
          runId: null,
          recommendationId: null,
          decisionId: null,
          recommendationKey: 'cash-drag',
          status: 'completed',
          horizonDays: 30,
          evaluatedAt: '2026-04-30T09:00:00.000Z',
          expectedOutcomeAt: null,
          inputSummary: null,
          findings: { summary: 'résumé', overallOutcome: 'mixed' },
          calibration: { previousConfidence: 'high', calibratedConfidence: 'medium' },
          learningActions: [
            {
              kind: 'caveat',
              title: 'Plafonner la confiance',
              description: 'Détail',
              scope: 'advisory-only',
              confidence: 'medium',
              appliesTo: [],
            },
          ],
          riskNotes: { graphIngest: 'deferred', scope: 'advisory-only' },
          skippedReason: null,
          errorCode: null,
          createdAt: '2026-04-30T09:00:00.000Z',
          updatedAt: '2026-04-30T09:00:00.000Z',
        },
      ]
      const feed = buildPostMortemFeed(rows)
      expect(feed.length).toBe(1)
      expect(feed[0]?.summary).toBe('résumé')
      expect(feed[0]?.calibrationFrom).toBe('high')
      expect(feed[0]?.calibrationTo).toBe('medium')
      expect(feed[0]?.learningActions[0]?.title).toBe('Plafonner la confiance')
      expect(feed[0]?.graphIngestDeferred).toBe(true)
    })

    it('summarises the run response with bounded meta lines', () => {
      const response: DashboardAdvisorPostMortemRunResponse = {
        status: 'skipped_budget_blocked',
        feature: 'post_mortem',
        evaluatedAt: '2026-05-07T12:00:00.000Z',
        totalDue: 0,
        processed: 0,
        remaining: 0,
        persistedIds: [],
        failedItems: 0,
        reason: 'deep_analysis_budget_guard',
        budgetReasons: ['deep_analysis_budget_guard'],
      }
      const summary = summarizePostMortemRunResponse(response)
      expect(summary.view.tone).toBe('warn')
      expect(summary.meta.some(line => line.includes('deep_analysis_budget_guard'))).toBe(true)
    })
  })

  describe('hypothesis form payload + extras reader', () => {
    it('reads structured parameters.hypothesis safely', () => {
      const view = readHypothesisExtras({
        hypothesis: {
          thesis: 'Post-FOMC drift mean-reverts',
          invalidationCriteria: ['drift > 72h'],
          horizon: '90d',
        },
      })
      expect(view.thesis).toBe('Post-FOMC drift mean-reverts')
      expect(view.invalidationCriteria).toEqual(['drift > 72h'])
      expect(view.horizon).toBe('90d')
    })

    it('returns safe defaults when parameters are malformed', () => {
      const view = readHypothesisExtras(null)
      expect(view.thesis).toBeNull()
      expect(view.invalidationCriteria).toEqual([])
    })

    it('splits multi-line free text on newlines', () => {
      expect(splitLines('a\nb\n\nc  ')).toEqual(['a', 'b', 'c'])
    })

    it('builds a valid create payload', () => {
      const result = buildHypothesisCreatePayload({
        name: 'Test hypothesis',
        slug: 'test-hypothesis',
        description: 'desc',
        thesis: 'thesis',
        invalidationCriteriaRaw: 'crit 1\ncrit 2',
        evidenceNotesRaw: 'evidence',
        horizon: '90d',
        status: 'draft',
      })
      expect(result.ok).toBe(true)
      expect(result.payload?.invalidationCriteria).toEqual(['crit 1', 'crit 2'])
      expect(result.payload?.evidenceNotes).toEqual(['evidence'])
      expect(result.payload?.horizon).toBe('90d')
    })

    it('rejects creation when invalidation criteria is empty', () => {
      const result = buildHypothesisCreatePayload({
        name: 'X',
        slug: 'x',
        description: '',
        thesis: '',
        invalidationCriteriaRaw: '   ',
        evidenceNotesRaw: '',
        horizon: '',
        status: 'draft',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/invalidation/i)
    })

    it('rejects an invalid slug', () => {
      const result = buildHypothesisCreatePayload({
        name: 'X',
        slug: 'Invalid Slug',
        description: '',
        thesis: '',
        invalidationCriteriaRaw: 'c1',
        evidenceNotesRaw: '',
        horizon: '',
        status: 'draft',
      })
      expect(result.ok).toBe(false)
      expect(result.error).toMatch(/slug/i)
    })
  })
})
