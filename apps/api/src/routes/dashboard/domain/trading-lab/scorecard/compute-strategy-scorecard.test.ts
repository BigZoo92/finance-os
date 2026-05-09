import { describe, expect, it } from 'bun:test'
import {
  buildDemoStrategyScorecard,
  computeStrategyScorecard,
  createStrategyScorecardUseCase,
  SCORECARD_MIN_TRADES_FOR_PROMISING,
  type StrategyScorecardInputBacktestRun,
  type StrategyScorecardInputStrategy,
} from './compute-strategy-scorecard'

const baseStrategy: StrategyScorecardInputStrategy = {
  id: 42,
  strategyType: 'manual-hypothesis',
  status: 'active-paper',
}

const completedRun = (
  overrides: Partial<StrategyScorecardInputBacktestRun> = {}
): StrategyScorecardInputBacktestRun => ({
  id: 1,
  runStatus: 'completed',
  feesBps: 10,
  slippageBps: 5,
  metrics: {
    win_rate: 0.55,
    profit_factor: 1.4,
    max_drawdown: 0.15,
    sharpe: 1.1,
    sortino: 1.5,
    total_trades: 50,
  },
  resultSummary: null,
  createdAt: '2026-04-26T10:05:02.000Z',
  trades: null,
  ...overrides,
})

const NOW = new Date('2026-05-08T09:00:00.000Z')

describe('computeStrategyScorecard', () => {
  it('returns evidenceGrade=insufficient with no backtests', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [],
      generatedAt: NOW,
    })
    expect(out.evidenceGrade).toBe('insufficient')
    expect(out.summary.totalBacktests).toBe(0)
    expect(out.summary.totalTrades).toBe(0)
    expect(out.summary.bestRunId).toBeNull()
    expect(out.summary.latestRunId).toBeNull()
    expect(out.metrics.winRate).toBeNull()
    expect(out.metrics.profitFactor).toBeNull()
    expect(out.metrics.feesIncluded).toBeNull()
    expect(out.metrics.slippageIncluded).toBeNull()
    // Permanent paper_only + insufficient_data flags must be present.
    const kinds = out.qualityFlags.map(f => f.kind)
    expect(kinds).toContain('paper_only')
    expect(kinds).toContain('insufficient_data')
  })

  it('caps grade at weak when totalTrades < threshold', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ metrics: { ...completedRun().metrics, total_trades: 12 } })],
      generatedAt: NOW,
    })
    expect(out.summary.totalTrades).toBe(12)
    expect(out.evidenceGrade).toBe('weak')
    expect(out.qualityFlags.some(f => f.kind === 'low_sample_size')).toBe(true)
    expect(
      out.qualityFlags.find(f => f.kind === 'low_sample_size')?.message
    ).toContain(String(SCORECARD_MIN_TRADES_FOR_PROMISING))
  })

  it('produces a missing_fees warning when feesBps is exactly 0', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ feesBps: 0 })],
      generatedAt: NOW,
    })
    expect(out.metrics.feesIncluded).toBe(false)
    const flag = out.qualityFlags.find(f => f.kind === 'missing_fees')
    expect(flag?.severity).toBe('warning')
    expect(flag?.message).toMatch(/Frais à 0/)
  })

  it('produces a missing_fees warning when feesBps is null (unknown)', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ feesBps: null })],
      generatedAt: NOW,
    })
    expect(out.metrics.feesIncluded).toBeNull()
    const flag = out.qualityFlags.find(f => f.kind === 'missing_fees')
    expect(flag?.severity).toBe('warning')
    expect(flag?.message).toMatch(/inconnus?/i)
  })

  it('produces a missing_slippage warning when slippageBps is exactly 0', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ slippageBps: 0 })],
      generatedAt: NOW,
    })
    expect(out.metrics.slippageIncluded).toBe(false)
    const flag = out.qualityFlags.find(f => f.kind === 'missing_slippage')
    expect(flag?.severity).toBe('warning')
    expect(flag?.message).toMatch(/Slippage à 0/)
  })

  it('produces a missing_slippage warning when slippageBps is null (unknown)', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ slippageBps: null })],
      generatedAt: NOW,
    })
    expect(out.metrics.slippageIncluded).toBeNull()
    const flag = out.qualityFlags.find(f => f.kind === 'missing_slippage')
    expect(flag?.severity).toBe('warning')
    expect(flag?.message).toMatch(/inconnu/i)
  })

  it('does not fabricate boolean values when fees / slippage are unknown', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ feesBps: null, slippageBps: null })],
      generatedAt: NOW,
    })
    expect(out.metrics.feesIncluded).toBeNull()
    expect(out.metrics.slippageIncluded).toBeNull()
  })

  it('emits a danger flag and caps grade at weak on very large drawdown', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          metrics: { ...completedRun().metrics, max_drawdown: 0.55, total_trades: 60 },
        }),
      ],
      generatedAt: NOW,
    })
    const dd = out.qualityFlags.find(f => f.kind === 'high_drawdown')
    expect(dd?.severity).toBe('danger')
    expect(out.evidenceGrade).toBe('weak')
  })

  it('emits a warning (not danger) on moderate drawdown', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          metrics: { ...completedRun().metrics, max_drawdown: 0.25, total_trades: 60 },
        }),
      ],
      generatedAt: NOW,
    })
    const dd = out.qualityFlags.find(f => f.kind === 'high_drawdown')
    expect(dd?.severity).toBe('warning')
  })

  it('caps grade at promising without a walk-forward run', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun()],
      generatedAt: NOW,
    })
    expect(out.metrics.walkForwardRuns).toBe(0)
    expect(out.evidenceGrade).toBe('promising')
    expect(out.qualityFlags.some(f => f.kind === 'no_walk_forward')).toBe(true)
  })

  it('counts walk-forward runs from resultSummary.walkForward and unlocks strong_but_unproven', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun(),
        completedRun({ id: 2, resultSummary: { walkForward: true } }),
      ],
      generatedAt: NOW,
    })
    expect(out.metrics.walkForwardRuns).toBe(1)
    expect(out.evidenceGrade).toBe('strong_but_unproven')
  })

  // PR12-fix — archived is a workflow state, not an analytical conclusion.
  it('grades archived strategies with solid evidence the same as active ones (no auto-invalidation)', () => {
    const archivedActiveCompare = (status: 'active-paper' | 'archived') =>
      computeStrategyScorecard({
        mode: 'admin',
        strategy: { ...baseStrategy, status },
        runs: [completedRun()],
        generatedAt: NOW,
      }).evidenceGrade
    expect(archivedActiveCompare('archived')).toBe(archivedActiveCompare('active-paper'))
    expect(archivedActiveCompare('archived')).not.toBe('invalidated')
  })

  it('emits an archived info quality flag when the strategy is archived', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: { ...baseStrategy, status: 'archived' },
      runs: [completedRun()],
      generatedAt: NOW,
    })
    const flag = out.qualityFlags.find(f => f.kind === 'archived')
    expect(flag).toBeDefined()
    expect(flag?.severity).toBe('info')
    expect(flag?.message).toMatch(/archivée/i)
  })

  it('never emits invalidated grade in PR12 (no explicit invalidation evidence yet)', () => {
    // Across a representative matrix of inputs, the use-case must not produce `invalidated`.
    // PR12 ships without an explicit-invalidation signal in the data model; the enum value is
    // reserved for a future PR that wires the explicit evidence path.
    const variants = [
      { status: 'active-paper' as const, runs: [] },
      { status: 'archived' as const, runs: [] },
      { status: 'active-paper' as const, runs: [completedRun()] },
      { status: 'archived' as const, runs: [completedRun()] },
      {
        status: 'archived' as const,
        runs: [
          completedRun({
            metrics: { ...completedRun().metrics, max_drawdown: 0.6, total_trades: 100 },
          }),
        ],
      },
    ]
    for (const v of variants) {
      const out = computeStrategyScorecard({
        mode: 'admin',
        strategy: { ...baseStrategy, status: v.status },
        runs: v.runs,
        generatedAt: NOW,
      })
      expect(out.evidenceGrade).not.toBe('invalidated')
    }
  })

  it('handles null metrics safely without throwing or fabricating values', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          metrics: null,
          feesBps: null,
          slippageBps: null,
        }),
      ],
      generatedAt: NOW,
    })
    expect(out.metrics.winRate).toBeNull()
    expect(out.metrics.profitFactor).toBeNull()
    expect(out.metrics.maxDrawdown).toBeNull()
    expect(out.metrics.feesIncluded).toBeNull()
    expect(out.metrics.slippageIncluded).toBeNull()
    // No fabricated metrics ⇒ grade falls back to weak (we lack the core signals).
    expect(out.evidenceGrade).toBe('weak')
  })

  it('falls back to counting trades.length when metrics.total_trades is missing', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          metrics: { win_rate: 0.55, profit_factor: 1.4, max_drawdown: 0.15, sharpe: 1.1 },
          trades: new Array(40).fill({}),
        }),
      ],
      generatedAt: NOW,
    })
    expect(out.summary.totalTrades).toBe(40)
  })

  it('picks the highest-scoring completed run as bestRunId', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({ id: 100, metrics: { ...completedRun().metrics, profit_factor: 1.2, sharpe: 0.5 } }),
        completedRun({ id: 200, metrics: { ...completedRun().metrics, profit_factor: 2.0, sharpe: 1.5 } }),
        completedRun({ id: 300, metrics: { ...completedRun().metrics, profit_factor: 0.9, sharpe: 0.1 } }),
      ],
      generatedAt: NOW,
    })
    expect(out.summary.bestRunId).toBe('200')
  })

  it('returns the most recent completed run as latestRunId', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({ id: 1, createdAt: '2026-01-01T00:00:00Z' }),
        completedRun({ id: 2, createdAt: '2026-04-01T00:00:00Z' }),
        completedRun({ id: 3, createdAt: '2026-03-01T00:00:00Z' }),
      ],
      generatedAt: NOW,
    })
    expect(out.summary.latestRunId).toBe('2')
    expect(out.summary.latestRunAt).toContain('2026-04-01')
  })

  it('always emits the permanent paper-only caveats', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [],
      generatedAt: NOW,
    })
    expect(out.caveats[0]).toMatch(/Paper only/)
    expect(out.caveats.some(c => /préd/i.test(c))).toBe(true)
  })

  it('never emits execution vocabulary in caveats / messages', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [completedRun({ feesBps: 0, slippageBps: 0 })],
      generatedAt: NOW,
    })
    const banned = ['buy', 'sell', 'execute', 'execution', 'place order', 'leverage', 'futures']
    const wb = (term: string) =>
      term.includes(' ')
        ? new RegExp(term, 'i')
        : new RegExp(`\\b${term}\\b`, 'i')
    const allText = [...out.caveats, ...out.qualityFlags.map(f => f.message)].join(' ')
    for (const term of banned) {
      expect(wb(term).test(allText)).toBe(false)
    }
  })
})

describe('computeStrategyScorecard · PR14 advancedMetrics integration', () => {
  // Build a synthetic equity curve with a real drawdown so the helper produces non-null fields.
  const buildEquity = (n: number) => {
    const baseTs = new Date('2025-01-01T00:00:00Z').getTime()
    const out: Array<{ date: string; equity: number }> = []
    let e = 10000
    for (let i = 0; i < n; i += 1) {
      const drift = 0.0015
      const cycle = 0.012 * Math.sin((i / 7) * Math.PI)
      const dip = i >= 60 && i < 75 ? -0.006 : 0
      e = e * (1 + drift + cycle + dip)
      out.push({ date: new Date(baseTs + i * 24 * 60 * 60 * 1000).toISOString(), equity: e })
    }
    return out
  }

  it('attaches advancedMetrics when the latest completed run carries an equity curve', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          equityCurve: buildEquity(252),
        }),
      ],
      generatedAt: NOW,
    })
    const adv = out.advancedMetrics
    if (adv === null) throw new Error('expected advancedMetrics to be non-null')
    expect(adv.assumptions.annualizationPeriods).toBe(252)
    expect(adv.calmarRatio).not.toBeNull()
    expect(adv.recoveryFactor).not.toBeNull()
  })

  it('returns advancedMetrics=null when no completed run exists', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [],
      generatedAt: NOW,
    })
    expect(out.advancedMetrics).toBeNull()
    expect(out.evidenceGrade).toBe('insufficient')
  })

  it('does NOT upgrade evidenceGrade based on advancedMetrics alone', () => {
    // Only 12 trades → PR12 caps grade at `weak`. Even with a stellar advanced-metrics block,
    // the grade must stay weak.
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          metrics: { ...completedRun().metrics, total_trades: 12 },
          equityCurve: buildEquity(252),
        }),
      ],
      generatedAt: NOW,
    })
    expect(out.evidenceGrade).toBe('weak')
    expect(out.advancedMetrics).not.toBeNull()
  })

  it('does NOT remove or alter PR12 quality flags', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          feesBps: 0,
          slippageBps: 0,
          equityCurve: buildEquity(252),
        }),
      ],
      generatedAt: NOW,
    })
    // PR12 missing-fees + missing-slippage flags must still fire.
    expect(out.qualityFlags.some(f => f.kind === 'missing_fees')).toBe(true)
    expect(out.qualityFlags.some(f => f.kind === 'missing_slippage')).toBe(true)
  })

  it('emits advancedMetrics warnings (insufficient sample) instead of fabricating values', () => {
    const out = computeStrategyScorecard({
      mode: 'admin',
      strategy: baseStrategy,
      runs: [
        completedRun({
          equityCurve: buildEquity(40),
        }),
      ],
      generatedAt: NOW,
    })
    const adv = out.advancedMetrics
    if (adv === null) throw new Error('expected advancedMetrics to be non-null')
    expect(adv.rollingSharpe.latest).toBeNull()
    expect(adv.warnings.length).toBeGreaterThan(0)
  })
})

describe('buildDemoStrategyScorecard', () => {
  it('returns mode=demo with deterministic shape', () => {
    const a = buildDemoStrategyScorecard({ strategyId: 99, generatedAt: NOW })
    const b = buildDemoStrategyScorecard({ strategyId: 99, generatedAt: NOW })
    expect(a.mode).toBe('demo')
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
    expect(a.evidenceGrade).toBe('promising')
  })
})

describe('createStrategyScorecardUseCase', () => {
  const repoCalls: Array<{ kind: 'getStrategy' | 'list'; id: number }> = []
  const buildRepo = (
    strategy: StrategyScorecardInputStrategy | null,
    runs: StrategyScorecardInputBacktestRun[]
  ) => ({
    getStrategy: async (id: number) => {
      repoCalls.push({ kind: 'getStrategy', id })
      return strategy && strategy.id === id ? strategy : null
    },
    listBacktestRunsForStrategy: async (id: number) => {
      repoCalls.push({ kind: 'list', id })
      return runs
    },
  })

  it('returns demo fixture WITHOUT touching the repository in demo mode', async () => {
    repoCalls.length = 0
    const useCase = createStrategyScorecardUseCase({ repository: buildRepo(baseStrategy, []) })
    const out = await useCase.getStrategyScorecard({
      mode: 'demo',
      requestId: 'req',
      strategyId: 1,
      now: NOW,
    })
    expect(out?.mode).toBe('demo')
    expect(repoCalls).toHaveLength(0)
  })

  it('returns null in admin mode when the strategy does not exist', async () => {
    repoCalls.length = 0
    const useCase = createStrategyScorecardUseCase({ repository: buildRepo(null, []) })
    const out = await useCase.getStrategyScorecard({
      mode: 'admin',
      requestId: 'req',
      strategyId: 1,
      now: NOW,
    })
    expect(out).toBeNull()
  })
})
