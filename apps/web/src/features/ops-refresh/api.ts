import { apiFetch } from '@/lib/api'
import type { DashboardAdvisorManualOperationResponse } from '@/features/dashboard-types'
import type {
  RefreshJobRunResponse,
  RefreshJobsResponse,
  RefreshRunExecutionResponse,
  RefreshStatusResponse,
} from './types'

export const fetchRefreshJobs = () => apiFetch<RefreshJobsResponse>('/ops/refresh/jobs')

export const fetchRefreshStatus = () => apiFetch<RefreshStatusResponse>('/ops/refresh/status')

export const runFullRefresh = () =>
  apiFetch<RefreshRunExecutionResponse>('/ops/refresh/all', {
    method: 'POST',
    body: JSON.stringify({ trigger: 'manual' }),
  })

export const runRefreshJob = (jobId: string) =>
  apiFetch<RefreshJobRunResponse>(`/ops/refresh/jobs/${encodeURIComponent(jobId)}/run`, {
    method: 'POST',
    body: JSON.stringify({ trigger: 'manual' }),
  })

export type RecoverStaleRunsResponse = {
  ok: boolean
  requestId: string
  recoveredCount: number
  skippedCount: number
  recovered: DashboardAdvisorManualOperationResponse[]
  skipped: DashboardAdvisorManualOperationResponse[]
  warning?: string
}

/**
 * Default to a 30-minute stale threshold — matches the recovery sweeper
 * documented in docs/ops/refresh-orchestrator.md. Caller can override.
 */
export const recoverStaleRuns = (staleAfterMs = 30 * 60 * 1000) =>
  apiFetch<RecoverStaleRunsResponse>('/ops/refresh/stale-runs/recover', {
    method: 'POST',
    body: JSON.stringify({ staleAfterMs }),
  })

export const cancelRefreshRun = (runId: string) =>
  apiFetch<{ ok: boolean; requestId: string; run: DashboardAdvisorManualOperationResponse }>(
    `/ops/refresh/runs/${encodeURIComponent(runId)}/cancel`,
    { method: 'POST' }
  )
