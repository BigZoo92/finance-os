import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { getAdvisorPostMortemListMock } from '../../../mocks/advisorPostMortem.mock'
import type {
  DashboardAdvisorPostMortemListResponse,
  DashboardAdvisorPostMortemRow,
  DashboardAdvisorPostMortemRunResponse,
} from '../advisor-contract'
import { createDashboardRuntimePlugin } from '../plugin'
import type { DashboardRouteRuntime, DashboardUseCases } from '../types'
import { createAdvisorRoute } from './advisor'

// PR4-fix — route-level tests for the new advisor post-mortem endpoints.
//
// Mirrors the PR1 journal test pattern: import `createAdvisorRoute` directly, plug a fake
// runtime via `createDashboardRuntimePlugin`, and stub the three new use-cases with call
// counters. The advisor route module deliberately does not import DB or LLM client code at
// module-load time, so this approach is safe in Bun's loader without sandbox workarounds.

interface PostMortemCalls {
  list: number
  getById: number
  run: number
  llm: number
  provider: number
  knowledge: number
  graph: number
  lastListLimit?: number
  lastGetByIdInput?: number
  lastRunTriggerSource?: string
}

type RunStubKind =
  | { kind: 'completed' }
  | { kind: 'skipped_disabled' }
  | { kind: 'skipped_budget_blocked' }
  | { kind: 'skipped_no_due_items' }
  | { kind: 'failed'; reason?: string }

const buildRunResponse = (
  stub: RunStubKind,
  evaluatedAt = '2026-05-07T12:00:00.000Z'
): DashboardAdvisorPostMortemRunResponse => {
  const base: DashboardAdvisorPostMortemRunResponse = {
    status: 'completed',
    feature: 'post_mortem',
    evaluatedAt,
    totalDue: 0,
    processed: 0,
    remaining: 0,
    persistedIds: [],
    failedItems: 0,
    reason: null,
    budgetReasons: [],
  }
  switch (stub.kind) {
    case 'completed':
      return { ...base, status: 'completed', totalDue: 2, processed: 2, persistedIds: [11, 12] }
    case 'skipped_disabled':
      return {
        ...base,
        status: 'skipped_disabled',
        reason: 'AI_POST_MORTEM_ENABLED is false',
      }
    case 'skipped_budget_blocked':
      return {
        ...base,
        status: 'skipped_budget_blocked',
        reason: 'deep_analysis_budget_guard',
        budgetReasons: ['deep_analysis_budget_guard'],
      }
    case 'skipped_no_due_items':
      return {
        ...base,
        status: 'skipped_no_due_items',
        reason: 'no_recommendations_due_for_post_mortem',
      }
    case 'failed':
      return {
        ...base,
        status: 'failed',
        totalDue: 1,
        failedItems: 1,
        reason: stub.reason ?? 'llm_call_failed',
      }
  }
}

const adminListFixture: DashboardAdvisorPostMortemRow[] = [
  {
    id: 51,
    runId: null,
    recommendationId: 7,
    decisionId: null,
    recommendationKey: 'cash-drag',
    status: 'completed',
    horizonDays: 30,
    evaluatedAt: '2026-04-30T09:00:00.000Z',
    expectedOutcomeAt: '2026-04-29T09:00:00.000Z',
    inputSummary: { itemCount: 1 },
    findings: { summary: 'admin-side test row' },
    learningActions: [],
    calibration: null,
    riskNotes: null,
    skippedReason: null,
    errorCode: null,
    createdAt: '2026-04-30T09:00:00.000Z',
    updatedAt: '2026-04-30T09:00:00.000Z',
  },
]

const createPostMortemRuntime = (params?: {
  calls?: PostMortemCalls
  runStub?: RunStubKind
  // When `mode === 'admin'`, this stubbed list is what the route sees from the use-case.
  // The demo branch lives in the use-case factory and reads `getAdvisorPostMortemListMock()`
  // directly, so the route test for demo doesn't need this stub to fire.
  adminList?: DashboardAdvisorPostMortemRow[]
  adminGetById?: (id: number) => DashboardAdvisorPostMortemRow | null
}): DashboardRouteRuntime => {
  const calls: PostMortemCalls = params?.calls ?? {
    list: 0,
    getById: 0,
    run: 0,
    llm: 0,
    provider: 0,
    knowledge: 0,
    graph: 0,
  }
  const runStub: RunStubKind = params?.runStub ?? { kind: 'completed' }

  const useCases: Partial<DashboardUseCases> = {
    listAdvisorPostMortems: async input => {
      calls.list += 1
      calls.lastListLimit = input.limit
      // Demo branch lives in the use-case factory; here we mirror it for fidelity.
      if (input.mode === 'demo') {
        return getAdvisorPostMortemListMock()
      }
      return {
        items: (params?.adminList ?? adminListFixture).map(row => ({
          ...row,
          learningActions: row.learningActions ? [...row.learningActions] : null,
        })),
      }
    },
    getAdvisorPostMortemById: async input => {
      calls.getById += 1
      calls.lastGetByIdInput = input.postMortemId
      if (input.mode === 'demo') {
        const items = getAdvisorPostMortemListMock().items
        return items.find(row => row.id === input.postMortemId) ?? null
      }
      const lookup = params?.adminGetById ?? ((id: number) =>
        adminListFixture.find(row => row.id === id) ?? null)
      return lookup(input.postMortemId)
    },
    runAdvisorPostMortem: async input => {
      calls.run += 1
      calls.lastRunTriggerSource = input.triggerSource
      if (input.mode === 'demo') {
        // Defensive — the route's `ensureAdminMutationAccess` returns 403 BEFORE delegation,
        // so this branch should never fire in the demo POST test. If it does, the route is
        // bypassing its own guard and the test will catch it via call counter assertion.
        throw new Error('Post-mortem runs are admin-only')
      }
      return buildRunResponse(runStub)
    },
    // Sentinels: any GET on the post-mortem routes that accidentally invokes a
    // provider/LLM/knowledge/graph use-case must explode this test.
    getAdvisorOverview: async () => {
      calls.provider += 1
      throw new Error('GET should not call provider/LLM use-cases in post-mortem tests')
    },
    getAdvisorKnowledgeAnswer: async () => {
      calls.knowledge += 1
      throw new Error('GET should not call knowledge service in post-mortem tests')
    },
    postAdvisorChat: async () => {
      calls.llm += 1
      throw new Error('GET should not call LLM in post-mortem tests')
    },
  }

  return {
    repositories: {
      readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
      derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
    },
    useCases: useCases as DashboardUseCases,
  } as DashboardRouteRuntime
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
      internalAuth: internalAuth ?? { hasValidToken: false, tokenSource: null },
      requestMeta: { requestId: 'req-post-mortem-test', startedAtMs: Date.now() },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createPostMortemRuntime()))
    .use(createAdvisorRoute())

describe('createAdvisorRoute · post-mortem', () => {
  it('GET /advisor/post-mortem returns deterministic demo fixtures in demo mode', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createPostMortemRuntime({ calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem')
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemListResponse
    const expected = getAdvisorPostMortemListMock()

    expect(response.status).toBe(200)
    expect(payload.items.length).toBe(expected.items.length)
    expect(payload.items[0]?.id).toBe(expected.items[0]?.id)
    expect(payload.items[0]?.status).toBe('completed')
    expect(calls.list).toBe(1)
    // No LLM/provider/knowledge/graph use-case touched.
    expect(calls.llm).toBe(0)
    expect(calls.provider).toBe(0)
    expect(calls.knowledge).toBe(0)
    expect(calls.graph).toBe(0)
  })

  it('GET /advisor/post-mortem/:postMortemId returns the matching demo fixture', async () => {
    const expected = getAdvisorPostMortemListMock().items[0]
    expect(expected).toBeDefined()
    if (!expected) return

    const app = createApp({ mode: 'demo' })
    const response = await app.handle(
      new Request(`http://finance-os.local/advisor/post-mortem/${expected.id}`)
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemRow
    expect(response.status).toBe(200)
    expect(payload.id).toBe(expected.id)
    expect(payload.status).toBe(expected.status)
  })

  it('GET /advisor/post-mortem/:postMortemId returns 404 for an unknown id', async () => {
    const app = createApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/9999')
    )
    const payload = (await response.json()) as { code: string }
    expect(response.status).toBe(404)
    expect(payload.code).toBe('NOT_FOUND')
  })

  it('POST /advisor/post-mortem/run rejects internal-token-only callers (admin session required, PR4-fix-2)', async () => {
    // Internal-token support is deferred until the worker-scheduler PR lands. Until then, the
    // route guard must reject internal-token-only callers (mode='demo' + valid internal token)
    // with 403 BEFORE the use-case is invoked. This avoids the route/use-case auth contract
    // mismatch that previously surfaced as a 500.
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createPostMortemRuntime({ calls, runStub: { kind: 'completed' } }),
      internalAuth: { hasValidToken: true, tokenSource: 'x-internal-token' },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'internal' }),
      })
    )
    const payload = (await response.json()) as { code: string; message?: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    // Critical: the use-case must NOT be invoked. The guard short-circuits BEFORE delegation.
    expect(calls.run).toBe(0)
  })

  it('POST /advisor/post-mortem/run is forbidden in demo mode and never invokes the use-case', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'demo',
      runtime: createPostMortemRuntime({ calls }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
    )
    const payload = (await response.json()) as { code: string }
    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
    // Critical: the route's auth guard must short-circuit BEFORE delegating to the use-case.
    expect(calls.run).toBe(0)
  })

  it('POST /advisor/post-mortem/run with feature flag off returns skipped_disabled', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createPostMortemRuntime({
        calls,
        runStub: { kind: 'skipped_disabled' },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemRunResponse

    expect(response.status).toBe(200)
    expect(payload.status).toBe('skipped_disabled')
    expect(payload.persistedIds).toEqual([])
    expect(payload.processed).toBe(0)
    // Use-case is invoked exactly once; the feature flag check lives inside the use-case.
    expect(calls.run).toBe(1)
    // Sentinels — no LLM-shaped use-case is touched on the run path either.
    expect(calls.llm).toBe(0)
    expect(calls.provider).toBe(0)
  })

  it('POST /advisor/post-mortem/run with budget blocked returns skipped_budget_blocked with reasons', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createPostMortemRuntime({
        calls,
        runStub: { kind: 'skipped_budget_blocked' },
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemRunResponse

    expect(response.status).toBe(200)
    expect(payload.status).toBe('skipped_budget_blocked')
    expect(payload.budgetReasons).toContain('deep_analysis_budget_guard')
    expect(payload.persistedIds).toEqual([])
    expect(calls.run).toBe(1)
  })

  it('POST /advisor/post-mortem/run with admin gates open invokes the use-case exactly once and returns completed', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const app = createApp({
      mode: 'admin',
      runtime: createPostMortemRuntime({ calls, runStub: { kind: 'completed' } }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'scheduled' }),
      })
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemRunResponse

    expect(response.status).toBe(200)
    expect(payload.status).toBe('completed')
    expect(payload.processed).toBe(2)
    expect(payload.persistedIds).toEqual([11, 12])
    expect(calls.run).toBe(1)
    expect(calls.lastRunTriggerSource).toBe('scheduled')
  })

  it('GET /advisor/post-mortem in admin mode hits the use-case (no demo fixture leak)', async () => {
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const adminRows: DashboardAdvisorPostMortemRow[] = [
      {
        id: 99,
        runId: null,
        recommendationId: null,
        decisionId: null,
        recommendationKey: 'admin-only-row',
        status: 'completed',
        horizonDays: 30,
        evaluatedAt: '2026-05-01T09:00:00.000Z',
        expectedOutcomeAt: '2026-04-29T09:00:00.000Z',
        inputSummary: null,
        findings: null,
        learningActions: null,
        calibration: null,
        riskNotes: null,
        skippedReason: null,
        errorCode: null,
        createdAt: '2026-05-01T09:00:00.000Z',
        updatedAt: '2026-05-01T09:00:00.000Z',
      },
    ]
    const app = createApp({
      mode: 'admin',
      runtime: createPostMortemRuntime({ calls, adminList: adminRows }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem')
    )
    const payload = (await response.json()) as DashboardAdvisorPostMortemListResponse

    expect(response.status).toBe(200)
    expect(payload.items.length).toBe(1)
    expect(payload.items[0]?.recommendationKey).toBe('admin-only-row')
    // The admin response is NOT the demo-fixture response.
    const demoIds = getAdvisorPostMortemListMock().items.map(item => item.id)
    expect(demoIds.includes(payload.items[0]?.id ?? -1)).toBe(false)
    // Sentinels.
    expect(calls.llm).toBe(0)
    expect(calls.provider).toBe(0)
    expect(calls.knowledge).toBe(0)
    expect(calls.graph).toBe(0)
  })

  it('returns 503 when the runtime does not expose runAdvisorPostMortem', async () => {
    const runtime: DashboardRouteRuntime = {
      repositories: {
        readModel: {} as DashboardRouteRuntime['repositories']['readModel'],
        derivedRecompute: {} as DashboardRouteRuntime['repositories']['derivedRecompute'],
      },
      // Use-case slot intentionally absent — simulates a deployment without post-mortem wiring.
      useCases: {} as DashboardUseCases,
    } as DashboardRouteRuntime

    const app = createApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/post-mortem/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ trigger: 'manual' }),
      })
    )
    const payload = (await response.json()) as { code: string }
    expect(response.status).toBe(503)
    expect(payload.code).toBe('ADVISOR_RUNTIME_UNAVAILABLE')
  })

  it('does not break existing /advisor/runs and /advisor/journal routes (smoke)', async () => {
    // PR1 + earlier shapes must remain reachable.
    const calls: PostMortemCalls = {
      list: 0,
      getById: 0,
      run: 0,
      llm: 0,
      provider: 0,
      knowledge: 0,
      graph: 0,
    }
    const runtime = createPostMortemRuntime({ calls })
    // Stub a couple of pre-existing use-cases so we can hit them without 503.
    ;(runtime.useCases as DashboardUseCases).getAdvisorRuns = async () => ({ items: [] })
    ;(runtime.useCases as DashboardUseCases).listAdvisorDecisionJournal = async () => ({
      items: [],
    })

    const app = createApp({ mode: 'admin', runtime })

    const runs = await app.handle(new Request('http://finance-os.local/advisor/runs'))
    expect(runs.status).toBe(200)

    const journal = await app.handle(new Request('http://finance-os.local/advisor/journal'))
    expect(journal.status).toBe(200)

    // None of those touched the post-mortem use-cases.
    expect(calls.list).toBe(0)
    expect(calls.getById).toBe(0)
    expect(calls.run).toBe(0)
  })
})
