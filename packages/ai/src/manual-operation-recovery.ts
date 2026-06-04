/**
 * Shared taxonomy + helpers for AI manual operation recovery.
 *
 * Source of truth for both the API (write-side cascade + recovery sweep) and
 * the web UI (readable admin copy, recovered-vs-real-error distinction).
 *
 * Invariant enforced across the system: when an `ai_manual_operation` reaches a
 * terminal status, none of its `ai_manual_operation_step` rows may stay active.
 * A step left `running`/`queued` under a terminal parent is an *orphan* and is
 * auto-closed by recovery (it is not a current, actionable error).
 */

export const MANUAL_OPERATION_TERMINAL_STATUSES = ['completed', 'failed', 'degraded'] as const
export type ManualOperationTerminalStatus = (typeof MANUAL_OPERATION_TERMINAL_STATUSES)[number]

export const MANUAL_OPERATION_STEP_ACTIVE_STATUSES = ['queued', 'running'] as const
export type ManualOperationStepActiveStatus =
  (typeof MANUAL_OPERATION_STEP_ACTIVE_STATUSES)[number]

export type ManualOperationStepStatus =
  | 'queued'
  | 'running'
  | 'completed'
  | 'failed'
  | 'degraded'
  | 'skipped'

/** Machine error codes set by recovery/cleanup paths (never raw user errors). */
export const STALE_PARENT_OPERATION_FAILED_CODE = 'STALE_PARENT_OPERATION_FAILED'
export const STALE_TIMED_OUT_CODE = 'STALE_TIMED_OUT'
export const PARENT_OPERATION_COMPLETED_CODE = 'PARENT_OPERATION_COMPLETED'
export const OPERATION_CANCELLED_CODE = 'CANCELLED'

export const MANUAL_OPERATION_RECOVERY_ERROR_CODES = [
  STALE_PARENT_OPERATION_FAILED_CODE,
  STALE_TIMED_OUT_CODE,
  PARENT_OPERATION_COMPLETED_CODE,
  OPERATION_CANCELLED_CODE,
] as const

export const isManualOperationTerminalStatus = (
  status: string
): status is ManualOperationTerminalStatus =>
  (MANUAL_OPERATION_TERMINAL_STATUSES as readonly string[]).includes(status)

export const isManualOperationStepActiveStatus = (
  status: string
): status is ManualOperationStepActiveStatus =>
  (MANUAL_OPERATION_STEP_ACTIVE_STATUSES as readonly string[]).includes(status)

/**
 * True when an error code was produced by a recovery/cleanup path rather than a
 * real run failure. Recovered items must not be presented as current incidents
 * and must not naively offer a "retry" affordance.
 */
export const isManualOperationRecoveryErrorCode = (code: string | null | undefined): boolean =>
  typeof code === 'string' &&
  (MANUAL_OPERATION_RECOVERY_ERROR_CODES as readonly string[]).includes(code)

export type ManualOperationStepClosure = {
  status: Extract<ManualOperationStepStatus, 'failed' | 'skipped'>
  errorCode: string
  errorMessage: string
}

/**
 * Closure applied to an orphaned active step given its (terminal) parent state.
 *
 * - parent `completed`: the step never finished but the operation succeeded, so
 *   it is `skipped` (benign) rather than `failed` (which would read as a real
 *   error on a successful run).
 * - parent `failed`/`degraded`: the step is closed as `failed` with the machine
 *   code `STALE_PARENT_OPERATION_FAILED` (matches the prod cleanup convention).
 */
export const resolveOrphanStepClosure = (
  parentStatus: ManualOperationTerminalStatus
): ManualOperationStepClosure => {
  if (parentStatus === 'completed') {
    return {
      status: 'skipped',
      errorCode: PARENT_OPERATION_COMPLETED_CODE,
      errorMessage:
        'Step was still active while the parent operation already completed; closed during stale recovery.',
    }
  }
  return {
    status: 'failed',
    errorCode: STALE_PARENT_OPERATION_FAILED_CODE,
    errorMessage:
      'Step was still running while the parent operation was already terminal; closed during stale recovery.',
  }
}

/** A step is an orphan when it is active but its parent operation is terminal. */
export const shouldCloseOrphanedStep = (stepStatus: string, parentStatus: string): boolean =>
  isManualOperationStepActiveStatus(stepStatus) && isManualOperationTerminalStatus(parentStatus)

export type ReconcilableManualOperationStep = {
  status: ManualOperationStepStatus
  errorCode: string | null
  errorMessage: string | null
}

/**
 * Pure display reconciliation. Defensive complement to the write-side cascade
 * and the recovery sweep: any step left active under a terminal parent is
 * presented as auto-closed so it can never render a false "en cours". Existing
 * error codes/messages are preserved when already set.
 */
export const reconcileManualOperationStepForDisplay = <T extends ReconcilableManualOperationStep>(
  step: T,
  parentStatus: string
): T => {
  if (!shouldCloseOrphanedStep(step.status, parentStatus)) {
    return step
  }
  const closure = resolveOrphanStepClosure(parentStatus as ManualOperationTerminalStatus)
  return {
    ...step,
    status: closure.status,
    errorCode: step.errorCode ?? closure.errorCode,
    errorMessage: step.errorMessage ?? closure.errorMessage,
  }
}
