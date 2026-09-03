import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import type { AuthMode } from './auth-types'
import {
  knowledgeContextBundleQueryOptionsWithMode,
  knowledgeGraphQueryOptionsWithMode,
  knowledgeQueryKeys,
  knowledgeSchemaQueryOptionsWithMode,
  knowledgeSearchQueryOptionsWithMode,
  knowledgeStatsQueryOptionsWithMode,
  removeKnowledgeQueriesForAuthTransition,
} from './knowledge-query-options'
import {
  opsKnowledgeEnrichmentStatusQueryOptions,
  opsKnowledgeQueryKeys,
} from './ops-knowledge-api'

const queryKeysForMode = (mode: AuthMode) => [
  knowledgeStatsQueryOptionsWithMode({ mode }).queryKey,
  knowledgeSchemaQueryOptionsWithMode({ mode }).queryKey,
  knowledgeSearchQueryOptionsWithMode({
    mode,
    query: 'cash drag',
    retrievalMode: 'hybrid',
  }).queryKey,
  knowledgeContextBundleQueryOptionsWithMode({
    mode,
    query: 'cash drag',
    retrievalMode: 'hybrid',
  }).queryKey,
  knowledgeGraphQueryOptionsWithMode({
    mode,
    scope: 'overview',
    includeExamples: false,
    limit: 120,
  }).queryKey,
  opsKnowledgeEnrichmentStatusQueryOptions({ mode }).queryKey,
]

describe('knowledge query keys', () => {
  it('isolates every canonical Memory query between demo and admin', () => {
    const demoKeys = queryKeysForMode('demo')
    const adminKeys = queryKeysForMode('admin')

    expect(demoKeys).toHaveLength(adminKeys.length)
    for (const [index, demoKey] of demoKeys.entries()) {
      expect(demoKey.at(-1)).toBe('demo')
      expect(adminKeys[index]?.at(-1)).toBe('admin')
      expect(demoKey).not.toEqual(adminKeys[index])
    }
  })

  it('keys graph data by scope, examples flag, limit, and auth mode', () => {
    const options = knowledgeGraphQueryOptionsWithMode({
      mode: 'admin',
      scope: 'risk',
      includeExamples: true,
      limit: 75,
    })

    expect(options.queryKey).toEqual(['knowledge', 'graph', 'risk', true, 75, 'admin'])
    expect(
      knowledgeGraphQueryOptionsWithMode({
        mode: 'admin',
        scope: 'risk',
        includeExamples: true,
      }).queryKey
    ).toEqual(['knowledge', 'graph', 'risk', true, null, 'admin'])
    expect(
      knowledgeGraphQueryOptionsWithMode({
        mode: 'admin',
        scope: 'sources',
        includeExamples: false,
        limit: 25,
      }).queryKey
    ).not.toEqual(options.queryKey)
  })

  it('keeps ops readiness inside the removable knowledge namespace', () => {
    expect(opsKnowledgeQueryKeys.all).toEqual(['knowledge', 'ops'])
    expect(opsKnowledgeQueryKeys.enrichmentStatus('demo')).toEqual([
      'knowledge',
      'ops',
      'enrichment-status',
      'demo',
    ])
  })
})

describe('removeKnowledgeQueriesForAuthTransition', () => {
  it('removes demo, admin, graph, context, and ops entries without clearing unrelated data', () => {
    const queryClient = new QueryClient()
    const demoKeys = queryKeysForMode('demo')
    const adminKeys = queryKeysForMode('admin')

    for (const key of [...demoKeys, ...adminKeys]) {
      queryClient.setQueryData([...key], { cached: true })
    }
    queryClient.setQueryData(['unrelated'], { cached: true })

    removeKnowledgeQueriesForAuthTransition(queryClient)

    expect(queryClient.getQueriesData({ queryKey: knowledgeQueryKeys.all })).toEqual([])
    expect(queryClient.getQueryData(['unrelated'])).toEqual({ cached: true })
  })
})
