import { queryOptions } from '@tanstack/react-query'
import { apiFetch } from '@/lib/api'
import type { AuthMode } from './auth-types'
import { knowledgeQueryKeys } from './knowledge-query-options'
import type { EnrichmentStatusResponse, EnrichmentStorage } from './memory-readiness'

export type EnsureStorageResponse = {
  ok: boolean
  requestId: string
  mode?: 'admin'
  storage?: EnrichmentStorage
  lastError?: string | null
}

export const fetchOpsKnowledgeEnrichmentStatus = () =>
  apiFetch<EnrichmentStatusResponse>('/ops/knowledge/enrichment/status')

export const ensureOpsKnowledgeStorage = () =>
  apiFetch<EnsureStorageResponse>('/ops/knowledge/enrichment/ensure', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  })

export const opsKnowledgeQueryKeys = {
  all: [...knowledgeQueryKeys.all, 'ops'] as const,
  enrichmentStatus: (mode?: AuthMode) =>
    mode === undefined
      ? ([...opsKnowledgeQueryKeys.all, 'enrichment-status'] as const)
      : ([...opsKnowledgeQueryKeys.all, 'enrichment-status', mode] as const),
}

const demoStatus = (): EnrichmentStatusResponse => ({
  mode: 'demo',
  enabled: false,
  status: 'demo_read_only',
  serviceHealth: null,
  storage: null,
})

export const opsKnowledgeEnrichmentStatusQueryOptions = ({
  mode,
}: {
  mode?: AuthMode | undefined
}) =>
  queryOptions({
    queryKey: opsKnowledgeQueryKeys.enrichmentStatus(mode),
    queryFn: () =>
      mode === 'admin' ? fetchOpsKnowledgeEnrichmentStatus() : Promise.resolve(demoStatus()),
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })
