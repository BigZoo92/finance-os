import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it } from 'vitest'
import {
  dashboardAdvisorChatQueryOptionsWithMode,
  dashboardAdvisorJournalQueryOptionsWithMode,
  dashboardQueryKeys,
  LEARNING_LOOP_INVALIDATION_KEYS,
  removeDashboardQueriesForAuthTransition,
} from './dashboard-query-options'

describe('dashboard Advisor Chat query keys', () => {
  it('isolates Demo and Admin conversations in separate cache entries', () => {
    const demoKey = dashboardAdvisorChatQueryOptionsWithMode({
      mode: 'demo',
      threadKey: 'default',
    }).queryKey
    const adminKey = dashboardAdvisorChatQueryOptionsWithMode({
      mode: 'admin',
      threadKey: 'default',
    }).queryKey

    expect(demoKey).not.toEqual(adminKey)
    expect(demoKey).toEqual([...dashboardQueryKeys.advisorChat('default'), 'demo'])
    expect(adminKey).toEqual([...dashboardQueryKeys.advisorChat('default'), 'admin'])
  })
})

describe('dashboard Advisor journal cache boundaries', () => {
  it('isolates Demo and Admin journals in separate cache entries', () => {
    const demoKey = dashboardAdvisorJournalQueryOptionsWithMode({
      mode: 'demo',
      limit: 4,
    }).queryKey
    const adminKey = dashboardAdvisorJournalQueryOptionsWithMode({
      mode: 'admin',
      limit: 4,
    }).queryKey

    expect(demoKey).not.toEqual(adminKey)
    expect(demoKey).toEqual([
      ...dashboardQueryKeys.advisorJournalScope('demo'),
      4,
      null,
      null,
      null,
    ])
    expect(adminKey).toEqual([
      ...dashboardQueryKeys.advisorJournalScope('admin'),
      4,
      null,
      null,
      null,
    ])
  })

  it('scopes journal invalidation to the active auth mode', () => {
    expect(LEARNING_LOOP_INVALIDATION_KEYS.afterDecisionJournal('admin')[0]).toEqual(
      dashboardQueryKeys.advisorJournalScope('admin')
    )
    expect(LEARNING_LOOP_INVALIDATION_KEYS.afterDecisionJournal('demo')[0]).toEqual(
      dashboardQueryKeys.advisorJournalScope('demo')
    )
  })

  it('removes the full dashboard namespace during an auth transition', () => {
    const queryClient = new QueryClient()
    const adminJournalKey = dashboardQueryKeys.advisorJournal({ limit: 4 }, 'admin')
    const demoJournalKey = dashboardQueryKeys.advisorJournal({ limit: 4 }, 'demo')
    const unrelatedKey = ['knowledge', 'stats', 'admin'] as const

    queryClient.setQueryData(adminJournalKey, { items: [{ freeNote: 'admin-only' }] })
    queryClient.setQueryData(demoJournalKey, { items: [] })
    queryClient.setQueryData(unrelatedKey, { nodeCount: 1 })

    removeDashboardQueriesForAuthTransition(queryClient)

    expect(queryClient.getQueryData(adminJournalKey)).toBeUndefined()
    expect(queryClient.getQueryData(demoJournalKey)).toBeUndefined()
    expect(queryClient.getQueryData(unrelatedKey)).toEqual({ nodeCount: 1 })
  })
})
