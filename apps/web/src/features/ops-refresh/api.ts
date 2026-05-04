import { apiFetch } from '@/lib/api'
import type { RefreshJobRunResponse, RefreshJobsResponse, RefreshStatusResponse } from './types'

export const fetchRefreshJobs = () => apiFetch<RefreshJobsResponse>('/ops/refresh/jobs')

export const fetchRefreshStatus = () => apiFetch<RefreshStatusResponse>('/ops/refresh/status')

export const runFullRefresh = () =>
  apiFetch<{
    ok: boolean
    requestId: string
    alreadyRunning: boolean
    operation: RefreshStatusResponse['latestRun']
  }>('/ops/refresh/all', {
    method: 'POST',
    body: JSON.stringify({ trigger: 'manual' }),
  })

export const runRefreshJob = (jobId: string) =>
  apiFetch<RefreshJobRunResponse>(`/ops/refresh/jobs/${encodeURIComponent(jobId)}/run`, {
    method: 'POST',
    body: JSON.stringify({ trigger: 'manual' }),
  })
