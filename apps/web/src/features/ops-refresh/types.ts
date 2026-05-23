import type { DashboardAdvisorManualOperationResponse } from '@/features/dashboard-types'

/**
 * Mirrors `RefreshJobStatus` in apps/api/src/routes/ops/refresh-registry.ts.
 * Keep both in sync when adding/removing variants.
 */
export type RefreshJobStatus =
  | 'pending'
  | 'disabled'
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
  latestTopologicalRun: RefreshRunExecutionResponse | null
  topologicalHistory: RefreshRunExecutionResponse[]
}

export type RefreshJobRunResponse = {
  jobId: string
  status: RefreshJobStatus
  requestId: string
  runId: string | null
  startedAt: string
  finishedAt: string
  durationMs: number
  recordsRead: number | null
  recordsWritten: number | null
  errorCode: string | null
  errorMessage: string | null
  retryCount: number
  message: string | null
  details: Record<string, unknown> | null
}

export type RefreshRunExecutionResponse = {
  ok: boolean
  requestId: string
  runId: string
  runKind: 'night' | 'morning' | 'manual' | 'dry_run'
  triggerSource: 'cron' | 'manual-global' | 'manual-individual' | 'internal'
  dryRun: boolean
  status: 'planned' | 'success' | 'partial' | 'failed'
  startedAt: string
  finishedAt: string
  durationMs: number
  jobs: RefreshJobRunResponse[]
  failedJobs: string[]
  disabledJobs: string[]
  operation: DashboardAdvisorManualOperationResponse | null
  warning: string | null
}
