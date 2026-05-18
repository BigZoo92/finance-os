import type { DashboardAdvisorManualOperationResponse } from '@/features/dashboard-types'

/**
 * Mirrors `RefreshJobStatus` in apps/api/src/routes/ops/refresh-registry.ts.
 * Keep both in sync when adding/removing variants.
 */
export type RefreshJobStatus =
  | 'queued'
  | 'running'
  | 'success'
  | 'partial'
  | 'failed'
  | 'timed_out'
  | 'cancelled'
  | 'skipped'
  | 'skipped_disabled'
  | 'skipped_missing_config'
  | 'skipped_budget'
  | 'skipped_dependency_failed'

export type RefreshJobDefinition = {
  id: string
  label: string
  description: string
  domain: 'banking' | 'transactions' | 'investments' | 'news' | 'markets' | 'social' | 'advisor'
  dependencies: string[]
  enabled: boolean
  manualTriggerAllowed: boolean
  scheduleGroup: 'daily-intelligence' | 'manual-only'
  timeoutMs: number
  retryPolicy: {
    maxAttempts: number
    backoffMs: number
  }
}

export type RefreshJobsResponse = {
  requestId: string
  mode: 'demo' | 'admin'
  jobs: RefreshJobDefinition[]
}

export type RefreshStatusResponse = {
  requestId: string
  mode: 'demo' | 'admin'
  jobs: RefreshJobDefinition[]
  latestRun: DashboardAdvisorManualOperationResponse | null
  history: DashboardAdvisorManualOperationResponse[]
}

export type RefreshJobRunResponse = {
  jobId: string
  status: RefreshJobStatus
  requestId: string
  runId: string | null
  startedAt: string
  finishedAt: string
  durationMs: number
  message: string | null
  details: Record<string, unknown> | null
}
