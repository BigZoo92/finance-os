// PR12 — Trading Lab Strategy Scorecard.
// PR14 — additively wires `advancedMetrics` (QuantStats-inspired curated subset, re-implemented
// under our license, never vendored). The PR12 evidenceGrade rules remain authoritative; the
// advanced-metrics output never upgrades the grade. See `compute-advanced-risk-metrics.ts`.
//
// Read-only, deterministic, paper-only research helper. NEVER an execution path.
//
// Rates the QUALITY OF EVIDENCE behind a strategy / paper hypothesis. NOT a profitability or
// predictive claim. The output explicitly avoids any wording that implies a buy/sell directive.
//
// Hard guarantees (verified by tests):
//   • No LLM call. No provider call. No graph ingest. No DB write.
//   • Computation is pure: same inputs ⇒ same scorecard.
//   • Insufficient data ⇒ `insufficient` grade, never an upgrade.
//   • Sample size below threshold ⇒ grade is capped at `weak`.
//   • No walk-forward run ⇒ grade is capped at `promising`.
//   • Missing fees / slippage / very large drawdown ⇒ structured warning/danger flags but the
//     final summary text remains deterministic — no model-written narrative.

import {
  buildDemoAdvancedRiskMetrics,
  computeAdvancedRiskMetrics,
  type AdvancedRiskMetricsEquityPoint,
  type AdvancedRiskMetricsResult,
  type AdvancedRiskMetricsTrade,
} from './compute-advanced-risk-metrics'

export type StrategyScorecardEvidenceGrade =
  | 'insufficient'
  | 'weak'
  | 'promising'
  | 'strong_but_unproven'
  | 'invalidated'

export type StrategyScorecardQualityFlagKind =
  | 'low_sample_size'
  | 'missing_fees'
  | 'missing_slippage'
  | 'high_drawdown'
  | 'no_walk_forward'
  | 'unstable_results'
  | 'insufficient_data'
  | 'paper_only'
  | 'archived'

export interface StrategyScorecardQualityFlag {
  kind: StrategyScorecardQualityFlagKind
  severity: 'info' | 'warning' | 'danger'
  message: string
}

export interface StrategyScorecardSummary {
  totalBacktests: number
  totalTrades: number
  bestRunId: string | null
  latestRunId: string | null
  latestRunAt: string | null
}

export interface StrategyScorecardMetrics {
  winRate: number | null
  expectancy: number | null
  profitFactor: number | null
  maxDrawdown: number | null
  sharpe: number | null
  sortino: number | null
  averageTradeReturn: number | null
  feesIncluded: boolean | null
  slippageIncluded: boolean | null
  walkForwardRuns: number
}

export interface StrategyScorecardResponse {
  generatedAt: string
  strategyId: string
  strategyType: string
  mode: 'demo' | 'admin'
  evidenceGrade: StrategyScorecardEvidenceGrade
  summary: StrategyScorecardSummary
  metrics: StrategyScorecardMetrics
  /**
   * PR14 — additive curated subset of risk/performance metrics inspired by QuantStats,
   * re-implemented under our license. NEVER influences `evidenceGrade`. `null` when no
   * completed run with usable equity/trades data exists.
   */
  advancedMetrics: AdvancedRiskMetricsResult | null
  qualityFlags: StrategyScorecardQualityFlag[]
  caveats: string[]
}

// ---------------------------------------------------------------------------
// Internal scoring shapes — narrow surface accepted by the use-case so the
// caller can pass either the raw drizzle row or a hand-built fake.
// ---------------------------------------------------------------------------

export interface StrategyScorecardInputStrategy {
  id: number
  strategyType: string
  status: 'draft' | 'active-paper' | 'archived'
}

export interface StrategyScorecardInputBacktestRun {
  id: number
  runStatus: 'pending' | 'running' | 'completed' | 'failed'
  feesBps: number | null
  slippageBps: number | null
  metrics: Record<string, unknown> | null
  resultSummary: Record<string, unknown> | null
  createdAt: string | Date
  trades: unknown[] | null
  /** PR14 — optional equity curve passthrough for advanced metrics. Drizzle row carries this
   *  as `Array<{ date: string; equity: number }>`; we keep the type narrow but tolerant. */
  equityCurve?: AdvancedRiskMetricsEquityPoint[] | null
}

// ---------------------------------------------------------------------------
// Threshold constants — tuned conservatively. We deliberately bias toward
// "weak / insufficient" rather than "strong" so the UI never overstates the
// evidence grade.
// ---------------------------------------------------------------------------

export const SCORECARD_MIN_TRADES_FOR_PROMISING = 30
export const SCORECARD_HIGH_DRAWDOWN_WARNING = 0.2
export const SCORECARD_HIGH_DRAWDOWN_DANGER = 0.4
export const SCORECARD_STABLE_PROFIT_FACTOR = 1.3
export const SCORECARD_STABLE_WIN_RATE = 0.5
export const SCORECARD_STABLE_SHARPE = 1.0

const PERMANENT_CAVEATS: readonly string[] = [
  "Paper only. Cette analyse n'est pas une recommandation.",
  'Qualité de preuve, pas une prédiction de performance future.',
  'Les métriques passées ne prédisent pas les résultats futurs.',
]

const numberOrNull = (value: unknown): number | null => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return value
}

const isCompletedRun = (run: StrategyScorecardInputBacktestRun): boolean =>
  run.runStatus === 'completed'

const isWalkForwardRun = (run: StrategyScorecardInputBacktestRun): boolean => {
  const summary = run.resultSummary
  if (!summary || typeof summary !== 'object') return false
  return (summary as { walkForward?: unknown }).walkForward === true
}

const tradesIn = (run: StrategyScorecardInputBacktestRun): number => {
  const fromMetrics = numberOrNull(run.metrics?.total_trades)
  if (fromMetrics !== null) return Math.max(0, Math.floor(fromMetrics))
  if (Array.isArray(run.trades)) return run.trades.length
  return 0
}

const sortRunsNewestFirst = (
  runs: StrategyScorecardInputBacktestRun[]
): StrategyScorecardInputBacktestRun[] =>
  [...runs].sort((a, b) => {
    const aT = a.createdAt instanceof Date ? a.createdAt.getTime() : Date.parse(String(a.createdAt))
    const bT = b.createdAt instanceof Date ? b.createdAt.getTime() : Date.parse(String(b.createdAt))
    return bT - aT
  })

const pickBestRun = (
  runs: StrategyScorecardInputBacktestRun[]
): StrategyScorecardInputBacktestRun | null => {
  let best: { run: StrategyScorecardInputBacktestRun; score: number } | null = null
  for (const run of runs) {
    if (!isCompletedRun(run)) continue
    const profitFactor = numberOrNull(run.metrics?.profit_factor) ?? 0
    const sharpe = numberOrNull(run.metrics?.sharpe) ?? 0
    const dd = numberOrNull(run.metrics?.max_drawdown) ?? 0.5
    const score = profitFactor + sharpe - dd
    if (best === null || score > best.score) best = { run, score }
  }
  return best?.run ?? null
}

const aggregateMetrics = (
  runs: StrategyScorecardInputBacktestRun[]
): StrategyScorecardMetrics => {
  const completed = runs.filter(isCompletedRun)
  if (completed.length === 0) {
    return {
      winRate: null,
      expectancy: null,
      profitFactor: null,
      maxDrawdown: null,
      sharpe: null,
      sortino: null,
      averageTradeReturn: null,
      feesIncluded: null,
      slippageIncluded: null,
      walkForwardRuns: runs.filter(isWalkForwardRun).length,
    }
  }

  const latestCompleted = sortRunsNewestFirst(completed)[0]
  if (!latestCompleted) {
    // Defensive — `completed.length === 0` is handled above; this branch keeps the type narrow.
    return {
      winRate: null,
      expectancy: null,
      profitFactor: null,
      maxDrawdown: null,
      sharpe: null,
      sortino: null,
      averageTradeReturn: null,
      feesIncluded: null,
      slippageIncluded: null,
      walkForwardRuns: runs.filter(isWalkForwardRun).length,
    }
  }
  const m = latestCompleted.metrics ?? {}

  // expectancy and averageTradeReturn are NOT computed by quant-service today.
  // We deliberately stay null when the latest run did not surface them — the
  // alternative would be fabricating numbers.
  const feesIncluded =
    typeof latestCompleted.feesBps === 'number' && latestCompleted.feesBps > 0
      ? true
      : latestCompleted.feesBps === 0
        ? false
        : null
  const slippageIncluded =
    typeof latestCompleted.slippageBps === 'number' && latestCompleted.slippageBps > 0
      ? true
      : latestCompleted.slippageBps === 0
        ? false
        : null

  return {
    winRate: numberOrNull(m.win_rate),
    expectancy: numberOrNull(m.expectancy),
    profitFactor: numberOrNull(m.profit_factor),
    maxDrawdown: numberOrNull(m.max_drawdown),
    sharpe: numberOrNull(m.sharpe),
    sortino: numberOrNull(m.sortino),
    averageTradeReturn: numberOrNull(m.average_trade_return),
    feesIncluded,
    slippageIncluded,
    walkForwardRuns: runs.filter(isWalkForwardRun).length,
  }
}

const buildSummary = (
  runs: StrategyScorecardInputBacktestRun[]
): StrategyScorecardSummary => {
  const completed = runs.filter(isCompletedRun)
  const totalBacktests = runs.length
  const totalTrades = completed.reduce((acc, run) => acc + tradesIn(run), 0)
  const newest = sortRunsNewestFirst(completed)[0] ?? null
  const best = pickBestRun(runs)
  return {
    totalBacktests,
    totalTrades,
    bestRunId: best ? String(best.id) : null,
    latestRunId: newest ? String(newest.id) : null,
    latestRunAt: newest
      ? newest.createdAt instanceof Date
        ? newest.createdAt.toISOString()
        : String(newest.createdAt)
      : null,
  }
}

const buildQualityFlags = ({
  strategy,
  summary,
  metrics,
  hasCompleted,
}: {
  strategy: StrategyScorecardInputStrategy
  summary: StrategyScorecardSummary
  metrics: StrategyScorecardMetrics
  hasCompleted: boolean
}): StrategyScorecardQualityFlag[] => {
  const flags: StrategyScorecardQualityFlag[] = []

  // Permanent reminder — paper-only context.
  flags.push({
    kind: 'paper_only',
    severity: 'info',
    message: 'Recherche paper uniquement, aucune exécution.',
  })

  if (!hasCompleted) {
    flags.push({
      kind: 'insufficient_data',
      severity: 'warning',
      message: 'Aucun backtest complété pour cette stratégie.',
    })
    return flags
  }

  if (summary.totalTrades < SCORECARD_MIN_TRADES_FOR_PROMISING) {
    flags.push({
      kind: 'low_sample_size',
      severity: 'warning',
      message: `Échantillon de trades trop faible (${summary.totalTrades} < ${SCORECARD_MIN_TRADES_FOR_PROMISING}).`,
    })
  }

  // PR12-fix — treat null (unknown) AND zero (assumed-zero) the same way: both reduce
  // scorecard reliability, so both surface a warning. The UI keeps rendering null as "inconnu"
  // so the user can tell the difference, but the warning flag fires in either case.
  if (metrics.feesIncluded !== true) {
    flags.push({
      kind: 'missing_fees',
      severity: 'warning',
      message:
        metrics.feesIncluded === null
          ? 'Frais inconnus dans le dernier backtest — fiabilité réduite.'
          : 'Frais à 0 dans le dernier backtest — résultats non réalistes.',
    })
  }
  if (metrics.slippageIncluded !== true) {
    flags.push({
      kind: 'missing_slippage',
      severity: 'warning',
      message:
        metrics.slippageIncluded === null
          ? 'Slippage inconnu dans le dernier backtest — fiabilité réduite.'
          : 'Slippage à 0 dans le dernier backtest — résultats non réalistes.',
    })
  }

  if (metrics.maxDrawdown !== null) {
    if (metrics.maxDrawdown >= SCORECARD_HIGH_DRAWDOWN_DANGER) {
      flags.push({
        kind: 'high_drawdown',
        severity: 'danger',
        message: `Drawdown maximal ${(metrics.maxDrawdown * 100).toFixed(1)}% — perte de capital potentielle élevée.`,
      })
    } else if (metrics.maxDrawdown >= SCORECARD_HIGH_DRAWDOWN_WARNING) {
      flags.push({
        kind: 'high_drawdown',
        severity: 'warning',
        message: `Drawdown maximal ${(metrics.maxDrawdown * 100).toFixed(1)}% — surveiller la robustesse.`,
      })
    }
  }

  if (metrics.walkForwardRuns === 0) {
    flags.push({
      kind: 'no_walk_forward',
      severity: 'warning',
      message: 'Aucun walk-forward exécuté — robustesse hors-échantillon non vérifiée.',
    })
  }

  // "Unstable results" is a deliberate read on profit_factor that is barely above 1
  // AND a sharpe near zero — i.e. results that look plausible but are not stable.
  if (
    metrics.profitFactor !== null &&
    metrics.profitFactor > 1 &&
    metrics.profitFactor < 1.1 &&
    metrics.sharpe !== null &&
    metrics.sharpe < 0.3
  ) {
    flags.push({
      kind: 'unstable_results',
      severity: 'warning',
      message: 'Profit factor proche de 1 et Sharpe faible — résultats instables.',
    })
  }

  // PR12-fix — archived is a workflow state, not an analytical verdict. We surface it as a
  // dedicated info flag so the UI can render a neutral "archived" badge without implying the
  // hypothesis was invalidated by evidence.
  if (strategy.status === 'archived') {
    flags.push({
      kind: 'archived',
      severity: 'info',
      message:
        'Hypothèse archivée : suivi paper interrompu. Aucune conclusion analytique implicite.',
    })
  }

  return flags
}

const computeEvidenceGrade = ({
  strategy,
  summary,
  metrics,
  hasCompleted,
}: {
  strategy: StrategyScorecardInputStrategy
  summary: StrategyScorecardSummary
  metrics: StrategyScorecardMetrics
  hasCompleted: boolean
}): StrategyScorecardEvidenceGrade => {
  // PR12-fix — `archived` is a workflow state, not an analytical conclusion. We grade the
  // hypothesis on its evidence regardless of archival; the `archived` quality flag below
  // surfaces the workflow state separately. `invalidated` is reserved for an explicit
  // invalidation signal which the existing data model does NOT yet supply, so we never emit it
  // in PR12. The enum stays in the contract so a future PR can wire the explicit-invalidation
  // path without a breaking change.
  void strategy

  // No completed backtest ⇒ insufficient.
  if (!hasCompleted || summary.totalBacktests === 0) return 'insufficient'

  // Honest floor: any time we don't have all the numbers we need, stay weak.
  const haveCorePositiveSignals =
    metrics.profitFactor !== null &&
    metrics.winRate !== null &&
    metrics.sharpe !== null &&
    metrics.maxDrawdown !== null

  if (!haveCorePositiveSignals) return 'weak'

  // Cap at weak when sample size is below the floor.
  if (summary.totalTrades < SCORECARD_MIN_TRADES_FOR_PROMISING) return 'weak'

  // Severe drawdown caps at weak.
  if (metrics.maxDrawdown !== null && metrics.maxDrawdown >= SCORECARD_HIGH_DRAWDOWN_DANGER) {
    return 'weak'
  }

  const stable =
    (metrics.profitFactor ?? 0) >= SCORECARD_STABLE_PROFIT_FACTOR &&
    (metrics.winRate ?? 0) >= SCORECARD_STABLE_WIN_RATE &&
    (metrics.sharpe ?? 0) >= SCORECARD_STABLE_SHARPE &&
    (metrics.maxDrawdown ?? 1) < SCORECARD_HIGH_DRAWDOWN_WARNING

  if (!stable) return 'promising'

  // Without walk-forward we cap at promising.
  if (metrics.walkForwardRuns === 0) return 'promising'

  return 'strong_but_unproven'
}

// PR14 — pulls the latest completed run's equity + trades and lets the helper compute the
// advanced metrics. Returns `null` when no completed run exists; the helper handles all other
// "insufficient data" paths internally and returns null fields + warnings.
const computeAdvancedFromLatestCompleted = (
  runs: StrategyScorecardInputBacktestRun[]
): AdvancedRiskMetricsResult | null => {
  const completed = runs.filter(isCompletedRun)
  if (completed.length === 0) return null
  const newest = sortRunsNewestFirst(completed)[0]
  if (!newest) return null
  const trades = Array.isArray(newest.trades)
    ? (newest.trades as AdvancedRiskMetricsTrade[])
    : null
  return computeAdvancedRiskMetrics({
    equityCurve: newest.equityCurve ?? null,
    trades,
  })
}

export const computeStrategyScorecard = ({
  mode,
  strategy,
  runs,
  generatedAt,
}: {
  mode: 'demo' | 'admin'
  strategy: StrategyScorecardInputStrategy
  runs: StrategyScorecardInputBacktestRun[]
  generatedAt: Date
}): StrategyScorecardResponse => {
  const summary = buildSummary(runs)
  const metrics = aggregateMetrics(runs)
  const hasCompleted = runs.some(isCompletedRun)
  const evidenceGrade = computeEvidenceGrade({ strategy, summary, metrics, hasCompleted })
  const qualityFlags = buildQualityFlags({ strategy, summary, metrics, hasCompleted })
  const advancedMetrics = computeAdvancedFromLatestCompleted(runs)

  return {
    generatedAt: generatedAt.toISOString(),
    strategyId: String(strategy.id),
    strategyType: strategy.strategyType,
    mode,
    evidenceGrade,
    summary,
    metrics,
    advancedMetrics,
    qualityFlags,
    caveats: [...PERMANENT_CAVEATS],
  }
}

// ---------------------------------------------------------------------------
// Demo fixture — deterministic scorecard returned in demo mode WITHOUT
// touching the repository. Mirrors the "promising but unproven" state with
// missing walk-forward, so UI tests can exercise every branch.
// ---------------------------------------------------------------------------

export const buildDemoStrategyScorecard = ({
  strategyId,
  generatedAt,
}: {
  strategyId: number | string
  generatedAt: Date
}): StrategyScorecardResponse => {
  const id = String(strategyId)
  return {
    generatedAt: generatedAt.toISOString(),
    strategyId: id,
    strategyType: 'manual-hypothesis',
    mode: 'demo',
    evidenceGrade: 'promising',
    summary: {
      totalBacktests: 4,
      totalTrades: 48,
      bestRunId: 'demo-best',
      latestRunId: 'demo-latest',
      latestRunAt: '2026-04-26T10:05:02.000Z',
    },
    metrics: {
      winRate: 0.55,
      expectancy: null,
      profitFactor: 1.32,
      maxDrawdown: 0.18,
      sharpe: 1.05,
      sortino: 1.4,
      averageTradeReturn: null,
      feesIncluded: true,
      slippageIncluded: true,
      walkForwardRuns: 0,
    },
    advancedMetrics: buildDemoAdvancedRiskMetrics(),
    qualityFlags: [
      {
        kind: 'paper_only',
        severity: 'info',
        message: 'Recherche paper uniquement, aucune exécution.',
      },
      {
        kind: 'no_walk_forward',
        severity: 'warning',
        message: 'Aucun walk-forward exécuté — robustesse hors-échantillon non vérifiée.',
      },
    ],
    caveats: [...PERMANENT_CAVEATS],
  }
}

// ---------------------------------------------------------------------------
// Repository adapter — narrow read surface so tests can plug a fake.
// ---------------------------------------------------------------------------

export interface StrategyScorecardRepositoryAdapter {
  getStrategy: (id: number) => Promise<StrategyScorecardInputStrategy | null>
  listBacktestRunsForStrategy: (
    strategyId: number
  ) => Promise<StrategyScorecardInputBacktestRun[]>
}

export interface StrategyScorecardUseCase {
  getStrategyScorecard: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    strategyId: number
    now?: Date
  }) => Promise<StrategyScorecardResponse | null>
}

export const createStrategyScorecardUseCase = ({
  repository,
}: {
  repository: StrategyScorecardRepositoryAdapter
}): StrategyScorecardUseCase => ({
  async getStrategyScorecard(input) {
    const generatedAt = input.now ?? new Date()
    if (input.mode === 'demo') {
      return buildDemoStrategyScorecard({ strategyId: input.strategyId, generatedAt })
    }
    const strategy = await repository.getStrategy(input.strategyId)
    if (!strategy) return null
    const runs = await repository.listBacktestRunsForStrategy(input.strategyId)
    return computeStrategyScorecard({
      mode: 'admin',
      strategy,
      runs,
      generatedAt,
    })
  },
})
