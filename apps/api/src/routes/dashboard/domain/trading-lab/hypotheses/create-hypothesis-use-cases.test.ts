import { describe, expect, it } from 'bun:test'
import {
  createHypothesisUseCases,
  type HypothesisValidationError,
  isHypothesisValidationError,
  MANUAL_HYPOTHESIS_TYPE,
  type HypothesesRepositoryAdapter,
  type ManualHypothesisCreateInput,
} from './create-hypothesis-use-cases'
import { isHypothesisExecutionInstructionError } from './detect-execution-instruction'

interface StoredStrategy {
  id: number
  name: string
  slug: string
  description: string | null
  strategyType: string
  status: 'draft' | 'active-paper' | 'archived'
  enabled: boolean
  tags: string[]
  parameters: Record<string, unknown>
  indicators: Array<{ name: string; params: Record<string, unknown> }>
  entryRules: Array<{ id: string; description: string; condition: string }>
  exitRules: Array<{ id: string; description: string; condition: string }>
  riskRules: Array<{ id: string; description: string; condition: string }>
  assumptions: string[]
  caveats: string[]
  scope: 'admin' | 'demo'
  createdAt: Date
  updatedAt: Date
}

interface StoredScenario {
  id: number
  name: string
  description: string | null
  linkedSignalItemId: number | null
  linkedNewsArticleId: number | null
  linkedStrategyId: number | null
  status: 'open' | 'tracking' | 'invalidated' | 'confirmed' | 'archived'
  thesis: string | null
  expectedOutcome: string | null
  invalidationCriteria: string | null
  riskNotes: string | null
  scope: 'admin' | 'demo'
  createdAt: Date
  updatedAt: Date
}

interface FakeRepoState {
  strategies: StoredStrategy[]
  scenarios: StoredScenario[]
  llmCalls: number
  providerCalls: number
  graphCalls: number
  knowledgeCalls: number
}

const buildFakeRepository = (): {
  repo: HypothesesRepositoryAdapter
  state: FakeRepoState
} => {
  const state: FakeRepoState = {
    strategies: [],
    scenarios: [],
    llmCalls: 0,
    providerCalls: 0,
    graphCalls: 0,
    knowledgeCalls: 0,
  }
  let nextStrategyId = 1
  let nextScenarioId = 1

  const repo: HypothesesRepositoryAdapter = {
    async listStrategies(opts) {
      let items = [...state.strategies].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      if (opts?.status) items = items.filter(s => s.status === opts.status)
      if (typeof opts?.limit === 'number') items = items.slice(0, opts.limit)
      // The test cast matches what `tradingLabStrategy.$inferSelect` produces at runtime.
      return items as unknown as Awaited<ReturnType<HypothesesRepositoryAdapter['listStrategies']>>
    },
    async getStrategy(id) {
      const found = state.strategies.find(s => s.id === id)
      return (found ?? null) as unknown as Awaited<
        ReturnType<HypothesesRepositoryAdapter['getStrategy']>
      >
    },
    async createStrategy(input) {
      const now = new Date()
      const created: StoredStrategy = {
        id: nextStrategyId++,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        strategyType: (input.strategyType ?? 'experimental') as string,
        status: (input.status ?? 'draft') as StoredStrategy['status'],
        enabled: input.enabled ?? true,
        tags: input.tags ?? [],
        parameters: input.parameters ?? {},
        indicators: input.indicators ?? [],
        entryRules: input.entryRules ?? [],
        exitRules: input.exitRules ?? [],
        riskRules: input.riskRules ?? [],
        assumptions: input.assumptions ?? [],
        caveats: input.caveats ?? [],
        scope: 'admin',
        createdAt: now,
        updatedAt: now,
      }
      state.strategies.push(created)
      return created as unknown as Awaited<
        ReturnType<HypothesesRepositoryAdapter['createStrategy']>
      >
    },
    async updateStrategy(id, patch) {
      const idx = state.strategies.findIndex(s => s.id === id)
      if (idx === -1) {
        return null as unknown as Awaited<
          ReturnType<HypothesesRepositoryAdapter['updateStrategy']>
        >
      }
      const current = state.strategies[idx] as StoredStrategy
      const merged: StoredStrategy = {
        ...current,
        ...(patch as Partial<StoredStrategy>),
        updatedAt: new Date(),
      }
      state.strategies[idx] = merged
      return merged as unknown as Awaited<
        ReturnType<HypothesesRepositoryAdapter['updateStrategy']>
      >
    },
    async archiveStrategy(id) {
      return repo.updateStrategy(id, { status: 'archived' })
    },
    async createScenario(input) {
      const now = new Date()
      const created: StoredScenario = {
        id: nextScenarioId++,
        name: input.name,
        description: input.description ?? null,
        linkedSignalItemId: input.linkedSignalItemId ?? null,
        linkedNewsArticleId: input.linkedNewsArticleId ?? null,
        linkedStrategyId: input.linkedStrategyId ?? null,
        status: 'open',
        thesis: input.thesis ?? null,
        expectedOutcome: input.expectedOutcome ?? null,
        invalidationCriteria: input.invalidationCriteria ?? null,
        riskNotes: input.riskNotes ?? null,
        scope: 'admin',
        createdAt: now,
        updatedAt: now,
      }
      state.scenarios.push(created)
      return created as unknown as Awaited<
        ReturnType<HypothesesRepositoryAdapter['createScenario']>
      >
    },
  }

  return { repo, state }
}

const validCreateInput = (
  overrides?: Partial<ManualHypothesisCreateInput>
): ManualHypothesisCreateInput => ({
  name: 'EUR/USD post-FOMC mean reversion',
  slug: 'eur-usd-fomc-mr',
  thesis: 'Post-FOMC drift will mean-revert within 48h.',
  description: 'Paper-only manual hypothesis testing post-FOMC drift behaviour.',
  invalidationCriteria: ['Drift persists beyond 72h post-FOMC across 3 events'],
  assumptions: ['Liquidity comparable to historical sample'],
  caveats: ['Paper-only run, not financial advice'],
  ...overrides,
})

describe('createHypothesisUseCases', () => {
  it('creates a manual hypothesis with structured parameters.hypothesis and free-form caveats', async () => {
    const { repo, state } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(validCreateInput())

    expect(created.strategyType).toBe(MANUAL_HYPOTHESIS_TYPE)
    expect(created.name).toBe('EUR/USD post-FOMC mean reversion')

    // Caveats are now strictly free-form — no `invalidation: ` prefix is persisted.
    expect(created.caveats.every((c: string) => !c.startsWith('invalidation: '))).toBe(true)

    // Hypothesis-specific data lives under `parameters.hypothesis` (structured).
    const params = created.parameters as Record<string, unknown>
    expect(params._hypothesisThesis).toBeUndefined()
    const hypothesis = params.hypothesis as {
      thesis: string | null
      invalidationCriteria: string[]
    }
    expect(hypothesis.thesis).toBe('Post-FOMC drift will mean-revert within 48h.')
    expect(hypothesis.invalidationCriteria).toEqual([
      'Drift persists beyond 72h post-FOMC across 3 events',
    ])

    expect(state.strategies.length).toBe(1)
    expect(state.strategies[0]?.strategyType).toBe(MANUAL_HYPOTHESIS_TYPE)
    expect(state.llmCalls).toBe(0)
    expect(state.providerCalls).toBe(0)
    expect(state.graphCalls).toBe(0)
    expect(state.knowledgeCalls).toBe(0)
  })

  it('persists evidenceNotes and horizon under parameters.hypothesis when supplied', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(
      validCreateInput({
        evidenceNotes: ['Backtest n=240 on EUR/USD daily bars'],
        horizon: '90d',
      })
    )
    const hypothesis = (created.parameters as Record<string, unknown>).hypothesis as {
      evidenceNotes?: string[]
      horizon?: string | null
    }
    expect(hypothesis.evidenceNotes).toEqual(['Backtest n=240 on EUR/USD daily bars'])
    expect(hypothesis.horizon).toBe('90d')
  })

  it('preserves user-supplied parameters alongside parameters.hypothesis on create', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(
      validCreateInput({
        parameters: { fastPeriod: 10, slowPeriod: 30, customMeta: { source: 'trader-notes' } },
      })
    )
    const params = created.parameters as Record<string, unknown>
    expect(params.fastPeriod).toBe(10)
    expect(params.slowPeriod).toBe(30)
    expect(params.customMeta).toEqual({ source: 'trader-notes' })
    expect((params.hypothesis as { thesis: string | null }).thesis).toBe(
      'Post-FOMC drift will mean-revert within 48h.'
    )
  })

  it('rejects creation when invalidationCriteria is empty', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    let caught: unknown = null
    try {
      await useCases.createManualHypothesis(
        validCreateInput({ invalidationCriteria: [] })
      )
    } catch (error) {
      caught = error
    }
    expect(isHypothesisValidationError(caught)).toBe(true)
    expect((caught as HypothesisValidationError).code).toBe('INVALIDATION_CRITERIA_REQUIRED')
  })

  it('rejects creation when payload contains an execution-shaped instruction', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    let caught: unknown = null
    try {
      await useCases.createManualHypothesis(
        validCreateInput({
          description: 'Paper-only test. Then place an order to buy SPY at market open.',
        })
      )
    } catch (error) {
      caught = error
    }
    expect(isHypothesisExecutionInstructionError(caught)).toBe(true)
  })

  it('also rejects bare imperative phrases like "buy now" without a directive marker', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    let caught: unknown = null
    try {
      await useCases.createManualHypothesis(
        validCreateInput({
          thesis: 'EUR/USD looks weak: sell now and watch the rebound.',
        })
      )
    } catch (error) {
      caught = error
    }
    expect(isHypothesisExecutionInstructionError(caught)).toBe(true)
  })

  it('lists only manual-hypothesis rows', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    await useCases.createManualHypothesis(validCreateInput())
    // A non-hypothesis strategy created directly through the repo (e.g. a benchmark).
    await repo.createStrategy({
      name: 'Buy & Hold benchmark',
      slug: 'buy-and-hold',
      strategyType: 'benchmark',
    })

    const items = await useCases.listManualHypotheses()
    expect(items.length).toBe(1)
    expect(items[0]?.strategyType).toBe(MANUAL_HYPOTHESIS_TYPE)
  })

  it('update preserves parameters.hypothesis when only unrelated caveats change', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(validCreateInput())
    const updated = await useCases.updateManualHypothesis(created.id, {
      name: 'Renamed hypothesis',
      caveats: ['Replaced caveat'],
    })

    expect(updated?.name).toBe('Renamed hypothesis')
    // Caveats are now free-form. The hypothesis sub-object is preserved structurally.
    expect(updated?.caveats.every((c: string) => !c.startsWith('invalidation: '))).toBe(true)
    expect(updated?.caveats).toEqual(['Replaced caveat'])

    const hypothesis = (updated?.parameters as Record<string, unknown>).hypothesis as {
      thesis: string | null
      invalidationCriteria: string[]
    }
    expect(hypothesis.thesis).toBe('Post-FOMC drift will mean-revert within 48h.')
    expect(hypothesis.invalidationCriteria).toEqual([
      'Drift persists beyond 72h post-FOMC across 3 events',
    ])
  })

  it('update can change parameters.hypothesis.invalidationCriteria', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(validCreateInput())
    const updated = await useCases.updateManualHypothesis(created.id, {
      invalidationCriteria: [
        'Drift persists beyond 96h post-FOMC',
        'EUR/USD realized vol > 2.0x baseline',
      ],
    })
    const hypothesis = (updated?.parameters as Record<string, unknown>).hypothesis as {
      invalidationCriteria: string[]
    }
    expect(hypothesis.invalidationCriteria).toEqual([
      'Drift persists beyond 96h post-FOMC',
      'EUR/USD realized vol > 2.0x baseline',
    ])
  })

  it('update preserves unrelated user parameters when patching parameters', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(
      validCreateInput({ parameters: { fastPeriod: 10, slowPeriod: 30 } })
    )
    const updated = await useCases.updateManualHypothesis(created.id, {
      parameters: { slowPeriod: 50, breakeven: true },
    })
    const params = updated?.parameters as Record<string, unknown>

    // fastPeriod survives; slowPeriod is updated; breakeven is added.
    expect(params.fastPeriod).toBe(10)
    expect(params.slowPeriod).toBe(50)
    expect(params.breakeven).toBe(true)

    // Hypothesis sub-object survives untouched.
    const hypothesis = params.hypothesis as {
      thesis: string | null
      invalidationCriteria: string[]
    }
    expect(hypothesis.thesis).toBe('Post-FOMC drift will mean-revert within 48h.')
    expect(hypothesis.invalidationCriteria.length).toBeGreaterThan(0)
  })

  it('update rejects raw `hypothesis` key in parameters input — hypothesis edits go through dedicated fields', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(validCreateInput())
    const updated = await useCases.updateManualHypothesis(created.id, {
      // A caller trying to overwrite hypothesis via parameters must not succeed.
      parameters: { hypothesis: { thesis: 'malicious override', invalidationCriteria: [] } },
    })
    const hypothesis = (updated?.parameters as Record<string, unknown>).hypothesis as {
      thesis: string | null
      invalidationCriteria: string[]
    }
    expect(hypothesis.thesis).toBe('Post-FOMC drift will mean-revert within 48h.')
    expect(hypothesis.invalidationCriteria.length).toBeGreaterThan(0)
  })

  it('archives a manual hypothesis without deleting it', async () => {
    const { repo, state } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const created = await useCases.createManualHypothesis(validCreateInput())
    const archived = await useCases.archiveManualHypothesis(created.id)

    expect(archived?.status).toBe('archived')
    // Row is still present, not deleted.
    expect(state.strategies.length).toBe(1)
    expect(state.strategies[0]?.status).toBe('archived')
  })

  it('archive returns null for non-hypothesis strategies', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const benchmark = await repo.createStrategy({
      name: 'Buy & Hold benchmark',
      slug: 'buy-and-hold',
      strategyType: 'benchmark',
    })
    const archived = await useCases.archiveManualHypothesis(benchmark.id)
    expect(archived).toBeNull()
  })

  it('creates a paper scenario linked to a hypothesis with required invalidation criteria', async () => {
    const { repo, state } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const hypothesis = await useCases.createManualHypothesis(validCreateInput())
    const scenario = await useCases.createScenarioForHypothesis(hypothesis.id, {
      name: 'FOMC June 2026 instance',
      thesis: 'June 2026 FOMC drift mean-reverts within 48h',
      invalidationCriteria: 'Drift persists beyond 72h post-FOMC',
    })

    expect(scenario).not.toBeNull()
    expect(scenario?.linkedStrategyId).toBe(hypothesis.id)
    expect(scenario?.invalidationCriteria).toBe('Drift persists beyond 72h post-FOMC')
    expect(state.scenarios.length).toBe(1)
  })

  it('rejects scenario creation that contains an execution-shaped instruction', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const hypothesis = await useCases.createManualHypothesis(validCreateInput())

    let caught: unknown = null
    try {
      await useCases.createScenarioForHypothesis(hypothesis.id, {
        name: 'A scenario with a directive',
        thesis: 'You should buy SPY before the open and place an order at market.',
        invalidationCriteria: 'Drift persists beyond 72h',
      })
    } catch (error) {
      caught = error
    }
    expect(isHypothesisExecutionInstructionError(caught)).toBe(true)
  })

  it('scenario inherits invalidation from parameters.hypothesis when not supplied on input', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const hypothesis = await useCases.createManualHypothesis(
      validCreateInput({
        invalidationCriteria: [
          'Drift persists beyond 72h post-FOMC',
          'EUR/USD realized vol > 1.5x',
        ],
      })
    )
    const scenario = await useCases.createScenarioForHypothesis(hypothesis.id, {
      name: 'Inherited invalidation scenario',
      // no invalidationCriteria supplied — should fall back to hypothesis structured value
    })
    expect(scenario).not.toBeNull()
    expect(scenario?.invalidationCriteria).toBe(
      'Drift persists beyond 72h post-FOMC; EUR/USD realized vol > 1.5x'
    )
  })

  it('createScenarioForHypothesis returns null when the parent strategy is not a manual hypothesis', async () => {
    const { repo } = buildFakeRepository()
    const useCases = createHypothesisUseCases({ repository: repo })

    const benchmark = await repo.createStrategy({
      name: 'Buy & Hold benchmark',
      slug: 'buy-and-hold',
      strategyType: 'benchmark',
    })
    const scenario = await useCases.createScenarioForHypothesis(benchmark.id, {
      name: 'should not be created',
      invalidationCriteria: 'irrelevant',
    })
    expect(scenario).toBeNull()
  })
})
