import { queryOptions } from '@tanstack/react-query'
import {
  fetchSignalHealth,
  fetchSignalItems,
  fetchSignalRuns,
  fetchSignalSources,
  type SignalSourceGroup,
} from './signals-api'

export const signalSourcesQueryOptions = (group?: SignalSourceGroup) =>
  queryOptions({
    queryKey: ['signal-sources', group ?? 'all'],
    queryFn: () => fetchSignalSources(group),
    staleTime: 30_000,
  })

export const signalRunsQueryOptions = () =>
  queryOptions({
    queryKey: ['signal-runs'],
    queryFn: fetchSignalRuns,
    staleTime: 30_000,
  })

export const signalHealthQueryOptions = () =>
  queryOptions({
    queryKey: ['signal-health'],
    queryFn: fetchSignalHealth,
    staleTime: 60_000,
  })

export const signalItemsQueryOptions = (opts?: {
  signalDomain?: string
  sourceProvider?: string
  requiresAttention?: boolean
  limit?: number
}) =>
  queryOptions({
    queryKey: ['signal-items', opts ?? {}],
    queryFn: () => fetchSignalItems(opts),
    staleTime: 30_000,
  })
