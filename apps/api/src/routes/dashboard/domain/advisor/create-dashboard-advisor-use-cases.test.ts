import { describe, expect, it } from 'bun:test'
import { getDashboardSummaryMock } from '../../../../mocks/dashboardSummary.mock'
import { getExternalInvestmentsBundleMock } from '../../../../mocks/externalInvestments.mock'
import type { DashboardAdvisorRunSummaryResponse } from '../../advisor-contract'
import type { DashboardAdvisorRepository } from '../../types'
import {
  createDashboardAdvisorUseCases,
  evaluateAdvisorChallengerViability,
  inspectAdvisorInvestmentContext,
} from './create-dashboard-advisor-use-cases'

const unexpectedCall = (label: string) => () => {
  throw new Error(`Unexpected call: ${label}`)
}

const createExplodingRepository = () =>
  new Proxy(
    {},
    {
      get(_target, property) {
        return unexpectedCall(`repository.${String(property)}`)
      },
    }
  ) as DashboardAdvisorRepository

const config = {
  advisorEnabled: true,
  adminOnly: false,
  forceLocalOnly: false,
  knowledgeRetrievalEnabled: true,
  chatEnabled: true,
  challengerEnabled: true,
  relabelEnabled: true,
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  challengerDisableRatio: 0.75,
  deepAnalysisDisableRatio: 0.5,
  maxChatMessagesContext: 8,
  usdToEurRate: 0.92,
  xSignalsMode: 'shadow',
  openAi: null,
  anthropic: null,
} as const

const createBudgetSummary = () => ({
  dailyUsdSpent: 0,
  monthlyUsdSpent: 0,
  dailyBudgetUsd: 5,
  monthlyBudgetUsd: 100,
  challengerAllowed: true,
  deepAnalysisAllowed: true,
  blocked: false,
  reasons: [],
})

const createLowConfidenceInvestmentBundle = () => {
  const bundle = getExternalInvestmentsBundleMock()
  return {
    ...bundle,
    confidence: 'low' as const,
    totalKnownValue: 0,
    providerCoverage: bundle.providerCoverage.map(coverage => ({
      ...coverage,
      status: 'failing' as const,
      stale: true,
      degradedReasons: ['SYNC_FAILED'],
    })),
    staleDataWarnings: ['IBKR and Binance snapshots are stale.'],
    riskFlags: [...bundle.riskFlags, 'PROVIDER_COVERAGE_UNAVAILABLE'],
  }
}

const createPipelineRepository = () => {
  const savedArtifacts: Parameters<DashboardAdvisorRepository['saveDailyArtifacts']>[0][] = []
  const runUpdates: Parameters<DashboardAdvisorRepository['updateRun']>[0][] = []
  const modelUsages: Parameters<DashboardAdvisorRepository['insertModelUsage']>[0][] = []
  let nextStepId = 1

  const buildRun = (): DashboardAdvisorRunSummaryResponse => {
    const latest = runUpdates.at(-1)
    return {
      id: 101,
      runType: 'daily',
      status: latest?.status ?? 'running',
      triggerSource: 'cron',
      requestId: 'req-pipeline',
      startedAt: '2026-05-03T00:00:00.000Z',
      finishedAt: latest?.finishedAt?.toISOString() ?? null,
      durationMs: latest?.durationMs ?? null,
      degraded: latest?.degraded ?? false,
      fallbackReason: latest?.fallbackReason ?? null,
      errorCode: latest?.errorCode ?? null,
      errorMessage: latest?.errorMessage ?? null,
      budgetState: null,
      usageSummary: {
        totalCalls: modelUsages.length,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        totalCostUsd: 0,
        totalCostEur: 0,
      },
    }
  }

  return {
    savedArtifacts,
    runUpdates,
    modelUsages,
    repository: {
      getSpendAnalytics: async () => ({
        summary: createBudgetSummary(),
        daily: [],
        byFeature: [],
        byModel: [],
        anomalies: [],
      }),
      createRun: async () => 101,
      updateRun: async (input: Parameters<DashboardAdvisorRepository['updateRun']>[0]) => {
        runUpdates.push(input)
      },
      upsertPromptTemplate: async () => undefined,
      upsertEvalCases: async () => undefined,
      createRunStep: async () => nextStepId++,
      updateRunStep: async () => undefined,
      insertModelUsage: async (
        input: Parameters<DashboardAdvisorRepository['insertModelUsage']>[0]
      ) => {
        modelUsages.push(input)
      },
      saveDailyArtifacts: async (
        input: Parameters<DashboardAdvisorRepository['saveDailyArtifacts']>[0]
      ) => {
        savedArtifacts.push(input)
      },
      listRuns: async () => ({ items: [buildRun()] }),
    } as unknown as DashboardAdvisorRepository,
  }
}

describe('createDashboardAdvisorUseCases', () => {
  it('keeps the demo overview, knowledge Q&A, and chat fully local', async () => {
    const useCases = createDashboardAdvisorUseCases({
      repository: createExplodingRepository(),
      getSummary: async () => {
        throw new Error('summary should not be called in demo')
      },
      getGoals: async () => {
        throw new Error('goals should not be called in demo')
      },
      getTransactions: async () => {
        throw new Error('transactions should not be called in demo')
      },
      config,
    })

    const overview = await useCases.getAdvisorOverview({
      mode: 'demo',
      requestId: 'req-demo',
    })
    const topics = await useCases.getAdvisorKnowledgeTopics({
      mode: 'demo',
      requestId: 'req-demo',
    })
    const answer = await useCases.getAdvisorKnowledgeAnswer({
      mode: 'demo',
      requestId: 'req-demo',
      question: 'Pourquoi diversifier un portefeuille ?',
    })
    const chat = await useCases.postAdvisorChat({
      mode: 'demo',
      requestId: 'req-demo',
      message: 'Pourquoi tu me conseilles cela ?',
    })

    expect(overview.mode).toBe('demo')
    expect(overview.source).toBe('demo_fixture')
    expect(overview.chatEnabled).toBe(false)
    expect(overview.topRecommendations.length).toBeGreaterThan(0)

    expect(topics.mode).toBe('demo')
    expect(topics.retrievalEnabled).toBe(true)
    expect(topics.topics.length).toBeGreaterThan(0)

    expect(answer.mode).toBe('demo')
    expect(answer.status).toBe('answered')
    expect(answer.source).toBe('demo_fixture')
    expect(answer.citations.length).toBeGreaterThan(0)

    expect(chat.ok).toBe(true)
    expect(chat.thread.messages).toHaveLength(2)
    expect(chat.thread.messages[1]?.content).toContain('Mode demo')
    expect(chat.thread.messages[1]?.assumptions).toContain(
      'Mode demo sans persistence ni appel provider.'
    )
  })

  it('falls back to browse-only knowledge mode when provider-disable is active', async () => {
    const useCases = createDashboardAdvisorUseCases({
      repository: createExplodingRepository(),
      getSummary: async () => {
        throw new Error('summary should not be called in browse-only knowledge mode')
      },
      getGoals: async () => {
        throw new Error('goals should not be called in browse-only knowledge mode')
      },
      getTransactions: async () => {
        throw new Error('transactions should not be called in browse-only knowledge mode')
      },
      config: {
        ...config,
        forceLocalOnly: true,
      },
    })

    const topics = await useCases.getAdvisorKnowledgeTopics({
      mode: 'admin',
      requestId: 'req-admin',
    })
    const answer = await useCases.getAdvisorKnowledgeAnswer({
      mode: 'admin',
      requestId: 'req-admin',
      question: 'Pourquoi diversifier un portefeuille ?',
    })

    expect(topics.retrievalEnabled).toBe(false)
    expect(topics.browseOnlyReason).toBe('provider_disable_switch')
    expect(answer.status).toBe('browse_only')
    expect(answer.fallbackReason).toBe('provider_disable_switch')
    expect(answer.answer).toBeNull()
    expect(answer.suggestedTopics.length).toBeGreaterThan(0)
  })

  it('skips challenger calls when external investment context is insufficient', async () => {
    const { repository, savedArtifacts, runUpdates, modelUsages } = createPipelineRepository()
    let anthropicCalls = 0
    const useCases = createDashboardAdvisorUseCases({
      repository,
      getSummary: async range => getDashboardSummaryMock(range),
      getGoals: async () => ({ items: [] }),
      getInvestmentContextBundle: async () => createLowConfidenceInvestmentBundle(),
      getTransactions: async () => ({
        schemaVersion: '2026-04-05',
        range: '30d',
        limit: 40,
        nextCursor: null,
        freshness: {
          strategy: 'snapshot-first',
          lastSyncedAt: null,
          syncStatus: 'fresh',
          degradedReason: null,
          snapshotAgeSeconds: null,
          refreshRequested: false,
        },
        items: [],
      }),
      config: {
        ...config,
        anthropic: {
          apiKey: 'test-anthropic-key',
          challengerModel: 'claude-test',
        },
      },
      structuredClients: {
        openAi: null,
        anthropic: {
          runStructured: async () => {
            anthropicCalls += 1
            throw new Error('anthropic should be skipped')
          },
        },
      },
    })

    const result = await useCases.runAdvisorDaily({
      mode: 'admin',
      requestId: 'req-pipeline',
      triggerSource: 'cron',
    })
    const finalUpdate = runUpdates.at(-1)
    const degradedReasons = finalUpdate?.outputDigest?.degradedReasons as string[]
    const challenger = finalUpdate?.metadata?.challenger as {
      status: string
      challengerSkipped: boolean
      challengerSkipReason: string | null
      skipReasons: string[]
    }

    expect(result.ok).toBe(true)
    expect(anthropicCalls).toBe(0)
    expect(modelUsages).toHaveLength(0)
    expect(savedArtifacts).toHaveLength(1)
    expect(finalUpdate?.status).toBe('degraded')
    expect(finalUpdate?.fallbackReason).toBe('investment_context_degraded')
    expect(degradedReasons).toContain('investment_context_degraded')
    expect(degradedReasons).toContain('investment_context_insufficient')
    expect(challenger.status).toBe('skipped')
    expect(challenger.challengerSkipped).toBe(true)
    expect(challenger.challengerSkipReason).toBe('investment_context_degraded')
    expect(challenger.skipReasons).toContain('investment_context_degraded')
    expect(challenger.skipReasons).toContain('investment_context_insufficient')
    expect(
      savedArtifacts[0]?.recommendations.every(item => item.challengerStatus === 'skipped')
    ).toBe(true)
  })

  it('marks low-confidence stale investment bundles as non-viable for challenger', () => {
    const investmentHealth = inspectAdvisorInvestmentContext(createLowConfidenceInvestmentBundle())
    const viability = evaluateAdvisorChallengerViability({
      budgetState: createBudgetSummary(),
      recommendationCount: 2,
      investmentHealth,
    })

    expect(investmentHealth?.degraded).toBe(true)
    expect(investmentHealth?.insufficientForChallenger).toBe(true)
    expect(viability.allowed).toBe(false)
    expect(viability.skipReasons).toContain('investment_context_degraded')
    expect(viability.skipReasons).toContain('investment_context_insufficient')
  })
})
