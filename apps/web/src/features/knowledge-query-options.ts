import { type QueryClient, queryOptions } from '@tanstack/react-query'
import type { AdvisorKnowledgeGraphScope } from './advisor-graph-dto'
import type { AuthMode } from './auth-types'
import {
  fetchKnowledgeGraphDto,
  fetchKnowledgeSchema,
  fetchKnowledgeStats,
  postKnowledgeContextBundle,
  postKnowledgeQuery,
} from './knowledge-api'
import type { KnowledgeRetrievalMode } from './knowledge-types'

const withAuthMode = <TKey extends readonly unknown[]>(key: TKey, mode?: AuthMode) =>
  mode === undefined ? key : ([...key, mode] as const)

export const knowledgeQueryKeys = {
  all: ['knowledge'] as const,
  stats: (mode?: AuthMode) => withAuthMode([...knowledgeQueryKeys.all, 'stats'] as const, mode),
  schema: (mode?: AuthMode) => withAuthMode([...knowledgeQueryKeys.all, 'schema'] as const, mode),
  query: (query: string, retrievalMode: KnowledgeRetrievalMode, mode?: AuthMode) =>
    withAuthMode([...knowledgeQueryKeys.all, 'query', query, retrievalMode] as const, mode),
  contextBundle: (query: string, retrievalMode: KnowledgeRetrievalMode, mode?: AuthMode) =>
    withAuthMode(
      [...knowledgeQueryKeys.all, 'context-bundle', query, retrievalMode] as const,
      mode
    ),
  graph: (
    scope: AdvisorKnowledgeGraphScope,
    includeExamples: boolean,
    limit?: number,
    mode?: AuthMode
  ) =>
    withAuthMode(
      [...knowledgeQueryKeys.all, 'graph', scope, includeExamples, limit ?? null] as const,
      mode
    ),
}

export const removeKnowledgeQueriesForAuthTransition = (
  queryClient: Pick<QueryClient, 'removeQueries'>
) => {
  queryClient.removeQueries({ queryKey: knowledgeQueryKeys.all })
}

export const knowledgeGraphQueryOptionsWithMode = ({
  mode,
  scope,
  includeExamples,
  limit,
}: {
  mode?: AuthMode
  scope: AdvisorKnowledgeGraphScope
  includeExamples: boolean
  limit?: number
}) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.graph(scope, includeExamples, limit, mode),
    queryFn: () => {
      const args: { scope: AdvisorKnowledgeGraphScope; includeExamples: boolean; limit?: number } =
        {
          scope,
          includeExamples,
        }
      if (typeof limit === 'number') args.limit = limit
      return fetchKnowledgeGraphDto(args)
    },
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 30_000,
  })

export const knowledgeStatsQueryOptionsWithMode = ({ mode }: { mode?: AuthMode }) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.stats(mode),
    queryFn: fetchKnowledgeStats,
    enabled: mode !== undefined,
    staleTime: mode === 'demo' ? Number.POSITIVE_INFINITY : 15_000,
  })

export const knowledgeSchemaQueryOptionsWithMode = ({ mode }: { mode?: AuthMode }) =>
  queryOptions({
    queryKey: knowledgeQueryKeys.schema(mode),
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
    queryKey: knowledgeQueryKeys.query(query, retrievalMode, mode),
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
    queryKey: knowledgeQueryKeys.contextBundle(query, retrievalMode, mode),
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
