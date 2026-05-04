import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import type {
  DashboardAdvisorDecisionJournalCreateInput,
  DashboardAdvisorDecisionJournalEntryResponse,
  DashboardAdvisorDecisionJournalListResponse,
  DashboardAdvisorDecisionOutcomeCreateInput,
  DashboardAdvisorDecisionOutcomeResponse,
} from '../advisor-contract'
import { createDecisionJournalUseCases } from '../domain/advisor/create-decision-journal-use-cases'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardAdvisorRepository, DashboardRouteRuntime } from '../types'
import { createAdvisorRoute } from './advisor'

const sampleEntry = (
  overrides?: Partial<DashboardAdvisorDecisionJournalEntryResponse>
): DashboardAdvisorDecisionJournalEntryResponse => ({
  id: 42,
  recommendationId: null,
  runId: null,
  recommendationKey: 'cash-drag',
  decision: 'accepted',
  reasonCode: 'accepted',
  freeNote: 'Reduction de cash en cours.',
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

interface JournalCalls {
  list: number
  getById: number
  create: number
  outcome: number
  knowledge: number
  llm: number
  provider: number
  lastListInput?: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
    recommendationId?: number | null
    runId?: number | null
    decision?: 'accepted' | 'rejected' | 'deferred' | 'ignored' | null
  }
  lastCreateInput?:
    | ({ mode: 'demo' | 'admin'; requestId: string } & DashboardAdvisorDecisionJournalCreateInput)
    | undefined
  lastOutcomeInput?:
    | ({
        mode: 'demo' | 'admin'
        requestId: string
        decisionId: number
      } & DashboardAdvisorDecisionOutcomeCreateInput)
    | undefined
}

const buildFakeAdvisorRepository = ({
  store,
  outcomesByDecisionId,
  onCreate,
  onList,
  onGetById,
  onOutcome,
}: {
  store: DashboardAdvisorDecisionJournalEntryResponse[]
  outcomesByDecisionId: Map<number, DashboardAdvisorDecisionOutcomeResponse[]>
  onCreate: () => void
  onList: () => void
  onGetById: () => void
  onOutcome: () => void
}): DashboardAdvisorRepository => {
  let nextDecisionId = store.reduce((max, entry) => Math.max(max, entry.id), 0) + 1
  let nextOutcomeId = 1

  type CreateInput = Parameters<DashboardAdvisorRepository['createDecisionJournalEntry']>[0]
  type ListInput = Parameters<DashboardAdvisorRepository['listDecisionJournalEntries']>[0]
  type CreateOutcomeInput = Parameters<DashboardAdvisorRepository['createDecisionOutcome']>[0]

  const journalMethods = {
    async createDecisionJournalEntry(input: CreateInput) {
      onCreate()
      const decidedAtIso = new Date().toISOString()
      const created: DashboardAdvisorDecisionJournalEntryResponse = {
        id: nextDecisionId++,
        recommendationId: input.recommendationId ?? null,
        runId: input.runId ?? null,
        recommendationKey: input.recommendationKey ?? null,
        decision: input.decision,
        reasonCode: input.reasonCode as DashboardAdvisorDecisionJournalEntryResponse['reasonCode'],
        freeNote: input.freeNote ?? null,
        decidedBy: input.decidedBy,
        decidedAt: decidedAtIso,
        expectedOutcomeAt: input.expectedOutcomeAt
          ? input.expectedOutcomeAt.toISOString()
          : null,
        scope: input.scope,
        metadata: input.metadata ?? null,
        createdAt: decidedAtIso,
        updatedAt: decidedAtIso,
        outcomes: [],
      }
      store.unshift(created)
      return { ...created, outcomes: [] }
    },
    async listDecisionJournalEntries(input: ListInput) {
      onList()
      let items = [...store].sort((a, b) => b.decidedAt.localeCompare(a.decidedAt))
      if (typeof input.recommendationId === 'number') {
        items = items.filter(item => item.recommendationId === input.recommendationId)
      }
      if (typeof input.runId === 'number') {
        items = items.filter(item => item.runId === input.runId)
      }
      if (input.decision) {
        items = items.filter(item => item.decision === input.decision)
      }
      if (input.scope) {
        items = items.filter(item => item.scope === input.scope)
      }
      items = items.slice(0, Math.max(0, Math.min(input.limit, items.length)))
      return {
        items: items.map(item => ({
          ...item,
          outcomes: (outcomesByDecisionId.get(item.id) ?? []).map(outcome => ({ ...outcome })),
        })),
      } satisfies DashboardAdvisorDecisionJournalListResponse
    },
    async getDecisionJournalEntryById(decisionId: number) {
      onGetById()
      const entry = store.find(item => item.id === decisionId)
      if (!entry) {
        return null
      }
      return {
        ...entry,
        outcomes: (outcomesByDecisionId.get(decisionId) ?? []).map(outcome => ({ ...outcome })),
      }
    },
    async createDecisionOutcome(input: CreateOutcomeInput) {
      onOutcome()
      const observedAtIso = new Date().toISOString()
      const created: DashboardAdvisorDecisionOutcomeResponse = {
        id: nextOutcomeId++,
        decisionId: input.decisionId,
        observedAt: observedAtIso,
        outcomeKind:
          input.outcomeKind as DashboardAdvisorDecisionOutcomeResponse['outcomeKind'],
        deltaMetrics: input.deltaMetrics ?? null,
        learningTags: input.learningTags ?? [],
        freeNote: input.freeNote ?? null,
        createdAt: observedAtIso,
        updatedAt: observedAtIso,
      }
      const list = outcomesByDecisionId.get(input.decisionId) ?? []
      list.push(created)
      outcomesByDecisionId.set(input.decisionId, list)
      return created
    },
    async listDecisionOutcomesByDecisionId(decisionId: number) {
      return (outcomesByDecisionId.get(decisionId) ?? []).map(outcome => ({ ...outcome }))
    },
  }
  return journalMethods as unknown as DashboardAdvisorRepository
}

const createJournalRuntime = (params?: {
  storeRef?: DashboardAdvisorDecisionJournalEntryResponse[]
  calls?: JournalCalls
}): DashboardRouteRuntime => {
  const calls: JournalCalls = params?.calls ?? {
    list: 0,
    getById: 0,
    create: 0,
    outcome: 0,
    knowledge: 0,
    llm: 0,
    provider: 0,
  }
  const store: DashboardAdvisorDecisionJournalEntryResponse[] = params?.storeRef ?? []
  const outcomesByDecisionId = new Map<number, DashboardAdvisorDecisionOutcomeResponse[]>()

  const fakeRepository = buildFakeAdvisorRepository({
    store,
    outcomesByDecisionId,
    onCreate: () => {
      calls.create += 1
    },
    onList: () => {
      calls.list += 1
    },
    onGetById: () => {
      calls.getById += 1
    },
    onOutcome: () => {
      calls.outcome += 1
    },
  })

  const journal = createDecisionJournalUseCases({ repository: fakeRepository })

  return {
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: {
      getSummary: async () => {
        throw new Error('not used')
      },
      getTransactions: async () => {
        throw new Error('not used')
      },
      requestTransactionsBackgroundRefresh: async () => false,
      updateTransactionClassification: async () => null,
      getGoals: async () => ({ items: [] }),
      createGoal: async () => {
        throw new Error('not used')
      },
      updateGoal: async () => null,
      archiveGoal: async () => null,
      getDerivedRecomputeStatus: async () => {
        throw new Error('not used')
      },
      runDerivedRecompute: async () => {
        throw new Error('not used')
      },
      // Real journal use-cases backed by the in-memory fake repository above. This makes the
      // route tests exercise the actual validation logic (e.g. expectedOutcomeAt parsing),
      // not a re-implementation of it.
      listAdvisorDecisionJournal: async (
        input: Parameters<typeof journal.listAdvisorDecisionJournal>[0]
      ) => {
        calls.lastListInput = { ...input }
        return journal.listAdvisorDecisionJournal(input)
      },
      getAdvisorDecisionJournalEntry: async (
        input: Parameters<typeof journal.getAdvisorDecisionJournalEntry>[0]
      ) => journal.getAdvisorDecisionJournalEntry(input),
      createAdvisorDecisionJournalEntry: async (
        input: Parameters<typeof journal.createAdvisorDecisionJournalEntry>[0]
      ) => {
        calls.lastCreateInput = { ...input }
        return journal.createAdvisorDecisionJournalEntry(input)
      },
      createAdvisorDecisionOutcome: async (
        input: Parameters<typeof journal.createAdvisorDecisionOutcome>[0]
      ) => {
        calls.lastOutcomeInput = { ...input }
        return journal.createAdvisorDecisionOutcome(input)
      },
      // Sentinels: any GET route that hits providers/LLM/knowledge would explode.
      getAdvisorOverview: async () => {
        calls.provider += 1
        throw new Error('GET should not call provider/LLM in journal tests')
      },
      getAdvisorKnowledgeAnswer: async () => {
        calls.knowledge += 1
        throw new Error('GET should not call knowledge service in journal tests')
      },
      postAdvisorChat: async () => {
        calls.llm += 1
        throw new Error('GET should not call LLM in journal tests')
      },
    },
  } as unknown as DashboardRouteRuntime
}

const createApp = ({
  mode,
  runtime,
  internalAuth,
}: {
  mode: 'admin' | 'demo'
  runtime?: DashboardRouteRuntime
  internalAuth?: { hasValidToken: boolean; tokenSource: string | null }
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: internalAuth ?? {
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-journal-test',
        startedAtMs: Date.now(),
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createJournalRuntime()))
    .use(createAdvisorRoute())

describe('createAdvisorRoute · decision journal', () => {
  it('lists demo journal entries in newest-first order', async () => {
    const app = createApp({ mode: 'demo' })
    const response = await app.handle(new Request('http://finance-os.local/advisor/journal'))
    const payload = (await response.json()) as DashboardAdvisorDecisionJournalListResponse

    expect(response.status).toBe(200)
    expect(payload.items.length).toBeGreaterThan(0)

    for (let i = 1; i < payload.items.length; i += 1) {
      const previous = payload.items[i - 1]?.decidedAt ?? ''
      const current = payload.items[i]?.decidedAt ?? ''
      expect(previous >= current).toBe(true)
    }
  })

  it('forbids POST /advisor/journal in demo mode', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createJournalRuntime({ calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'accepted',
          reasonCode: 'accepted',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    expect(calls.create).toBe(0)
  })

  it('creates a journal entry in admin mode and reflects newest-first ordering on subsequent list', async () => {
    const store: DashboardAdvisorDecisionJournalEntryResponse[] = []
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ storeRef: store, calls }),
    })

    const createResponse = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'rejected',
          reasonCode: 'rejected_low_confidence',
          recommendationKey: 'sector-rotation',
          freeNote: 'Confidence below threshold.',
          expectedOutcomeAt: '2026-06-01T09:00:00.000Z',
        }),
      })
    )
    const created = (await createResponse.json()) as DashboardAdvisorDecisionJournalEntryResponse

    expect(createResponse.status).toBe(201)
    expect(created.decision).toBe('rejected')
    expect(created.reasonCode).toBe('rejected_low_confidence')
    expect(created.scope).toBe('admin')
    expect(calls.create).toBe(1)

    const listResponse = await app.handle(
      new Request('http://finance-os.local/advisor/journal?limit=5')
    )
    const listPayload =
      (await listResponse.json()) as DashboardAdvisorDecisionJournalListResponse

    expect(listResponse.status).toBe(200)
    expect(listPayload.items.length).toBe(1)
    expect(listPayload.items[0]?.decision).toBe('rejected')
  })

  it('filters list by recommendationId in admin mode', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal?recommendationId=999')
    )
    const payload = (await response.json()) as DashboardAdvisorDecisionJournalListResponse

    expect(response.status).toBe(200)
    expect(payload.items.length).toBe(0)
    expect(calls.lastListInput?.recommendationId).toBe(999)
  })

  it('filters list by decision kind in admin mode', async () => {
    const store: DashboardAdvisorDecisionJournalEntryResponse[] = [
      sampleEntry({ id: 1, decision: 'accepted', reasonCode: 'accepted' }),
      sampleEntry({
        id: 2,
        decision: 'rejected',
        reasonCode: 'rejected_low_confidence',
        decidedAt: '2026-04-29T09:00:00.000Z',
      }),
    ]
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ storeRef: store }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal?decision=accepted')
    )
    const payload = (await response.json()) as DashboardAdvisorDecisionJournalListResponse

    expect(response.status).toBe(200)
    expect(payload.items.every(item => item.decision === 'accepted')).toBe(true)
  })

  it('rejects an invalid decision kind on POST', async () => {
    const app = createApp({ mode: 'admin' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'frozen',
          reasonCode: 'accepted',
        }),
      })
    )

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('rejects an invalid reasonCode on POST', async () => {
    const app = createApp({ mode: 'admin' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'accepted',
          reasonCode: 'because_i_said_so',
        }),
      })
    )

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('creates an outcome for an existing decision in admin mode', async () => {
    const store: DashboardAdvisorDecisionJournalEntryResponse[] = [sampleEntry({ id: 88 })]
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ storeRef: store, calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal/88/outcomes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outcomeKind: 'positive',
          learningTags: ['cash_drag'],
          freeNote: 'Allocation cible atteinte.',
        }),
      })
    )
    const payload = (await response.json()) as DashboardAdvisorDecisionOutcomeResponse

    expect(response.status).toBe(201)
    expect(payload.outcomeKind).toBe('positive')
    expect(payload.decisionId).toBe(88)
    expect(calls.outcome).toBe(1)
  })

  it('returns 404 when posting an outcome to a non-existent decision', async () => {
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime(),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal/777/outcomes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outcomeKind: 'neutral',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(404)
    expect(payload.code).toBe('NOT_FOUND')
  })

  it('does not invoke LLM/provider/knowledge use-cases on journal GET', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ calls }),
    })

    const response = await app.handle(new Request('http://finance-os.local/advisor/journal'))

    expect(response.status).toBe(200)
    expect(calls.knowledge).toBe(0)
    expect(calls.llm).toBe(0)
    expect(calls.provider).toBe(0)
  })

  it('rejects a structurally plausible but invalid expectedOutcomeAt with a 4xx', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'accepted',
          reasonCode: 'accepted',
          // Passes the ISO regex but is not a real instant: month 13, day 45.
          expectedOutcomeAt: '2026-13-45T12:00:00Z',
        }),
      })
    )
    const payload = (await response.json()) as { code: string; message?: string }

    expect(response.status).toBe(422)
    expect(payload.code).toBe('INVALID_EXPECTED_OUTCOME_AT')
    // Validation must happen before any repository write.
    expect(calls.create).toBe(0)
  })

  it('accepts a valid ISO expectedOutcomeAt on POST', async () => {
    const store: DashboardAdvisorDecisionJournalEntryResponse[] = []
    const app = createApp({
      mode: 'admin',
      runtime: createJournalRuntime({ storeRef: store }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'deferred',
          reasonCode: 'deferred_need_more_data',
          expectedOutcomeAt: '2026-06-01T09:30:00.000Z',
        }),
      })
    )
    const created = (await response.json()) as DashboardAdvisorDecisionJournalEntryResponse

    expect(response.status).toBe(201)
    expect(created.expectedOutcomeAt).toBe('2026-06-01T09:30:00.000Z')
  })

  it('rejects POST /advisor/journal when only an internal token is presented (no admin session)', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createJournalRuntime({ calls }),
      internalAuth: {
        hasValidToken: true,
        tokenSource: 'x-internal-token',
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision: 'accepted',
          reasonCode: 'accepted',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    expect(calls.create).toBe(0)
  })

  it('rejects POST /advisor/journal/:decisionId/outcomes when only an internal token is presented', async () => {
    const calls: JournalCalls = {
      list: 0,
      getById: 0,
      create: 0,
      outcome: 0,
      knowledge: 0,
      llm: 0,
      provider: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createJournalRuntime({
        storeRef: [sampleEntry({ id: 99 })],
        calls,
      }),
      internalAuth: {
        hasValidToken: true,
        tokenSource: 'x-internal-token',
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/journal/99/outcomes', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          outcomeKind: 'positive',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    expect(calls.outcome).toBe(0)
  })
})
