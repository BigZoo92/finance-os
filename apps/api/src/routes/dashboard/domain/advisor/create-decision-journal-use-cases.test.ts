import { describe, expect, it } from 'bun:test'
import type { DashboardAdvisorDecisionJournalEntryResponse } from '../../advisor-contract'
import type { DashboardAdvisorRepository } from '../../types'
import {
  createDecisionJournalUseCases,
  type DecisionJournalGraphIngestHook,
} from './create-decision-journal-use-cases'

const persistedEntry = (
  overrides?: Partial<DashboardAdvisorDecisionJournalEntryResponse>
): DashboardAdvisorDecisionJournalEntryResponse => ({
  id: 42,
  recommendationId: 7,
  runId: 11,
  recommendationKey: 'cash-drag',
  decision: 'accepted',
  reasonCode: 'accepted',
  freeNote: 'Will reduce cash by 5pp over the month',
  decidedBy: 'admin',
  decidedAt: '2026-04-30T09:00:00.000Z',
  expectedOutcomeAt: '2026-05-30T09:00:00.000Z',
  scope: 'admin',
  metadata: null,
  createdAt: '2026-04-30T09:00:00.000Z',
  updatedAt: '2026-04-30T09:00:00.000Z',
  outcomes: [],
  ...overrides,
})

const buildRepo = (
  overrides?: Partial<DashboardAdvisorRepository>
): DashboardAdvisorRepository => {
  const stub = (() => {
    throw new Error('not used')
  }) as unknown
  return {
    createDecisionJournalEntry: async () => persistedEntry(),
    listDecisionJournalEntries: async () => ({ items: [] }),
    getDecisionJournalEntryById: async () => null,
    createDecisionOutcome: async () => ({
      id: 1,
      decisionId: 42,
      outcomeKind: 'as_expected',
      learningTags: [],
      freeNote: null,
      createdAt: '2026-04-30T09:00:00.000Z',
    }) as unknown as Awaited<ReturnType<DashboardAdvisorRepository['createDecisionOutcome']>>,
    listDecisionOutcomes: async () => [],
    ...(stub as Record<string, never>),
    ...overrides,
  } as unknown as DashboardAdvisorRepository
}

const buildHook = () => {
  const calls: Array<{
    entry: DashboardAdvisorDecisionJournalEntryResponse
    requestId: string
  }> = []
  const hook: DecisionJournalGraphIngestHook = {
    ingestDecisionPoint: async ({ entry, requestId }) => {
      calls.push({ entry, requestId })
    },
  }
  return { hook, calls }
}

describe('createDecisionJournalUseCases · PR8 graph ingest hook', () => {
  it('fires the graph hook after a successful admin create', async () => {
    const { hook, calls } = buildHook()
    const useCases = createDecisionJournalUseCases({
      repository: buildRepo(),
      graphIngest: hook,
    })

    const created = await useCases.createAdvisorDecisionJournalEntry({
      mode: 'admin',
      requestId: 'req-1',
      decision: 'accepted',
      reasonCode: 'accepted',
      decidedBy: 'admin',
    })

    expect(created.id).toBe(42)
    expect(calls).toHaveLength(1)
    expect(calls[0]?.entry.id).toBe(42)
    expect(calls[0]?.requestId).toBe('req-1')
  })

  it('does NOT fire the graph hook in demo mode (use-case throws before hook)', async () => {
    const { hook, calls } = buildHook()
    const useCases = createDecisionJournalUseCases({
      repository: buildRepo(),
      graphIngest: hook,
    })

    let threw = false
    try {
      await useCases.createAdvisorDecisionJournalEntry({
        mode: 'demo',
        requestId: 'req-1',
        decision: 'accepted',
        reasonCode: 'accepted',
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('does NOT fire the graph hook when repository throws', async () => {
    const { hook, calls } = buildHook()
    const useCases = createDecisionJournalUseCases({
      repository: buildRepo({
        createDecisionJournalEntry: async () => {
          throw new Error('db down')
        },
      }),
      graphIngest: hook,
    })

    let threw = false
    try {
      await useCases.createAdvisorDecisionJournalEntry({
        mode: 'admin',
        requestId: 'req-1',
        decision: 'accepted',
        reasonCode: 'accepted',
      })
    } catch {
      threw = true
    }
    expect(threw).toBe(true)
    expect(calls).toHaveLength(0)
  })

  it('swallows hook errors so graph failures never leak to the caller', async () => {
    const failingHook: DecisionJournalGraphIngestHook = {
      ingestDecisionPoint: async () => {
        throw new Error('graph service down')
      },
    }
    const useCases = createDecisionJournalUseCases({
      repository: buildRepo(),
      graphIngest: failingHook,
    })

    const created = await useCases.createAdvisorDecisionJournalEntry({
      mode: 'admin',
      requestId: 'req-1',
      decision: 'accepted',
      reasonCode: 'accepted',
    })
    expect(created.id).toBe(42)
  })

  it('omits graph hook entirely when none is wired', async () => {
    const useCases = createDecisionJournalUseCases({ repository: buildRepo() })
    const created = await useCases.createAdvisorDecisionJournalEntry({
      mode: 'admin',
      requestId: 'req-1',
      decision: 'accepted',
      reasonCode: 'accepted',
    })
    expect(created.id).toBe(42)
  })
})
