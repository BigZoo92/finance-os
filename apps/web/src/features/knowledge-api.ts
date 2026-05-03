import { apiFetch } from '@/lib/api'
import type {
  AdvisorKnowledgeGraphDto,
  AdvisorKnowledgeGraphScope,
} from './advisor-graph-dto'
import type {
  KnowledgeContextBundleResponse,
  KnowledgeQueryResponse,
  KnowledgeRebuildResponse,
  KnowledgeRetrievalMode,
  KnowledgeSchemaResponse,
  KnowledgeStatsResponse,
} from './knowledge-types'

export const fetchKnowledgeStats = () =>
  apiFetch<KnowledgeStatsResponse>('/dashboard/advisor/knowledge/stats')

export const fetchKnowledgeSchema = () =>
  apiFetch<KnowledgeSchemaResponse>('/dashboard/advisor/knowledge/schema')

export const postKnowledgeQuery = (input: {
  query: string
  retrievalMode?: KnowledgeRetrievalMode
  maxResults?: number
  maxPathDepth?: number
}) =>
  apiFetch<KnowledgeQueryResponse>('/dashboard/advisor/knowledge/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

export const postKnowledgeContextBundle = (input: {
  query: string
  retrievalMode?: KnowledgeRetrievalMode
  maxResults?: number
  maxPathDepth?: number
  maxTokens?: number
  advisorTask?: string
}) =>
  apiFetch<KnowledgeContextBundleResponse>('/dashboard/advisor/knowledge/context-bundle', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })

export const postKnowledgeRebuild = () =>
  apiFetch<KnowledgeRebuildResponse>('/dashboard/advisor/knowledge/rebuild', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ includeSeed: true }),
  })

export const fetchKnowledgeGraphDto = (input: {
  scope?: AdvisorKnowledgeGraphScope
  limit?: number
  includeExamples?: boolean
}) => {
  const params = new URLSearchParams()
  if (input.scope) params.set('scope', input.scope)
  if (typeof input.limit === 'number') params.set('limit', String(input.limit))
  if (input.includeExamples === true) params.set('includeExamples', 'true')
  const qs = params.toString()
  const url = qs.length > 0
    ? `/dashboard/advisor/knowledge/graph?${qs}`
    : '/dashboard/advisor/knowledge/graph'
  return apiFetch<AdvisorKnowledgeGraphDto>(url)
}
