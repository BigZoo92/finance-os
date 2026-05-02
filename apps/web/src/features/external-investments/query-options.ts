import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '../auth-types'
import {
  getDemoExternalInvestmentCashFlows,
  getDemoExternalInvestmentPositions,
  getDemoExternalInvestmentStatus,
  getDemoExternalInvestmentSummary,
  getDemoExternalInvestmentSyncRuns,
  getDemoExternalInvestmentTrades,
} from './demo-data'
import {
  fetchExternalInvestmentCashFlows,
  fetchExternalInvestmentPositions,
  fetchExternalInvestmentStatus,
  fetchExternalInvestmentSummary,
  fetchExternalInvestmentSyncRuns,
  fetchExternalInvestmentTrades,
} from './api'

export const externalInvestmentsQueryKeys = {
  all: ['external-investments'] as const,
  summary: () => [...externalInvestmentsQueryKeys.all, 'summary'] as const,
  positions: () => [...externalInvestmentsQueryKeys.all, 'positions'] as const,
  trades: (limit: number) => [...externalInvestmentsQueryKeys.all, 'trades', limit] as const,
  cashFlows: (limit: number) =>
    [...externalInvestmentsQueryKeys.all, 'cash-flows', limit] as const,
  status: () => [...externalInvestmentsQueryKeys.all, 'status'] as const,
  syncRuns: () => [...externalInvestmentsQueryKeys.all, 'sync-runs'] as const,
}

export const externalInvestmentsSummaryQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.summary(),
    queryFn: () => (mode === 'demo' ? getDemoExternalInvestmentSummary() : fetchExternalInvestmentSummary()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsPositionsQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.positions(),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentPositions() : fetchExternalInvestmentPositions(),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsTradesQueryOptionsWithMode = ({
  mode,
  limit = 50,
}: {
  mode?: AuthMode
  limit?: number
} = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.trades(limit),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentTrades() : fetchExternalInvestmentTrades(limit),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsCashFlowsQueryOptionsWithMode = ({
  mode,
  limit = 50,
}: {
  mode?: AuthMode
  limit?: number
} = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.cashFlows(limit),
    queryFn: () =>
      mode === 'demo'
        ? getDemoExternalInvestmentCashFlows()
        : fetchExternalInvestmentCashFlows(limit),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsStatusQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.status(),
    queryFn: () => (mode === 'demo' ? getDemoExternalInvestmentStatus() : fetchExternalInvestmentStatus()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const externalInvestmentsSyncRunsQueryOptionsWithMode = ({
  mode,
}: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.syncRuns(),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentSyncRuns() : fetchExternalInvestmentSyncRuns(),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })
