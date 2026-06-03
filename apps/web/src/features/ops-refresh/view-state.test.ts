import { describe, expect, it } from 'vitest'
import { getRecoveryFeedbackMessage, isRefreshStatusActive } from './view-state'
import type { RecoverStaleRunsResponse } from './api'

const makeRecoveryResult = (
  overrides: Partial<RecoverStaleRunsResponse>
): RecoverStaleRunsResponse => ({
  ok: true,
  requestId: 'req-recovery',
  recoveredCount: 0,
  skippedCount: 0,
  recovered: [],
  skipped: [],
  ...overrides,
})

describe('ops refresh view state', () => {
  it('treats only queued and running refresh job statuses as active', () => {
    expect(isRefreshStatusActive('queued')).toBe(true)
    expect(isRefreshStatusActive('running')).toBe(true)
    expect(isRefreshStatusActive('success')).toBe(false)
    expect(isRefreshStatusActive('partial')).toBe(false)
    expect(isRefreshStatusActive('failed')).toBe(false)
    expect(isRefreshStatusActive('degraded')).toBe(false)
    expect(isRefreshStatusActive('timed_out')).toBe(false)
  })

  it('reports background-only recovery as success', () => {
    expect(
      getRecoveryFeedbackMessage(
        makeRecoveryResult({
          recoveredCount: 2,
          backgroundRecoveredCount: 2,
        })
      )
    ).toContain('Recovery reussie')
  })

  it('reports skipped candidates as controlled recovery rather than generic failure', () => {
    expect(
      getRecoveryFeedbackMessage(
        makeRecoveryResult({
          skippedCount: 1,
          warning: 'recoverStaleAdvisorManualOperations use case is not wired.',
        })
      )
    ).toContain('Recovery controlee')
  })
})
