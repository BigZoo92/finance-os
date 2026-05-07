import { describe, expect, it } from 'bun:test'
import {
  POST_MORTEM_PROMPT,
  postMortemSchemaName,
  postMortemSchemaVersion,
  type AiBudgetState,
  type PostMortemOutput,
  type StructuredCompletionRequest,
  type StructuredCompletionResult,
} from '@finance-os/ai'
import {
  createPostMortemUseCases,
  type ExpiredRecommendationContext,
  type PersistedPostMortemRow,
  type PostMortemRepositoryAdapter,
  type PostMortemStructuredRunner,
} from './create-post-mortem-use-cases'

const makeBudget = (overrides: Partial<AiBudgetState> = {}): AiBudgetState => ({
  dailyUsdSpent: 0,
  monthlyUsdSpent: 0,
  dailyBudgetUsd: 1,
  monthlyBudgetUsd: 30,
  challengerAllowed: true,
  deepAnalysisAllowed: true,
  blocked: false,
  reasons: [],
  ...overrides,
})

const makeContext = (
  overrides: Partial<ExpiredRecommendationContext> = {}
): ExpiredRecommendationContext => ({
  recommendationId: 1,
  recommendationKey: 'cash-drag',
  runId: 100,
  decisionId: null,
  decisionKind: null,
  reasonCode: null,
  decidedAt: null,
  expectedOutcomeAt: '2026-04-01T09:00:00.000Z',
  horizonDays: 30,
  recommendationTitle: 'Cash drag',
  recommendationCategory: 'opportunity',
  recommendationConfidence: 0.6,
  recommendationRiskLevel: 'low',
  evidence: ['cashAllocationPct=26'],
  assumptions: ['Inflation 2.5%'],
  outcomes: [],
  ...overrides,
})

const makeOutput = (overrides: Partial<PostMortemOutput> = {}): PostMortemOutput => ({
  version: postMortemSchemaVersion,
  summary:
    'Calibration was looser than warranted on a single-source signal; cap confidence going forward.',
  overallOutcome: 'mixed',
  confidenceCalibration: {
    previousConfidence: 'high',
    calibratedConfidence: 'medium',
    rationale: 'Out-of-sample evidence was thinner than the original write-up implied.',
  },
  evidenceReview: {
    supportedSignals: ['Same-week index move'],
    contradictedSignals: [],
    missingEvidence: ['No volume confirmation across underlyings'],
    staleOrWeakEvidence: [],
  },
  outcomeDrivers: {
    likelyDrivers: ['Allocation discipline'],
    alternativeExplanations: ['Macro tailwind unrelated to the recommendation'],
    unknowns: [],
  },
  lessons: {
    keep: ['Surface drift bands explicitly'],
    change: ['Cap confidence when corroborating evidence is thin'],
    avoid: ['Treating macro coincidence as causation'],
  },
  learningActions: [
    {
      kind: 'caveat',
      title: 'Cap confidence on single-source correlation',
      description: 'When evidence is thin, calibrated confidence should stay at most medium.',
      scope: 'advisory-only',
      confidence: 'medium',
      appliesTo: ['advisor.recommendation.causal_reasoning'],
    },
  ],
  safety: { containsExecutionDirective: false, executionTerms: [] },
  ...overrides,
})

interface FakeRepoState {
  contexts: ExpiredRecommendationContext[]
  inserted: Array<Parameters<PostMortemRepositoryAdapter['insertPostMortem']>[0]>
  listCalls: number
  getByIdCalls: number
}

const buildFakeRepo = (
  contexts: ExpiredRecommendationContext[]
): { repo: PostMortemRepositoryAdapter; state: FakeRepoState } => {
  const state: FakeRepoState = {
    contexts: [...contexts],
    inserted: [],
    listCalls: 0,
    getByIdCalls: 0,
  }
  let nextId = 1
  const persisted: PersistedPostMortemRow[] = []

  const repo: PostMortemRepositoryAdapter = {
    async listExpiredContexts(input) {
      return state.contexts.slice(0, input.limit)
    },
    async insertPostMortem(input) {
      state.inserted.push(input)
      const now = new Date().toISOString()
      const row: PersistedPostMortemRow = {
        id: nextId++,
        runId: input.runId ?? null,
        recommendationId: input.recommendationId ?? null,
        decisionId: input.decisionId ?? null,
        recommendationKey: input.recommendationKey ?? null,
        status: input.status,
        horizonDays: input.horizonDays ?? null,
        evaluatedAt: input.evaluatedAt.toISOString(),
        expectedOutcomeAt: input.expectedOutcomeAt
          ? input.expectedOutcomeAt.toISOString()
          : null,
        inputSummary: input.inputSummary ?? null,
        findings: input.findings ?? null,
        learningActions: input.learningActions ?? null,
        calibration: input.calibration ?? null,
        riskNotes: input.riskNotes ?? null,
        skippedReason: input.skippedReason ?? null,
        errorCode: input.errorCode ?? null,
        createdAt: now,
        updatedAt: now,
      }
      persisted.push(row)
      return row
    },
    async listPostMortems(_input) {
      state.listCalls += 1
      return { items: [...persisted] }
    },
    async getPostMortemById(id) {
      state.getByIdCalls += 1
      return persisted.find(p => p.id === id) ?? null
    },
  }
  return { repo, state }
}

interface FakeRunnerState {
  calls: number
  lastRequest: StructuredCompletionRequest | null
}

const buildFakeRunner = (
  output: PostMortemOutput | (() => PostMortemOutput) | { error: Error }
): { runner: PostMortemStructuredRunner; state: FakeRunnerState } => {
  const state: FakeRunnerState = { calls: 0, lastRequest: null }
  const runner: PostMortemStructuredRunner = {
    async runStructured<TOutput>(
      request: StructuredCompletionRequest
    ): Promise<StructuredCompletionResult<TOutput>> {
      state.calls += 1
      state.lastRequest = request
      if (typeof output === 'object' && output !== null && 'error' in output) {
        throw output.error
      }
      const resolved = typeof output === 'function' ? output() : output
      return {
        output: resolved as unknown as TOutput,
        usage: {
          provider: 'anthropic',
          model: 'mock',
          feature: request.feature,
          endpointType: 'messages',
          status: 'completed',
          inputTokens: 0,
          outputTokens: 0,
          cachedInputTokens: 0,
          cacheWriteTokens: 0,
          cacheDuration: null,
          batch: false,
          latencyMs: 1,
          requestId: 'req-test',
          responseId: 'resp-test',
          pricingVersion: 'test',
          estimatedCostUsd: 0,
          estimatedCostEur: 0,
          usdToEurRate: 1,
          rawUsage: null,
        },
      }
    },
  }
  return { runner, state }
}

const baseConfig = {
  enabled: true,
  horizonDays: 30,
  batchLimit: 5,
  model: 'claude-mock',
  feature: 'post_mortem',
}

describe('createPostMortemUseCases', () => {
  it('skips with status=skipped_disabled when AI_POST_MORTEM_ENABLED is false', async () => {
    const { repo, state: repoState } = buildFakeRepo([makeContext()])
    const { runner, state: runnerState } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: { ...baseConfig, enabled: false },
      demoFixtures: { list: [] },
    })

    const result = await useCases.runPostMortem({
      mode: 'admin',
      requestId: 'req-test',
    })

    expect(result.status).toBe('skipped_disabled')
    expect(result.processed).toBe(0)
    expect(result.persistedIds).toEqual([])
    expect(runnerState.calls).toBe(0)
    expect(repoState.inserted).toEqual([])
  })

  it('skips with status=skipped_budget_blocked when deepAnalysisAllowed is false', async () => {
    const { repo, state: repoState } = buildFakeRepo([makeContext()])
    const { runner, state: runnerState } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: {
        fetchBudgetState: async () =>
          makeBudget({ deepAnalysisAllowed: false, reasons: ['deep_analysis_budget_guard'] }),
      },
      config: baseConfig,
      demoFixtures: { list: [] },
    })

    const result = await useCases.runPostMortem({
      mode: 'admin',
      requestId: 'req-test',
    })

    expect(result.status).toBe('skipped_budget_blocked')
    expect(result.budgetReasons).toContain('deep_analysis_budget_guard')
    expect(runnerState.calls).toBe(0)
    expect(repoState.inserted).toEqual([])
  })

  it('throws in demo mode (defensive — routes also block demo)', async () => {
    const { repo } = buildFakeRepo([])
    const { runner } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })

    let caught: unknown = null
    try {
      await useCases.runPostMortem({ mode: 'demo', requestId: 'req-test' })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).message).toMatch(/admin-only/)
  })

  it('skips with status=skipped_no_due_items when no expired recommendations are due', async () => {
    const { repo } = buildFakeRepo([])
    const { runner, state: runnerState } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })

    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })
    expect(result.status).toBe('skipped_no_due_items')
    expect(runnerState.calls).toBe(0)
  })

  it('runs ONE structured call for the batch and persists one row per due item', async () => {
    const contexts = [
      makeContext({ recommendationId: 1, recommendationKey: 'a' }),
      makeContext({ recommendationId: 2, recommendationKey: 'b' }),
      makeContext({ recommendationId: 3, recommendationKey: 'c' }),
    ]
    const { repo, state: repoState } = buildFakeRepo(contexts)
    const { runner, state: runnerState } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })

    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })

    expect(runnerState.calls).toBe(1)
    expect(runnerState.lastRequest?.feature).toBe('post_mortem')
    expect(runnerState.lastRequest?.schemaName).toBe(postMortemSchemaName)
    expect(runnerState.lastRequest?.systemPrompt).toBe(POST_MORTEM_PROMPT.systemPrompt)
    expect(result.status).toBe('completed')
    expect(result.processed).toBe(3)
    expect(result.persistedIds.length).toBe(3)
    expect(repoState.inserted.length).toBe(3)
    for (const row of repoState.inserted) {
      expect(row.status).toBe('completed')
      expect(row.findings).toBeDefined()
      expect(row.calibration).toBeDefined()
      expect(row.learningActions).toBeDefined()
    }
  })

  it('respects batchLimit (does not loop unbounded)', async () => {
    const contexts = Array.from({ length: 50 }, (_, i) =>
      makeContext({ recommendationId: i + 1, recommendationKey: `k-${i}` })
    )
    const { repo } = buildFakeRepo(contexts)
    const { runner } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: { ...baseConfig, batchLimit: 5 },
      demoFixtures: { list: [] },
    })
    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })
    expect(result.processed).toBe(5)
    expect(result.persistedIds.length).toBe(5)
  })

  it('marks the run as failed when the structured runner throws', async () => {
    const { repo, state: repoState } = buildFakeRepo([makeContext()])
    const { runner } = buildFakeRunner({ error: new Error('upstream-anthropic-503') })
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })
    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })
    expect(result.status).toBe('failed')
    expect(result.reason).toBe('llm_call_failed')
    expect(repoState.inserted[0]?.status).toBe('failed')
    expect(repoState.inserted[0]?.errorCode).toBe('llm_call_failed')
    expect(repoState.inserted[0]?.findings).toBeUndefined()
  })

  it('marks the run as failed when the LLM returns an output that mismatches the schema', async () => {
    const { repo, state: repoState } = buildFakeRepo([makeContext()])
    // The runner returns an object with a wrong version — validation must reject it.
    const { runner } = buildFakeRunner({
      ...makeOutput(),
      version: 'wrong-version' as never,
    })
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })
    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })
    expect(result.status).toBe('failed')
    expect(result.reason).toBe('output_schema_version_mismatch')
    expect(repoState.inserted[0]?.findings).toBeUndefined()
  })

  it('blocks output that contains an execution directive and does NOT persist learning actions', async () => {
    const { repo, state: repoState } = buildFakeRepo([makeContext()])
    const { runner } = buildFakeRunner({
      ...makeOutput(),
      summary:
        'In retrospect the user should buy the dip and stake the rewards before the next event.',
      learningActions: [
        {
          kind: 'caveat',
          title: 'A learning action',
          description: 'Description without execution wording.',
          scope: 'advisory-only',
          confidence: 'medium',
          appliesTo: [],
        },
      ],
    })
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [] },
    })

    const result = await useCases.runPostMortem({ mode: 'admin', requestId: 'req-test' })
    expect(result.status).toBe('failed')
    expect(result.reason).toBe('execution_directive_emitted')

    const inserted = repoState.inserted[0]
    expect(inserted?.status).toBe('failed')
    expect(inserted?.errorCode).toBe('execution_directive_emitted')
    expect(inserted?.learningActions).toBeUndefined()
    expect(inserted?.findings).toBeUndefined()
    const riskNotes = inserted?.riskNotes as { executionTerms?: string[] } | null | undefined
    expect(Array.isArray(riskNotes?.executionTerms)).toBe(true)
    expect((riskNotes?.executionTerms ?? []).length).toBeGreaterThan(0)
  })

  it('GET list returns deterministic demo fixtures in demo mode', async () => {
    const fixture: PersistedPostMortemRow = {
      id: 99,
      runId: null,
      recommendationId: null,
      decisionId: null,
      recommendationKey: 'demo-key',
      status: 'completed',
      horizonDays: 30,
      evaluatedAt: '2026-04-30T09:00:00.000Z',
      expectedOutcomeAt: '2026-04-29T09:00:00.000Z',
      inputSummary: null,
      findings: { summary: 'demo' },
      learningActions: null,
      calibration: null,
      riskNotes: null,
      skippedReason: null,
      errorCode: null,
      createdAt: '2026-04-30T09:00:00.000Z',
      updatedAt: '2026-04-30T09:00:00.000Z',
    }
    const { repo, state: repoState } = buildFakeRepo([])
    const { runner } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: { list: [fixture] },
    })
    const list = await useCases.listPostMortems({ mode: 'demo', requestId: 'req-test' })
    expect(list.items.length).toBe(1)
    expect(list.items[0]?.id).toBe(99)
    expect(repoState.listCalls).toBe(0)
  })

  it('GET list in admin mode hits the repository, not the demo fixtures', async () => {
    const { repo, state: repoState } = buildFakeRepo([])
    const { runner } = buildFakeRunner(makeOutput())
    const useCases = createPostMortemUseCases({
      repository: repo,
      runner,
      budget: { fetchBudgetState: async () => makeBudget() },
      config: baseConfig,
      demoFixtures: {
        list: [
          {
            id: 99,
            runId: null,
            recommendationId: null,
            decisionId: null,
            recommendationKey: null,
            status: 'completed',
            horizonDays: null,
            evaluatedAt: null,
            expectedOutcomeAt: null,
            inputSummary: null,
            findings: null,
            learningActions: null,
            calibration: null,
            riskNotes: null,
            skippedReason: null,
            errorCode: null,
            createdAt: '2026-04-30T09:00:00.000Z',
            updatedAt: '2026-04-30T09:00:00.000Z',
          },
        ],
      },
    })
    const list = await useCases.listPostMortems({ mode: 'admin', requestId: 'req-test' })
    expect(list.items.length).toBe(0)
    expect(repoState.listCalls).toBe(1)
  })
})
