import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createDashboardRuntimePlugin } from '../plugin'
import { createAdvisorRoute } from './advisor'
import type {
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorKnowledgeAnswerResponse,
  DashboardAdvisorKnowledgeTopicsResponse,
  DashboardAdvisorManualRefreshAndRunPostResponse,
  DashboardAdvisorOverviewResponse,
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRunDailyResponse,
} from '../advisor-contract'
import type { DashboardRouteRuntime } from '../types'

const sampleBudgetState = {
  dailyUsdSpent: 0,
  monthlyUsdSpent: 0,
  dailyBudgetUsd: 2,
  monthlyBudgetUsd: 40,
  challengerAllowed: true,
  deepAnalysisAllowed: true,
  blocked: false,
  reasons: [],
}

const sampleRun = {
  id: 1,
  runType: 'daily' as const,
  status: 'completed' as const,
  triggerSource: 'manual',
  requestId: 'req-advisor-test',
  startedAt: '2026-04-14T08:00:00.000Z',
  finishedAt: '2026-04-14T08:00:03.000Z',
  durationMs: 3000,
  degraded: false,
  fallbackReason: null,
  errorCode: null,
  errorMessage: null,
  budgetState: sampleBudgetState,
  usageSummary: {
    totalCalls: 1,
    totalInputTokens: 500,
    totalOutputTokens: 250,
    totalCostUsd: 0.02,
    totalCostEur: 0.0184,
  },
}

const sampleOverview = (mode: 'demo' | 'admin'): DashboardAdvisorOverviewResponse => ({
  mode,
  source: mode === 'demo' ? 'demo_fixture' : 'persisted',
  requestId: 'req-advisor-test',
  generatedAt: '2026-04-14T08:00:03.000Z',
  status: 'ready',
  degradedMessage: null,
  latestRun: mode === 'demo' ? null : sampleRun,
  brief: {
    id: 1,
    runId: 1,
    title: 'Brief test',
    summary: 'Resume de test.',
    keyFacts: ['Cash drag visible'],
    opportunities: ['Reallouer le cash excedentaire'],
    risks: ['Concentration sur une ligne'],
    watchItems: ['Surveiller le budget IA'],
    recommendationNotes: [],
    provider: mode === 'demo' ? null : 'openai',
    model: mode === 'demo' ? null : 'gpt-5.4-mini',
    createdAt: '2026-04-14T08:00:03.000Z',
  },
  topRecommendations: [
    {
      id: 1,
      runId: 1,
      recommendationKey: 'cash-drag',
      type: 'rebalance',
      category: 'cash_optimization',
      title: 'Reduire le cash qui dort',
      description: 'Le niveau de cash depasse la bande cible.',
      whyNow: 'Le cash drag pese sur le rendement reel attendu.',
      evidence: ['Cash allocation 26%', 'Target cash midpoint 12%'],
      assumptions: ['Inflation 2.5%'],
      confidence: 0.72,
      riskLevel: 'low',
      expectedImpact: {
        summary: 'Ameliore le rendement attendu',
        value: 1.2,
        unit: 'pct',
      },
      effort: 'low',
      reversibility: 'high',
      blockingFactors: [],
      alternatives: ['DCA progressif'],
      deterministicMetricsUsed: ['cashAllocationPct', 'cashDragPct'],
      llmModelsUsed: mode === 'demo' ? [] : ['gpt-5.4-mini'],
      challengerStatus: 'skipped',
      priorityScore: 78,
      expiresAt: null,
      createdAt: '2026-04-14T08:00:03.000Z',
      challenge: null,
    },
  ],
  snapshot: {
    id: 1,
    runId: 1,
    asOfDate: '2026-04-14',
    range: '30d',
    currency: 'EUR',
    riskProfile: 'balanced',
    metrics: {
      cashAllocationPct: 26,
      expectedAnnualReturnPct: 5.4,
    },
    allocationBuckets: [],
    assetClassAllocations: [],
    driftSignals: [],
    scenarios: [],
    diagnostics: {},
  },
  spend: sampleBudgetState,
  signalCounts: {
    macro: 0,
    news: 0,
  },
  assumptionCount: 1,
  chatEnabled: true,
})

const sampleManualOperation: DashboardAdvisorManualOperationResponse = {
  operationId: 'manual-op-1',
  requestId: 'req-advisor-test',
  status: 'running',
  currentStage: 'news_refresh',
  statusMessage: 'Rafraichissement news',
  triggerSource: 'manual',
  startedAt: '2026-04-14T08:00:00.000Z',
  finishedAt: null,
  durationMs: null,
  degraded: false,
  errorCode: null,
  errorMessage: null,
  advisorRunId: null,
  advisorRun: null,
  steps: [
    {
      id: 1,
      stepKey: 'personal_sync',
      label: 'Synchronisation donnees personnelles',
      status: 'completed',
      startedAt: '2026-04-14T08:00:00.000Z',
      finishedAt: '2026-04-14T08:00:05.000Z',
      durationMs: 5000,
      errorCode: null,
      errorMessage: null,
      details: {
        totalCount: 1,
      },
    },
    {
      id: 2,
      stepKey: 'news_refresh',
      label: 'Rafraichissement news',
      status: 'running',
      startedAt: '2026-04-14T08:00:05.000Z',
      finishedAt: null,
      durationMs: null,
      errorCode: null,
      errorMessage: null,
      details: null,
    },
  ],
  outputDigest: null,
}

const createDashboardRuntime = (
  overrides?: Partial<DashboardRouteRuntime['useCases']>
): DashboardRouteRuntime => ({
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
    getAdvisorOverview: async ({ mode }) => sampleOverview(mode),
    getAdvisorDailyBrief: async ({ mode }) => sampleOverview(mode).brief,
    getAdvisorRecommendations: async (): Promise<DashboardAdvisorRecommendationsResponse> => ({
      items: sampleOverview('admin').topRecommendations,
    }),
    getAdvisorRuns: async () => ({ items: [sampleRun] }),
    getAdvisorAssumptions: async () => ({
      items: [
        {
          id: 1,
          runId: 1,
          assumptionKey: 'inflation',
          source: 'default',
          value: 2.5,
          justification: 'Default inflation assumption.',
          createdAt: '2026-04-14T08:00:03.000Z',
        },
      ],
    }),
    getAdvisorSignals: async () => ({
      macroSignals: [],
      newsSignals: [],
    }),
    getAdvisorSpend: async () => ({
      summary: sampleBudgetState,
      daily: [],
      byFeature: [],
      byModel: [],
      anomalies: [],
    }),
    getAdvisorKnowledgeTopics: async ({
      mode,
      requestId,
    }): Promise<DashboardAdvisorKnowledgeTopicsResponse> => ({
      mode,
      requestId,
      generatedAt: '2026-04-14T08:00:03.000Z',
      retrievalEnabled: true,
      browseOnlyReason: null,
      topics: [
        {
          topicId: 'diversification',
          title: 'Diversification',
          summary: 'Evite la concentration sur un seul scenario.',
          difficulty: 'beginner',
          estimatedReadMinutes: 5,
          tags: ['portfolio', 'risk'],
          relatedQuestions: ['Pourquoi diversifier un portefeuille ?'],
        },
      ],
    }),
    getAdvisorKnowledgeAnswer:
      async ({ mode, requestId, question }): Promise<DashboardAdvisorKnowledgeAnswerResponse> => ({
        mode,
        source: mode === 'demo' ? 'demo_fixture' : 'retrieval',
        requestId,
        generatedAt: '2026-04-14T08:00:03.000Z',
        status: 'answered',
        question,
        answer: {
          headline: 'Diversification: repere pedagogique',
          summary: 'Diversifier reduit le risque specifique.',
          keyPoints: ['Evite la concentration', 'Ne supprime pas le risque global'],
          nextStep: 'Cartographier les expositions principales.',
          guardrail: 'Contenu educatif uniquement.',
        },
        confidenceScore: 0.82,
        confidenceLabel: 'high',
        lowConfidence: false,
        fallbackReason: null,
        retrievalEnabled: true,
        retrieval: {
          intent: 'definition',
          matchedTopicIds: ['diversification'],
          hitCount: 1,
          guardrailTriggered: false,
          stageLatenciesMs: {
            queryParse: 2,
            retrieval: 3,
            answerAssembly: 4,
            total: 9,
          },
          stages: [
            {
              stage: 'query_parse',
              status: 'completed',
              detail: 'Question normalisee.',
            },
            {
              stage: 'retrieval',
              status: 'completed',
              detail: '1 sujet trouve.',
            },
            {
              stage: 'answer_assembly',
              status: 'completed',
              detail: 'Reponse assemblee.',
            },
            {
              stage: 'fallback',
              status: 'skipped',
              detail: 'Aucun fallback.',
            },
          ],
        },
        citations: [
          {
            citationId: 'diversification-role',
            topicId: 'diversification',
            topicTitle: 'Diversification',
            sectionTitle: 'Role',
            label: 'Diversification · Role',
            excerpt: 'Diversifier reduit la dependance a un seul scenario.',
          },
        ],
        suggestedTopics: [
          {
            topicId: 'diversification',
            title: 'Diversification',
            summary: 'Evite la concentration sur un seul scenario.',
            difficulty: 'beginner',
            estimatedReadMinutes: 5,
            tags: ['portfolio', 'risk'],
            relatedQuestions: ['Pourquoi diversifier un portefeuille ?'],
          },
        ],
      }),
    getLatestAdvisorManualOperation: async () => sampleManualOperation,
    getAdvisorManualOperationById: async () => sampleManualOperation,
    runAdvisorManualRefreshAndAnalysis:
      async (): Promise<DashboardAdvisorManualRefreshAndRunPostResponse> => ({
        ok: true,
        requestId: 'req-advisor-test',
        alreadyRunning: false,
        operation: sampleManualOperation,
      }),
    runAdvisorDaily: async (): Promise<DashboardAdvisorRunDailyResponse> => ({
      ok: true,
      requestId: 'req-advisor-test',
      run: sampleRun,
    }),
    relabelAdvisorTransactions: async () => ({
      ok: true,
      requestId: 'req-advisor-test',
      run: sampleRun,
      suggestions: [],
    }),
    getAdvisorChat: async () => ({
      threadId: 'default',
      title: 'Finance Assistant',
      messages: [],
    }),
    postAdvisorChat: async ({ message }): Promise<DashboardAdvisorChatPostResponse> => ({
      ok: true,
      requestId: 'req-advisor-test',
      thread: {
        threadId: 'default',
        title: 'Finance Assistant',
        messages: [
          {
            id: 1,
            role: 'user',
            content: message,
            citations: [],
            assumptions: [],
            caveats: [],
            simulations: [],
            provider: null,
            model: null,
            createdAt: '2026-04-14T08:00:03.000Z',
          },
        ],
      },
    }),
    getAdvisorEvals: async () => ({
      cases: [],
      latestRun: null,
    }),
    ...overrides,
  },
})

const createAdvisorTestApp = ({
  mode,
  routeConfig,
  runtime,
}: {
  mode: 'admin' | 'demo'
  routeConfig?: Parameters<typeof createAdvisorRoute>[0]
  runtime?: DashboardRouteRuntime
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: {
        hasValidToken: false,
        tokenSource: null,
      },
      requestMeta: {
        requestId: 'req-advisor-test',
        startedAtMs: Date.now(),
      },
    }))
    .use(createDashboardRuntimePlugin(runtime ?? createDashboardRuntime()))
    .use(createAdvisorRoute(routeConfig))

describe('createAdvisorRoute', () => {
  it('returns advisor overview in demo mode', async () => {
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(new Request('http://finance-os.local/advisor?range=30d'))
    const payload = (await response.json()) as DashboardAdvisorOverviewResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('demo')
    expect(payload.source).toBe('demo_fixture')
    expect(payload.topRecommendations.length).toBeGreaterThan(0)
  })

  it('returns recommendations list', async () => {
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/recommendations?limit=5')
    )
    const payload = (await response.json()) as DashboardAdvisorRecommendationsResponse

    expect(response.status).toBe(200)
    expect(payload.items.length).toBe(1)
    expect(payload.items[0]?.recommendationKey).toBe('cash-drag')
  })

  it('returns knowledge topics in demo mode', async () => {
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/knowledge-topics')
    )
    const payload = (await response.json()) as DashboardAdvisorKnowledgeTopicsResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('demo')
    expect(payload.retrievalEnabled).toBe(true)
    expect(payload.topics[0]?.topicId).toBe('diversification')
  })

  it('returns a knowledge answer payload', async () => {
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(
      new Request(
        'http://finance-os.local/advisor/knowledge-answer?question=Pourquoi%20diversifier%20un%20portefeuille%20%3F'
      )
    )
    const payload = (await response.json()) as DashboardAdvisorKnowledgeAnswerResponse

    expect(response.status).toBe(200)
    expect(payload.status).toBe('answered')
    expect(payload.answer?.headline).toContain('Diversification')
    expect(payload.citations[0]?.topicId).toBe('diversification')
  })

  it('blocks run-daily in demo mode', async () => {
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/run-daily', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          trigger: 'manual',
        }),
      })
    )
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
  })

  it('returns the latest manual refresh operation in admin mode', async () => {
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/manual-refresh-and-run')
    )
    const payload = (await response.json()) as DashboardAdvisorManualOperationResponse

    expect(response.status).toBe(200)
    expect(payload.operationId).toBe('manual-op-1')
    expect(payload.currentStage).toBe('news_refresh')
  })

  it('returns JSON null when no manual refresh operation exists yet', async () => {
    const app = createAdvisorTestApp({
      mode: 'admin',
      runtime: createDashboardRuntime({
        getLatestAdvisorManualOperation: async () => null,
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/manual-refresh-and-run')
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toContain('application/json')
    expect(await response.text()).toBe('null')
  })

  it('queues manual refresh-and-run in admin mode', async () => {
    const app = createAdvisorTestApp({ mode: 'admin' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/manual-refresh-and-run', {
        method: 'POST',
      })
    )
    const payload = (await response.json()) as DashboardAdvisorManualRefreshAndRunPostResponse

    expect(response.status).toBe(200)
    expect(payload.ok).toBe(true)
    expect(payload.alreadyRunning).toBe(false)
    expect(payload.operation.operationId).toBe('manual-op-1')
  })

  it('returns chat payload in demo mode without admin gating', async () => {
    const app = createAdvisorTestApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/advisor/chat', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: 'Pourquoi ce conseil ?',
        }),
      })
    )
    const payload = (await response.json()) as DashboardAdvisorChatPostResponse

    expect(response.status).toBe(200)
    expect(payload.thread.messages[0]?.content).toBe('Pourquoi ce conseil ?')
  })

  it('blocks demo when admin-only mode is enabled', async () => {
    const app = createAdvisorTestApp({
      mode: 'demo',
      routeConfig: {
        advisorEnabled: true,
        adminOnly: true,
        chatEnabled: true,
        relabelEnabled: true,
      },
    })

    const response = await app.handle(new Request('http://finance-os.local/advisor'))
    const payload = (await response.json()) as { code: string }

    expect(response.status).toBe(403)
    expect(payload.code).toBe('ADVISOR_ADMIN_ONLY')
  })
})
