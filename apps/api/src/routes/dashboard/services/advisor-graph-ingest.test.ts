import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import {
  sendDecisionPointToKnowledgeGraph,
  sendPostMortemToKnowledgeGraph,
} from './advisor-graph-ingest'

const decisionInput = {
  decisionId: 42,
  decision: 'accepted' as const,
  reasonCode: 'rebalance_to_target_weights',
  decidedAt: new Date('2026-04-26T08:00:00Z'),
  decidedBy: 'admin',
  expectedOutcomeAt: new Date('2026-05-26T08:00:00Z'),
  recommendationId: 7,
  recommendationKey: 'rec-cash-drag',
  runId: 11,
  freeNote: 'Will reduce cash by 5pp over the month',
}

const postMortemActions = [
  {
    postMortemId: 99,
    actionIndex: 0,
    title: 'Tighten cash floor before rebalancing',
    description: 'Outcome contradicted the cash-drag thesis',
    appliesTo: ['cash-drag-reduction'],
    status: 'invalidates_recommendation' as const,
    confidence: 0.7,
    recommendationKey: 'rec-cash-drag',
    decisionId: 42,
    runId: 11,
    evaluatedAt: new Date('2026-05-28T08:00:00Z'),
  },
]

describe('sendDecisionPointToKnowledgeGraph', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })
  afterEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })

  it('returns ok=false when knowledge service is disabled', async () => {
    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: false,
      ingestEnabled: true,
      requestId: 'r1',
      input: decisionInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('knowledge_service_disabled')
  })

  it('returns ok=false when advisor graph ingest is disabled', async () => {
    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: false,
      requestId: 'r1',
      input: decisionInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('graph_ingest_disabled')
  })

  it('sends compact payload, clamps free notes, and never includes raw provider data', async () => {
    const captured: { url?: string; body?: unknown } = {}
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(
      async (url: string | URL, init?: RequestInit) => {
        captured.url = String(url)
        captured.body = init?.body ? JSON.parse(String(init.body)) : null
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    ) as unknown as typeof fetch

    const longNote = 'x'.repeat(600)
    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: { ...decisionInput, freeNote: longNote },
    })

    expect(result.ok).toBe(true)
    expect(captured.url).toContain('/knowledge/ingest/advisor')
    const body = captured.body as Record<string, unknown>
    expect(body.mode).toBe('admin')
    expect(body.source).toBe('finance-os-advisor')
    const dps = body.decisionPoints as Array<Record<string, unknown>>
    expect(dps).toHaveLength(1)
    const dp = dps[0]
    if (!dp) throw new Error('expected decision point')
    expect(dp.decisionId).toBe(42)
    expect(dp.recommendationKey).toBe('rec-cash-drag')
    expect(typeof dp.freeNoteExcerpt).toBe('string')
    expect((dp.freeNoteExcerpt as string).length).toBeLessThanOrEqual(480)
    // No raw provider/secret keys ever leak through.
    expect('rawPayload' in dp).toBe(false)
    expect('apiKey' in dp).toBe(false)
  })

  it('omits null optional fields rather than sending null', async () => {
    const captured: { body?: unknown } = {}
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(
      async (_url: string | URL, init?: RequestInit) => {
        captured.body = init?.body ? JSON.parse(String(init.body)) : null
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    ) as unknown as typeof fetch

    await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: {
        decisionId: 5,
        decision: 'rejected',
        reasonCode: 'risk_too_high',
        decidedAt: new Date('2026-04-26T08:00:00Z'),
        recommendationId: null,
        recommendationKey: null,
        runId: null,
        freeNote: null,
      },
    })
    const dp = (captured.body as { decisionPoints: Array<Record<string, unknown>> })
      .decisionPoints[0]
    if (!dp) throw new Error('expected decision point')
    expect('recommendationId' in dp).toBe(false)
    expect('recommendationKey' in dp).toBe(false)
    expect('runId' in dp).toBe(false)
    expect('freeNoteExcerpt' in dp).toBe(false)
  })

  it('fail-soft on fetch error', async () => {
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      throw new Error('network down')
    }) as unknown as typeof fetch

    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: decisionInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('knowledge_service_error')
  })

  it('fail-soft on non-OK response', async () => {
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      return new Response('boom', { status: 500 })
    }) as unknown as typeof fetch

    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: decisionInput,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('knowledge_service_status_500')
  })

  it('always tags the request with mode=admin and source=finance-os-advisor', async () => {
    const captured: { body?: unknown } = {}
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(
      async (_url: string | URL, init?: RequestInit) => {
        captured.body = init?.body ? JSON.parse(String(init.body)) : null
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    ) as unknown as typeof fetch

    await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: decisionInput,
    })

    const body = captured.body as Record<string, unknown>
    expect(body.mode).toBe('admin')
    expect(body.source).toBe('finance-os-advisor')
  })

  it('rejects invalid decided_at without calling the network', async () => {
    let calls = 0
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      calls += 1
      return new Response('{}', { status: 200 })
    }) as unknown as typeof fetch

    const result = await sendDecisionPointToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      input: { ...decisionInput, decidedAt: 'not-a-date' },
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('invalid_decided_at')
    expect(calls).toBe(0)
  })
})

describe('sendPostMortemToKnowledgeGraph', () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })
  afterEach(() => {
    ;(globalThis as { fetch: typeof fetch }).fetch = originalFetch
  })

  it('returns ok=false when no learning actions', async () => {
    const result = await sendPostMortemToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      actions: [],
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('no_learning_actions')
  })

  it('returns ok=false when knowledge service is disabled', async () => {
    const result = await sendPostMortemToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: false,
      ingestEnabled: true,
      requestId: 'r1',
      actions: postMortemActions,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe('knowledge_service_disabled')
  })

  it('sends compact learningActions payload and bounds appliesTo', async () => {
    const captured: { body?: unknown } = {}
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(
      async (_url: string | URL, init?: RequestInit) => {
        captured.body = init?.body ? JSON.parse(String(init.body)) : null
        return new Response(JSON.stringify({ ok: true }), { status: 200 })
      }
    ) as unknown as typeof fetch

    const result = await sendPostMortemToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      actions: postMortemActions.map(a => ({
        ...a,
        appliesTo: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
      })),
    })

    expect(result.ok).toBe(true)
    const body = captured.body as Record<string, unknown>
    const las = body.learningActions as Array<Record<string, unknown>>
    expect(las).toHaveLength(1)
    const la = las[0]
    if (!la) throw new Error('expected learning action')
    expect(la.postMortemId).toBe(99)
    expect(la.actionIndex).toBe(0)
    expect(la.status).toBe('invalidates_recommendation')
    expect((la.appliesTo as unknown[]).length).toBeLessThanOrEqual(8)
    // No COT / prompt / response leakage.
    expect('prompt' in la).toBe(false)
    expect('response' in la).toBe(false)
  })

  it('fail-soft on network error', async () => {
    ;(globalThis as { fetch: typeof fetch }).fetch = mock(async () => {
      throw new Error('connection refused')
    }) as unknown as typeof fetch

    const result = await sendPostMortemToKnowledgeGraph({
      knowledgeServiceUrl: 'http://localhost:8011',
      knowledgeServiceEnabled: true,
      ingestEnabled: true,
      requestId: 'r1',
      actions: postMortemActions,
    })
    expect(result.ok).toBe(false)
    expect(result.reason).toContain('knowledge_service_error')
  })
})
