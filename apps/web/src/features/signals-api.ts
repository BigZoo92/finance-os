import { apiFetch } from '@/lib/api'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SignalSourceGroup = 'finance' | 'ai_tech'
export type SignalSourceAttentionPolicy = 'auto' | 'always' | 'never' | 'high_only'

export interface SignalSource {
  id: number
  provider: string
  handle: string
  displayName: string
  url: string | null
  group: SignalSourceGroup
  enabled: boolean
  priority: number
  tags: string[]
  language: string
  includePatterns: string[]
  excludePatterns: string[]
  minRelevanceScore: number
  requiresAttentionPolicy: SignalSourceAttentionPolicy
  lastFetchedAt: string | null
  lastCursor: string | null
  lastError: string | null
  lastFetchedCount: number | null
  createdAt: string
  updatedAt: string
}

export interface SignalIngestionRun {
  id: number
  provider: string
  runType: string
  startedAt: string
  finishedAt: string | null
  status: string
  fetchedCount: number
  insertedCount: number
  dedupedCount: number
  classifiedCount: number
  graphIngestedCount: number
  failedCount: number
  errorSummary: string | null
  requestId: string | null
  durationMs: number | null
  createdAt: string
}

interface SignalSourcesResponse {
  ok: boolean
  items: SignalSource[]
  counts: { finance: number; ai_tech: number }
}

interface SignalSourceMutationResponse {
  ok: boolean
  source?: SignalSource
  code?: string
  message?: string
}

interface SignalRunsResponse {
  ok: boolean
  runs: SignalIngestionRun[]
}

interface SignalHealthResponse {
  ok: boolean
  providers: Record<string, { configured: boolean; enabled: boolean; reason?: string }>
  sources: { finance: number; ai_tech: number; total: number }
}

interface ManualImportResponse {
  ok: boolean
  runId?: number
  fetchedCount?: number
  insertedCount?: number
  dedupedCount?: number
  classifiedCount?: number
  graphIngestedCount?: number
  durationMs?: number
  code?: string
  message?: string
}

export interface SignalItem {
  id: number
  sourceProvider: string
  sourceType: string
  externalId: string
  url: string | null
  title: string
  body: string | null
  author: string | null
  publishedAt: string
  signalDomain: string
  relevanceScore: number
  impactScore: number
  urgencyScore: number
  requiresAttention: boolean
  attentionReason: string | null
  tickers: string[]
  sectors: string[]
  topics: string[]
  graphIngestStatus: string
  advisorIngestStatus: string
  createdAt: string
}

interface SignalItemsResponse {
  ok: boolean
  items: SignalItem[]
  total: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export const fetchSignalSources = (group?: SignalSourceGroup) => {
  const params = group ? `?group=${group}` : ''
  return apiFetch<SignalSourcesResponse>(`/dashboard/signals/sources${params}`)
}

export const createSignalSource = (input: {
  provider: string
  handle: string
  displayName: string
  url?: string
  group: SignalSourceGroup
  enabled?: boolean
  priority?: number
  tags?: string[]
  language?: string
  includePatterns?: string[]
  excludePatterns?: string[]
  minRelevanceScore?: number
  requiresAttentionPolicy?: SignalSourceAttentionPolicy
}) =>
  apiFetch<SignalSourceMutationResponse>('/dashboard/signals/sources', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

export const updateSignalSource = (
  id: number,
  input: Partial<
    Pick<
      SignalSource,
      | 'displayName'
      | 'url'
      | 'group'
      | 'enabled'
      | 'priority'
      | 'tags'
      | 'language'
      | 'includePatterns'
      | 'excludePatterns'
      | 'minRelevanceScore'
      | 'requiresAttentionPolicy'
    >
  >
) =>
  apiFetch<SignalSourceMutationResponse>(`/dashboard/signals/sources/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

export const deleteSignalSource = (id: number) =>
  apiFetch<{ ok: boolean }>(`/dashboard/signals/sources/${id}`, {
    method: 'DELETE',
  })

export const fetchSignalRuns = () =>
  apiFetch<SignalRunsResponse>('/dashboard/signals/runs')

export const fetchSignalHealth = () =>
  apiFetch<SignalHealthResponse>('/dashboard/signals/health')

export const fetchSignalItems = (opts?: {
  signalDomain?: string
  sourceProvider?: string
  requiresAttention?: boolean
  limit?: number
}) => {
  const params = new URLSearchParams()
  if (opts?.signalDomain) params.set('signalDomain', opts.signalDomain)
  if (opts?.sourceProvider) params.set('sourceProvider', opts.sourceProvider)
  if (opts?.requiresAttention) params.set('requiresAttention', 'true')
  if (opts?.limit) params.set('limit', String(opts.limit))
  const qs = params.toString()
  return apiFetch<SignalItemsResponse>(`/dashboard/signals/items${qs ? `?${qs}` : ''}`)
}

export const postManualImport = (
  items: Array<{
    text: string
    author?: string
    url?: string
    publishedAt?: string
    language?: string
    provider?: string
  }>
) =>
  apiFetch<ManualImportResponse>('/dashboard/signals/ingest/manual', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ items }),
  })
