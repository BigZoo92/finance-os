/**
 * Free Firehose client API used by the Social job detail in Orchestration.
 *
 * The standalone /signaux/free-firehose page was removed in
 * RESET-AUDIT-CLEANUP-0; the backend endpoints, orchestrator, table and env
 * flags are all still live. These fetchers/types keep those manual actions
 * behind the existing authenticated server contracts.
 */
import { apiFetch } from '@/lib/api'

export type FreeFirehoseEstimateResponse = {
  ok: boolean
  requestId: string
  maxRecords?: number
  providers?: Array<{ id: string; maxRecords: number }>
  weeklyCap?: number
  runsLastWeek?: number
  wouldBeBlockedByCap?: boolean
  requiresConfirmation?: boolean
  llmEnrichmentEnabled?: boolean
  code?: string
  message?: string
}

export type FreeFirehoseRunResponse = {
  ok: boolean
  requestId: string
  runId?: string
  mode?: 'dry_run' | 'live'
  status?: 'running' | 'success' | 'partial' | 'failed' | 'cancelled' | 'skipped_quota'
  counts?: {
    fetched: number
    inserted: number
    deduped: number
    skipped: number
    failed: number
  }
  providerBreakdown?: Record<
    string,
    {
      fetchedCount: number
      insertedCount: number
      dedupedCount: number
      failedCount: number
      errorCodes: string[]
    }
  >
  durationMs?: number
  estimatedMaxRecords?: number
  errorSummary?: string | null
  ingestionRunId?: number | null
  code?: string
  message?: string
}

export const estimateFreeFirehose = () =>
  apiFetch<FreeFirehoseEstimateResponse>('/dashboard/admin/free-firehose/estimate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })

export const runFreeFirehose = (body: { dryRun?: boolean; confirmation?: boolean }) =>
  apiFetch<FreeFirehoseRunResponse>('/dashboard/admin/free-firehose/run', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
