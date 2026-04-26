import { queryOptions } from '@tanstack/react-query'
import type { AuthMode } from './auth-types'
import {
  fetchKnowledgeSchema,
  fetchKnowledgeStats,
  postKnowledgeContextBundle,
  postKnowledgeQuery,
} from './knowledge-api'
import type { KnowledgeRetrievalMode } from './knowledge-types'

export const knowledgeQueryKeys = {
  all: ['knowledge'] as const,
  stats: () => [...knowledgeQueryKeys.all, 'stats'] as const,
  schema: () => [...knowledgeQueryKeys.all, 'schema'] as const,
  query: (query: string, retrievalMode: KnowledgeRetrievalMode) =>
    [...knowledgeQueryKeys.all, 'query', query, retrievalMode] as const,
  contextBundle: (query: string, retrievalMode: KnowledgeRetrievalMode) =>
    [...knowledgeQueryKeys.all, 'context-bundle', query, retrievalMode] as const,
}

export const knowledgeStatsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode }) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.stats(),
    queryFn: fetchKnowledgeStats,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const knowledgeSchemaQueryOptionsWithMode = ({ mode }: { mode?: AuthMode }) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.schema(),
    queryFn: fetchKnowledgeSchema,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 60_000,
  })

export const knowledgeSearchQueryOptionsWithMode = ({
  mode,
  query,
  retrievalMode,
}: {
  mode?: AuthMode
  query: string
  retrievalMode: KnowledgeRetrievalMode
}) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.query(query, retrievalMode),
    queryFn: () => postKnowledgeQuery({ query, retrievalMode, maxResults: 10 }),
    enabled: mode !== undefined && query.trim().length > 0,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const knowledgeContextBundleQueryOptionsWithMode = ({
  mode,
  query,
  retrievalMode,
}: {
  mode?: AuthMode
  query: string
  retrievalMode: KnowledgeRetrievalMode
}) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.contextBundle(query, retrievalMode),
    queryFn: () =>
      postKnowledgeContextBundle({
        query,
        retrievalMode,
        maxResults: 8,
        maxPathDepth: 3,
        maxTokens: 900,
        advisorTask: 'knowledge-browser-preview',
      }),
    enabled: mode !== undefined && query.trim().length > 0,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })
