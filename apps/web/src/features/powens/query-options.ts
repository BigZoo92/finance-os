import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from '../auth-types'
import { getDemoPowensAuditTrail, getDemoPowensStatus, getDemoPowensSyncRuns } from '../demo-data'
import {
  fetchPowensAuditTrail,
  fetchPowensDiagnostics,
  fetchPowensStatus,
  fetchPowensSyncBacklog,
  fetchPowensSyncRuns,
} from './api'

export const powensQueryKeys = {
  all: ['powens'] as const,
  status: (mode?: AuthMode) => [...powensQueryKeys.all, 'status', ...(mode ? [mode] : [])] as const,
  syncRuns: (mode?: AuthMode) =>
    [...powensQueryKeys.all, 'sync-runs', ...(mode ? [mode] : [])] as const,
  syncBacklog: (mode?: AuthMode) =>
    [...powensQueryKeys.all, 'sync-backlog', ...(mode ? [mode] : [])] as const,
  auditTrail: (mode?: AuthMode) =>
    [...powensQueryKeys.all, 'audit-trail', ...(mode ? [mode] : [])] as const,
  diagnostics: (mode?: AuthMode) =>
    [...powensQueryKeys.all, 'diagnostics', ...(mode ? [mode] : [])] as const,
}

export const powensStatusQueryOptions = () =>
  powensStatusQueryOptionsWithMode({
    mode: 'admin',
  })

export const powensStatusQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.status(mode),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoPowensStatus()
      }

      return fetchPowensStatus()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const powensSyncRunsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.syncRuns(mode),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoPowensSyncRuns()
      }

      return fetchPowensSyncRuns()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const powensSyncBacklogQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.syncBacklog(mode),
    queryFn: () => {
      if (mode === 'demo') {
        return { syncBacklogCount: 0 }
      }

      return fetchPowensSyncBacklog()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const powensAuditTrailQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.auditTrail(mode),
    queryFn: () => {
      if (mode === 'demo') {
        return getDemoPowensAuditTrail()
      }

      return fetchPowensAuditTrail()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })

export const powensDiagnosticsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode } = {}) =>
  queryOptions({
    queryKey: powensQueryKeys.diagnostics(mode),
    queryFn: () => {
      if (mode === 'demo') {
        return {
          enabled: true,
          mode: 'demo',
          provider: 'mock',
          outcome: 'ok',
          guidance: 'Demo diagnostics are deterministic and fully local.',
          retryable: true,
          lastCheckedAt: '2026-04-04T08:00:00.000Z',
        } as const
      }

      return fetchPowensDiagnostics()
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 10_000,
  })
