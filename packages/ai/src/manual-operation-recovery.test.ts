import { describe, expect, it } from 'bun:test'
import {
  PARENT_OPERATION_COMPLETED_CODE,
  STALE_PARENT_OPERATION_FAILED_CODE,
  isManualOperationRecoveryErrorCode,
  reconcileManualOperationStepForDisplay,
  resolveOrphanStepClosure,
  shouldCloseOrphanedStep,
} from './manual-operation-recovery'

describe('manual operation orphan-step recovery', () => {
  it('closes a running step when the parent operation is failed (prod incident)', () => {
    expect(shouldCloseOrphanedStep('running', 'failed')).toBe(true)
    const closure = resolveOrphanStepClosure('failed')
    expect(closure.status).toBe('failed')
    expect(closure.errorCode).toBe(STALE_PARENT_OPERATION_FAILED_CODE)
  })

  it('does not keep a child active when the parent operation is degraded', () => {
    expect(shouldCloseOrphanedStep('running', 'degraded')).toBe(true)
    const reconciled = reconcileManualOperationStepForDisplay(
      { status: 'running', errorCode: null, errorMessage: null },
      'degraded'
    )
    // Reconciled step is terminal => never rendered as "en cours".
    expect(reconciled.status).toBe('failed')
    expect(['queued', 'running']).not.toContain(reconciled.status)
    expect(reconciled.errorCode).toBe(STALE_PARENT_OPERATION_FAILED_CODE)
  })

  it('marks an orphan step under a completed parent as skipped (benign, not failed)', () => {
    const closure = resolveOrphanStepClosure('completed')
    expect(closure.status).toBe('skipped')
    expect(closure.errorCode).toBe(PARENT_OPERATION_COMPLETED_CODE)
    const reconciled = reconcileManualOperationStepForDisplay(
      { status: 'queued', errorCode: null, errorMessage: null },
      'completed'
    )
    expect(reconciled.status).toBe('skipped')
  })

  it('leaves a step untouched while its parent is still active', () => {
    expect(shouldCloseOrphanedStep('running', 'running')).toBe(false)
    const step = { status: 'running', errorCode: null, errorMessage: null } as const
    expect(reconcileManualOperationStepForDisplay(step, 'running')).toBe(step)
  })

  it('preserves an existing terminal step status and its original error', () => {
    const step = {
      status: 'completed' as const,
      errorCode: null,
      errorMessage: null,
    }
    expect(reconcileManualOperationStepForDisplay(step, 'failed')).toBe(step)

    const failedStep = {
      status: 'running' as const,
      errorCode: 'REAL_PROVIDER_ERROR',
      errorMessage: 'boom',
    }
    const reconciled = reconcileManualOperationStepForDisplay(failedStep, 'failed')
    // status is closed, but the genuine error code/message is preserved.
    expect(reconciled.status).toBe('failed')
    expect(reconciled.errorCode).toBe('REAL_PROVIDER_ERROR')
    expect(reconciled.errorMessage).toBe('boom')
  })

  it('classifies recovery error codes vs real run errors', () => {
    expect(isManualOperationRecoveryErrorCode(STALE_PARENT_OPERATION_FAILED_CODE)).toBe(true)
    expect(isManualOperationRecoveryErrorCode('STALE_TIMED_OUT')).toBe(true)
    expect(isManualOperationRecoveryErrorCode('CANCELLED')).toBe(true)
    expect(isManualOperationRecoveryErrorCode('MANUAL_REFRESH_AND_RUN_FAILED')).toBe(false)
    expect(isManualOperationRecoveryErrorCode(null)).toBe(false)
  })
})
