import { describe, expect, it } from 'vitest'
import type { DashboardAdvisorManualOperationResponse } from './dashboard-types'
import {
  isAdvisorManualOperationActive,
  resolveAdvisorManualOperationUiStatus,
} from './advisor-run-state'

const makeOperation = (
  overrides: Partial<DashboardAdvisorManualOperationResponse>
): DashboardAdvisorManualOperationResponse => ({
  operationId: 'manual-op-test',
  requestId: 'req-test',
  status: 'running',
  currentStage: 'advisor_run',
  statusMessage: 'Mission en cours',
  triggerSource: 'manual',
  startedAt: '2026-06-03T10:00:00.000Z',
  finishedAt: null,
  durationMs: null,
  degraded: false,
  errorCode: null,
  errorMessage: null,
  advisorRunId: null,
  advisorRun: null,
  steps: [],
  outputDigest: null,
  ...overrides,
})

const makeAdvisorRun = (
  status: NonNullable<DashboardAdvisorManualOperationResponse['advisorRun']>['status']
): NonNullable<DashboardAdvisorManualOperationResponse['advisorRun']> => ({
  id: 36,
  runType: 'daily',
  status,
  triggerSource: 'manual-individual',
  requestId: 'req-advisor',
  startedAt: '2026-06-03T10:00:00.000Z',
  finishedAt: status === 'running' || status === 'queued' ? null : '2026-06-03T10:01:00.000Z',
  durationMs: status === 'running' || status === 'queued' ? null : 60_000,
  degraded: status === 'degraded',
  fallbackReason: status === 'degraded' ? 'investment_context_degraded' : null,
  errorCode: null,
  errorMessage: null,
  budgetState: null,
  usageSummary: {
    totalCalls: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCostUsd: 0,
    totalCostEur: 0,
  },
})

describe('advisor manual operation UI state', () => {
  it('keeps queued/running manual operations active when the linked ai_run is also active', () => {
    const operation = makeOperation({
      advisorRunId: 36,
      advisorRun: makeAdvisorRun('running'),
    })

    expect(resolveAdvisorManualOperationUiStatus(operation)).toBe('running')
    expect(isAdvisorManualOperationActive(operation)).toBe(true)
  })

  it('treats degraded linked ai_run as terminal even if the manual operation row is still running', () => {
    const operation = makeOperation({
      advisorRunId: 36,
      advisorRun: makeAdvisorRun('degraded'),
    })

    expect(resolveAdvisorManualOperationUiStatus(operation)).toBe('degraded')
    expect(isAdvisorManualOperationActive(operation)).toBe(false)
  })

  it('does not reinterpret already terminal manual operations', () => {
    const operation = makeOperation({
      status: 'failed',
      advisorRunId: 36,
      advisorRun: makeAdvisorRun('completed'),
    })

    expect(resolveAdvisorManualOperationUiStatus(operation)).toBe('failed')
    expect(isAdvisorManualOperationActive(operation)).toBe(false)
  })
})
