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
