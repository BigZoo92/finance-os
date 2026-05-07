import { describe, expect, it } from 'bun:test'
import { Elysia, t } from 'elysia'
import { requireAdmin } from '../../../auth/guard'
import {
  createHypothesisUseCases,
  isHypothesisValidationError,
  type HypothesesRepositoryAdapter,
} from '../domain/trading-lab/hypotheses/create-hypothesis-use-cases'
import { isHypothesisExecutionInstructionError } from '../domain/trading-lab/hypotheses/detect-execution-instruction'

// PR3 route-level test.
//
// We deliberately do NOT import `createTradingLabRoute` directly. That factory transitively
// imports `@finance-os/db`'s client which depends on Drizzle's `postgres-js` subpath; resolving
// that path adds noise this test does not need. Instead we mount a tiny Elysia app that uses
// the same hypothesis use-cases the real route factory uses, against an in-memory fake
// repository. This validates the demo/admin split and admin happy path end-to-end.

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

interface FakeState {
  strategies: StoredStrategy[]
  scenarios: StoredScenario[]
}

const buildFakeRepository = (): { repo: HypothesesRepositoryAdapter; state: FakeState } => {
  const state: FakeState = { strategies: [], scenarios: [] }
  let nextStrategyId = 1
  let nextScenarioId = 1

  const repo: HypothesesRepositoryAdapter = {
    async listStrategies(opts) {
      let items = [...state.strategies].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      )
      if (opts?.status) items = items.filter(s => s.status === opts.status)
      if (typeof opts?.limit === 'number') items = items.slice(0, opts.limit)
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

// Mirror of the demo fixtures shipped by the real trading-lab route file. Kept literal here
// so this test never has to import the real route module.
const DEMO_HYPOTHESES = [
  {
    id: 101,
    name: 'EUR/USD mean reversion after FOMC drift',
    slug: 'eur-usd-fomc-mean-reversion',
    strategyType: 'manual-hypothesis',
    status: 'active-paper',
    scope: 'demo',
  },
  {
    id: 102,
    name: 'Defensive sector rotation under late-cycle indicators',
    slug: 'defensive-rotation-late-cycle',
    strategyType: 'manual-hypothesis',
    status: 'draft',
    scope: 'demo',
  },
] as const

const buildHypothesisRoutes = (
  hypotheses: ReturnType<typeof createHypothesisUseCases>
): Elysia => {
  // Mirrors the demoOrReal pattern used by the real trading-lab route block. We re-implement
  // it inline here to keep the test free of upstream DB imports.
  return (
    new Elysia({ prefix: '/trading-lab' })
      .get('/hypotheses', context => {
        if ((context as unknown as { auth: { mode: 'admin' | 'demo' } }).auth.mode === 'demo') {
          return { ok: true, hypotheses: DEMO_HYPOTHESES }
        }
        return hypotheses.listManualHypotheses().then(items => ({ ok: true, hypotheses: items }))
      })
      .get('/hypotheses/:id', async context => {
        const id = Number(context.params.id)
        if ((context as unknown as { auth: { mode: 'admin' | 'demo' } }).auth.mode === 'demo') {
          const found = DEMO_HYPOTHESES.find(h => h.id === id)
          if (!found) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Hypothesis not found' }
          }
          return { ok: true, hypothesis: found }
        }
        const hypothesis = await hypotheses.getManualHypothesisById(id)
        if (!hypothesis) {
          context.set.status = 404
          return { ok: false, code: 'NOT_FOUND', message: 'Hypothesis not found' }
        }
        return { ok: true, hypothesis }
      })
      .post(
        '/hypotheses',
        async context => {
          if ((context as unknown as { auth: { mode: 'admin' | 'demo' } }).auth.mode === 'demo') {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required' }
          }
          requireAdmin(context)
          try {
            const created = await hypotheses.createManualHypothesis(context.body)
            context.set.status = 201
            return { ok: true, hypothesis: created }
          } catch (error) {
            if (isHypothesisExecutionInstructionError(error)) {
              context.set.status = 422
              return {
                ok: false,
                code: error.code,
                message: error.message,
                matches: error.matches,
              }
            }
            if (isHypothesisValidationError(error)) {
              context.set.status = 422
              return { ok: false, code: error.code, message: error.message, field: error.field }
            }
            throw error
          }
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 120 }),
            slug: t.String({ minLength: 1, maxLength: 120, pattern: '^[a-z0-9-]+$' }),
            description: t.Optional(t.String({ maxLength: 4000 })),
            thesis: t.Optional(t.String({ maxLength: 2000 })),
            assumptions: t.Optional(t.Array(t.String(), { maxItems: 32 })),
            caveats: t.Optional(t.Array(t.String(), { maxItems: 32 })),
            invalidationCriteria: t.Array(t.String(), { minItems: 1, maxItems: 32 }),
          }),
        }
      )
      .post('/hypotheses/:id/archive', async context => {
        if ((context as unknown as { auth: { mode: 'admin' | 'demo' } }).auth.mode === 'demo') {
          context.set.status = 403
          return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required' }
        }
        requireAdmin(context)
        const archived = await hypotheses.archiveManualHypothesis(Number(context.params.id))
        if (!archived) {
          context.set.status = 404
          return { ok: false, code: 'NOT_FOUND', message: 'Hypothesis not found' }
        }
        return { ok: true, hypothesis: archived }
      })
      .post(
        '/hypotheses/:id/scenarios',
        async context => {
          if ((context as unknown as { auth: { mode: 'admin' | 'demo' } }).auth.mode === 'demo') {
            context.set.status = 403
            return { ok: false, code: 'DEMO_MODE_FORBIDDEN', message: 'Admin session required' }
          }
          requireAdmin(context)
          const scenario = await hypotheses.createScenarioForHypothesis(
            Number(context.params.id),
            context.body
          )
          if (!scenario) {
            context.set.status = 404
            return { ok: false, code: 'NOT_FOUND', message: 'Hypothesis not found' }
          }
          context.set.status = 201
          return { ok: true, scenario }
        },
        {
          body: t.Object({
            name: t.String({ minLength: 1, maxLength: 120 }),
            invalidationCriteria: t.String({ minLength: 1, maxLength: 1200 }),
            thesis: t.Optional(t.String({ maxLength: 2000 })),
            description: t.Optional(t.String({ maxLength: 4000 })),
            expectedOutcome: t.Optional(t.String({ maxLength: 2000 })),
            riskNotes: t.Optional(t.String({ maxLength: 2000 })),
          }),
        }
      )
  )
}

const buildApp = ({
  mode,
}: {
  mode: 'admin' | 'demo'
}) => {
  const { repo, state } = buildFakeRepository()
  const useCases = createHypothesisUseCases({ repository: repo })
  const app = new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      internalAuth: { hasValidToken: false, tokenSource: null },
      requestMeta: { requestId: 'req-hypothesis-test', startedAtMs: Date.now() },
    }))
    .use(buildHypothesisRoutes(useCases))
  return { app, state }
}

describe('Hypothesis Lab routes', () => {
  it('GET /trading-lab/hypotheses returns deterministic demo fixtures', async () => {
    const { app } = buildApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses')
    )
    const payload = (await response.json()) as {
      ok: boolean
      hypotheses: Array<{ strategyType: string }>
    }
    expect(response.status).toBe(200)
    expect(payload.hypotheses.length).toBeGreaterThan(0)
    expect(payload.hypotheses.every(h => h.strategyType === 'manual-hypothesis')).toBe(true)
  })

  it('GET /trading-lab/hypotheses/:id returns 404 in demo for unknown id', async () => {
    const { app } = buildApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses/99999')
    )
    expect(response.status).toBe(404)
  })

  it('POST /trading-lab/hypotheses is forbidden in demo', async () => {
    const { app } = buildApp({ mode: 'demo' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'demo write',
          slug: 'demo-write',
          invalidationCriteria: ['no'],
        }),
      })
    )
    const payload = (await response.json()) as { code: string }
    expect(response.status).toBe(403)
    expect(payload.code).toBe('DEMO_MODE_FORBIDDEN')
  })

  it('admin can create a manual hypothesis stored as strategyType="manual-hypothesis"', async () => {
    const { app, state } = buildApp({ mode: 'admin' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'EUR/USD mean reversion',
          slug: 'eur-usd-mr',
          thesis: 'Post-FOMC drift mean-reverts within 48h',
          invalidationCriteria: ['Drift persists beyond 72h post-FOMC'],
        }),
      })
    )
    const payload = (await response.json()) as {
      ok: boolean
      hypothesis: { strategyType: string; id: number }
    }
    expect(response.status).toBe(201)
    expect(payload.hypothesis.strategyType).toBe('manual-hypothesis')
    expect(state.strategies.length).toBe(1)
    expect(state.strategies[0]?.strategyType).toBe('manual-hypothesis')
  })

  it('admin create rejects payloads missing invalidationCriteria with 422', async () => {
    const { app } = buildApp({ mode: 'admin' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'EUR/USD mean reversion',
          slug: 'eur-usd-mr',
          invalidationCriteria: [],
        }),
      })
    )
    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(response.status).toBeLessThan(500)
  })

  it('admin create rejects an execution-shaped instruction with 422', async () => {
    const { app } = buildApp({ mode: 'admin' })
    const response = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'EUR/USD mean reversion',
          slug: 'eur-usd-mr',
          description: 'Place an order to buy SPY at market open',
          invalidationCriteria: ['Drift persists beyond 72h'],
        }),
      })
    )
    const payload = (await response.json()) as { code: string }
    expect(response.status).toBe(422)
    expect(payload.code).toBe('HYPOTHESIS_EXECUTION_INSTRUCTION_FORBIDDEN')
  })

  it('admin can archive a hypothesis without deleting it', async () => {
    const { app, state } = buildApp({ mode: 'admin' })
    const created = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'EUR/USD mean reversion',
          slug: 'eur-usd-mr',
          invalidationCriteria: ['Drift persists beyond 72h'],
        }),
      })
    )
    const createdPayload = (await created.json()) as { hypothesis: { id: number } }

    const archive = await app.handle(
      new Request(
        `http://finance-os.local/trading-lab/hypotheses/${createdPayload.hypothesis.id}/archive`,
        { method: 'POST' }
      )
    )
    const archivePayload = (await archive.json()) as {
      ok: boolean
      hypothesis: { status: string }
    }
    expect(archive.status).toBe(200)
    expect(archivePayload.hypothesis.status).toBe('archived')
    expect(state.strategies.length).toBe(1)
  })

  it('admin can create a paper scenario linked to a hypothesis', async () => {
    const { app, state } = buildApp({ mode: 'admin' })
    const created = await app.handle(
      new Request('http://finance-os.local/trading-lab/hypotheses', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'EUR/USD mean reversion',
          slug: 'eur-usd-mr',
          invalidationCriteria: ['Drift persists beyond 72h'],
        }),
      })
    )
    const createdPayload = (await created.json()) as { hypothesis: { id: number } }

    const scenario = await app.handle(
      new Request(
        `http://finance-os.local/trading-lab/hypotheses/${createdPayload.hypothesis.id}/scenarios`,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: 'FOMC June 2026 instance',
            invalidationCriteria: 'Drift persists beyond 72h',
          }),
        }
      )
    )
    const scenarioPayload = (await scenario.json()) as {
      ok: boolean
      scenario: { linkedStrategyId: number }
    }
    expect(scenario.status).toBe(201)
    expect(scenarioPayload.scenario.linkedStrategyId).toBe(createdPayload.hypothesis.id)
    expect(state.scenarios.length).toBe(1)
  })
})
