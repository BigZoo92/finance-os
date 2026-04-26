import { apiFetch } from '@/lib/api'
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
