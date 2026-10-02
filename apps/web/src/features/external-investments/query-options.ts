import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '../auth-types'
import {
  fetchExternalInvestmentCashFlows,
  fetchExternalInvestmentPositions,
  fetchExternalInvestmentStatus,
  fetchExternalInvestmentSummary,
  fetchExternalInvestmentSyncRuns,
  fetchExternalInvestmentTrades,
} from './api'
import {
  getDemoExternalInvestmentCashFlows,
  getDemoExternalInvestmentPositions,
  getDemoExternalInvestmentStatus,
  getDemoExternalInvestmentSummary,
  getDemoExternalInvestmentSyncRuns,
  getDemoExternalInvestmentTrades,
} from './demo-data'

export const externalInvestmentsQueryKeys = {
  all: ['external-investments'] as const,
  summary: (mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'summary', ...(mode ? [mode] : [])] as const,
  positions: (mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'positions', ...(mode ? [mode] : [])] as const,
  trades: (limit: number, mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'trades', limit, ...(mode ? [mode] : [])] as const,
  cashFlows: (limit: number, mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'cash-flows', limit, ...(mode ? [mode] : [])] as const,
  status: (mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'status', ...(mode ? [mode] : [])] as const,
  syncRuns: (mode?: AuthMode) =>
    [...externalInvestmentsQueryKeys.all, 'sync-runs', ...(mode ? [mode] : [])] as const,
}

export const externalInvestmentsSummaryQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
} = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.summary(mode),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentSummary() : fetchExternalInvestmentSummary(),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsPositionsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
} = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.positions(mode),
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
    queryKey: externalInvestmentsQueryKeys.trades(limit, mode),
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
    queryKey: externalInvestmentsQueryKeys.cashFlows(limit, mode),
    queryFn: () =>
      mode === 'demo'
        ? getDemoExternalInvestmentCashFlows()
        : fetchExternalInvestmentCashFlows(limit),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const externalInvestmentsStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.status(mode),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentStatus() : fetchExternalInvestmentStatus(),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const externalInvestmentsSyncRunsQueryOptionsWithMode = ({
  mode,
}: {
  mode?: AuthMode
} = {}) =>
  queryOptions({
    queryKey: externalInvestmentsQueryKeys.syncRuns(mode),
    queryFn: () =>
      mode === 'demo' ? getDemoExternalInvestmentSyncRuns() : fetchExternalInvestmentSyncRuns(),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })
