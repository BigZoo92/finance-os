import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from './auth-types'
import { fetchXHealth, type XHealthResponse } from './x-twitter-api'

export const xHealthQueryKeys = {
  all: ['x-health'] as const,
  status: (mode?: AuthMode) => [...xHealthQueryKeys.all, ...(mode ? [mode] : [])] as const,
}

const getDemoXHealth = (): XHealthResponse => ({
  ok: true,
  mode: 'demo',
  source: 'demo_fixture',
  enabled: true,
  configured: true,
  tokenPresent: false,
  budgetStatus: 'healthy',
  lastDailyRunStartedAt: '2026-04-09T07:30:00.000Z',
  lastDailyRunStatus: 'success',
  dailySyncSchedulerEnabled: false,
  requestId: 'demo-x-health',
})

export const xHealthQueryOptionsWithMode = ({ mode }: { mode?: AuthMode | undefined }) =>
  queryOptions({
    queryKey: xHealthQueryKeys.status(mode),
    queryFn: () => (mode === 'demo' ? getDemoXHealth() : fetchXHealth()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })
