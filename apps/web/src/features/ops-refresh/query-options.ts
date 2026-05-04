import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '@/features/auth-types'
import { fetchRefreshJobs, fetchRefreshStatus } from './api'
import type { RefreshJobsResponse, RefreshStatusResponse } from './types'

export const opsRefreshQueryKeys = {
  all: ['ops-refresh'] as const,
  jobs: () => [...opsRefreshQueryKeys.all, 'jobs'] as const,
  status: () => [...opsRefreshQueryKeys.all, 'status'] as const,
}

const getDemoJobs = (): RefreshJobsResponse => ({
  requestId: 'demo-ops-refresh',
  mode: 'demo',
  jobs: [
    {
      id: 'powens',
      label: 'Powens',
      description: 'Demo: aucune synchronisation provider.',
      domain: 'banking',
      dependencies: [],
      enabled: true,
      manualTriggerAllowed: false,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 90000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
    {
      id: 'advisor-context',
      label: 'AI advisor context & conseil',
      description: 'Demo: contexte deterministe fixture.',
      domain: 'advisor',
      dependencies: ['powens'],
      enabled: true,
      manualTriggerAllowed: false,
      scheduleGroup: 'daily-intelligence',
      timeoutMs: 120000,
      retryPolicy: { maxAttempts: 1, backoffMs: 0 },
    },
  ],
})

const getDemoStatus = (): RefreshStatusResponse => ({
  ...getDemoJobs(),
  latestRun: null,
  history: [],
})

export const opsRefreshJobsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: opsRefreshQueryKeys.jobs(),
    queryFn: () => (mode === 'demo' ? getDemoJobs() : fetchRefreshJobs()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const opsRefreshStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: opsRefreshQueryKeys.status(),
    queryFn: () => (mode === 'demo' ? getDemoStatus() : fetchRefreshStatus()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 0,
    refetchInterval: query => {
      if (mode !== 'admin') {
        return false
      }
      const latest = query.state.data?.latestRun
      return latest?.status === 'queued' || latest?.status === 'running' ? 3000 : false
    },
  })
