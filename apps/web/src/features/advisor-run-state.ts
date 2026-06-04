import {
  OPERATION_CANCELLED_CODE,
  PARENT_OPERATION_COMPLETED_CODE,
  STALE_PARENT_OPERATION_FAILED_CODE,
  STALE_TIMED_OUT_CODE,
} from '@finance-os/ai/manual-operation-recovery'
import { isAiRunActiveStatus, isAiRunTerminalStatus } from '@finance-os/ai/run-status'
import type { DashboardAdvisorManualOperationResponse } from './dashboard-types'

export type AdvisorManualOperationUiStatus =
  | DashboardAdvisorManualOperationResponse['status']
  | 'skipped'

const isManualOperationActiveStatus = (
  status: DashboardAdvisorManualOperationResponse['status']
) => status === 'queued' || status === 'running'

export const resolveAdvisorManualOperationUiStatus = (
  operation: DashboardAdvisorManualOperationResponse | null | undefined
): AdvisorManualOperationUiStatus | null => {
  if (!operation) {
    return null
  }

  if (!isManualOperationActiveStatus(operation.status)) {
    return operation.status
  }

  const advisorRunStatus = operation.advisorRun?.status
  if (!advisorRunStatus || isAiRunActiveStatus(advisorRunStatus)) {
    return operation.status
  }

  if (!isAiRunTerminalStatus(advisorRunStatus)) {
    return operation.status
  }

  if (advisorRunStatus === 'completed') {
    return 'completed'
  }

  if (advisorRunStatus === 'failed') {
    return 'failed'
  }

  return advisorRunStatus === 'skipped' ? 'skipped' : 'degraded'
}

export const isAdvisorManualOperationActive = (
  operation: DashboardAdvisorManualOperationResponse | null | undefined
) => {
  const uiStatus = resolveAdvisorManualOperationUiStatus(operation)
  return uiStatus === 'queued' || uiStatus === 'running'
}

export type ManualOperationErrorCategory =
  | 'recovered_stale'
  | 'recovered_timeout'
  | 'cancelled'
  | 'real_error'

export type ManualOperationErrorDescriptor = {
  category: ManualOperationErrorCategory
  /** Short, human badge label (FR). Never a raw machine code. */
  label: string
  /** One readable sentence for admins (FR). */
  detail: string
  /** Whether a naive "Relancer" affordance makes sense for this item. */
  actionable: boolean
  /** True for items closed automatically by recovery (not a current incident). */
  recovered: boolean
}

/**
 * Map a manual operation / step error code to readable admin copy.
 *
 * Recovery-produced codes (stale parent, timeout, parent completed, cancelled)
 * are presented as "incident ancien recupere" / "etape cloturee" rather than a
 * red, actionable failure. Genuine run errors surface their message as-is.
 *
 * Returns null when there is no error code (nothing to describe).
 */
export const describeManualOperationError = (
  errorCode: string | null | undefined,
  errorMessage?: string | null
): ManualOperationErrorDescriptor | null => {
  if (!errorCode) {
    return null
  }

  switch (errorCode) {
    case STALE_PARENT_OPERATION_FAILED_CODE:
    case PARENT_OPERATION_COMPLETED_CODE:
      return {
        category: 'recovered_stale',
        label: 'incident ancien recupere',
        detail:
          "Etape cloturee automatiquement lors d'une recuperation: l'operation parente etait deja terminee.",
        actionable: false,
        recovered: true,
      }
    case STALE_TIMED_OUT_CODE:
      return {
        category: 'recovered_timeout',
        label: 'recupere (timeout)',
        detail:
          'Run non finalise dans le delai imparti, cloture automatiquement par la recovery.',
        actionable: false,
        recovered: true,
      }
    case OPERATION_CANCELLED_CODE:
      return {
        category: 'cancelled',
        label: 'annule',
        detail: "Run annule via l'UI ou un appel admin.",
        actionable: true,
        recovered: true,
      }
    default:
      return {
        category: 'real_error',
        label: 'echec',
        detail: errorMessage?.trim() || 'Echec technique du run.',
        actionable: true,
        recovered: false,
      }
  }
}
