// PR14 — Advanced retrospective risk metrics for the Strategy Scorecard.
//
// Pure deterministic math inspired by QuantStats but RE-IMPLEMENTED under our license; no
// QuantStats dependency, no QuantStats source copied. Paper-only / retrospective only.
//
// Hard guarantees verified by tests:
//   • No LLM call. No provider call. No graph ingest. No DB write.
//   • Same inputs ⇒ same outputs (deterministic rounding to 6 decimals on the API surface).
//   • Insufficient data ⇒ `null` per metric AND a structured `warnings` entry. Never a
//     fabricated zero, never a fabricated "0.0".
//   • Annualised metrics (Calmar, MAR, Rolling Sharpe) require a regular bar cadence; if the
//     equity curve has irregular timestamps, the annualised metric is suppressed and a
//     warning explains why.
//   • VaR / Expected Shortfall are explicitly historical estimates — message copy says so.
//   • The output never carries execution vocabulary; the caller may rely on that.

const ROUND_DECIMALS = 6
const MIN_RETURNS_FOR_PERCENTILES = 30
const MIN_RETURNS_FOR_ROLLING = 60
const DEFAULT_ROLLING_WINDOW = 30
const DEFAULT_VAR_CONFIDENCE = 0.95
const DEFAULT_RISK_FREE_RATE = 0
const ANNUALIZATION_DAILY = 252
const ANNUALIZATION_WEEKLY = 52
const ANNUALIZATION_MONTHLY = 12
// Median-bar tolerance: real-world calendar days have weekend gaps, so a daily series shows a
// median bar of 1 day with a few 3-day gaps. We accept anything in [0.7, 1.3] days as "daily".
const DAILY_BAR_TOLERANCE_DAYS = 0.3
const WEEKLY_BAR_TOLERANCE_DAYS = 1.5
const MONTHLY_BAR_TOLERANCE_DAYS = 5

const round = (value: number): number => {
  if (!Number.isFinite(value)) return Number.NaN
  const factor = 10 ** ROUND_DECIMALS
  return Math.round(value * factor) / factor
}

const finiteOrNull = (value: number): number | null =>
  Number.isFinite(value) ? round(value) : null

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface AdvancedRiskMetricsRollingSharpe {
  latest: number | null
  min: number | null
  max: number | null
  average: number | null
  window: number | null
}

export interface AdvancedRiskMetricsRollingMaxDrawdown {
  latest: number | null
  worst: number | null
  window: number | null
}

export interface AdvancedRiskMetricsAssumptions {
  annualizationPeriods: number | null
  riskFreeRate: number
  varConfidence: 0.95
  rollingWindow: number | null
}

export interface AdvancedRiskMetricsResult {
  calmarRatio: number | null
  marRatio: number | null
  recoveryFactor: number | null
  ulcerIndex: number | null
  tailRatio: number | null
  omegaRatio: number | null
  valueAtRisk95: number | null
  expectedShortfall95: number | null
  rollingSharpe: AdvancedRiskMetricsRollingSharpe
  rollingMaxDrawdown: AdvancedRiskMetricsRollingMaxDrawdown
  payoffRatio: number | null
  averageWin: number | null
  averageLoss: number | null
  assumptions: AdvancedRiskMetricsAssumptions
  warnings: string[]
}

export interface AdvancedRiskMetricsEquityPoint {
  date: string | Date | null | undefined
  equity: number | null | undefined
}

export interface AdvancedRiskMetricsTrade {
  pnl?: number | null
}

export interface AdvancedRiskMetricsInput {
  equityCurve: AdvancedRiskMetricsEquityPoint[] | null | undefined
  trades?: AdvancedRiskMetricsTrade[] | null
  // Allow the caller to pin annualisation manually (tests). When absent we infer.
  annualizationOverride?: number
  riskFreeRate?: number
  rollingWindow?: number
  varConfidence?: 0.95
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface NormalizedEquity {
  equities: number[]
  timestamps: number[] // ms since epoch
  validTimestamps: boolean
}

const normalizeEquityCurve = (
  curve: AdvancedRiskMetricsEquityPoint[] | null | undefined
): NormalizedEquity => {
  if (!Array.isArray(curve)) {
    return { equities: [], timestamps: [], validTimestamps: false }
  }
  const equities: number[] = []
  const timestamps: number[] = []
  let validTimestamps = true
  for (const point of curve) {
    const equity =
      typeof point?.equity === 'number' && Number.isFinite(point.equity) ? point.equity : null
    if (equity === null || equity <= 0) {
      // Equity must be strictly positive to compute log/percent returns.
      // Drop the point AND mark timestamps invalid because we lost an interval.
      validTimestamps = false
      continue
    }
    let ts: number | null = null
    if (point?.date instanceof Date) ts = point.date.getTime()
    else if (typeof point?.date === 'string') {
      const parsed = Date.parse(point.date)
      ts = Number.isFinite(parsed) ? parsed : null
    }
    if (ts === null) {
      validTimestamps = false
    }
    equities.push(equity)
    timestamps.push(ts ?? Number.NaN)
  }
  return { equities, timestamps, validTimestamps }
}

const computeReturns = (equities: number[]): number[] => {
  const returns: number[] = []
  for (let i = 1; i < equities.length; i += 1) {
    const prev = equities[i - 1]
    const curr = equities[i]
    if (prev === undefined || curr === undefined || prev <= 0) continue
    returns.push(curr / prev - 1)
  }
  return returns
}

const computeRunningDrawdowns = (equities: number[]): number[] => {
  const dd: number[] = []
  let peak = -Infinity
  for (const e of equities) {
    if (e > peak) peak = e
    if (peak > 0) dd.push(e / peak - 1)
    else dd.push(0)
  }
  return dd
}

const median = (values: number[]): number | null => {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  if (sorted.length % 2 === 0) {
    const lo = sorted[mid - 1]
    const hi = sorted[mid]
    if (lo === undefined || hi === undefined) return null
    return (lo + hi) / 2
  }
  return sorted[mid] ?? null
}

const inferAnnualizationFromTimestamps = (timestamps: number[]): number | null => {
  if (timestamps.length < 2) return null
  const diffsDays: number[] = []
  for (let i = 1; i < timestamps.length; i += 1) {
    const a = timestamps[i - 1]
    const b = timestamps[i]
    if (a === undefined || b === undefined) return null
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null
    const d = (b - a) / (1000 * 60 * 60 * 24)
    if (d <= 0) return null
    diffsDays.push(d)
  }
  const med = median(diffsDays)
  if (med === null) return null
  if (Math.abs(med - 1) <= DAILY_BAR_TOLERANCE_DAYS) return ANNUALIZATION_DAILY
  if (Math.abs(med - 7) <= WEEKLY_BAR_TOLERANCE_DAYS) return ANNUALIZATION_WEEKLY
  if (Math.abs(med - 30) <= MONTHLY_BAR_TOLERANCE_DAYS) return ANNUALIZATION_MONTHLY
  return null
}

const percentile = (sorted: number[], p: number): number => {
  // Linear interpolation. `sorted` MUST be sorted ascending.
  if (sorted.length === 0) return Number.NaN
  const first = sorted[0]
  if (first === undefined) return Number.NaN
  if (sorted.length === 1) return first
  const idx = (sorted.length - 1) * p
  const lo = Math.floor(idx)
  const hi = Math.ceil(idx)
  const loVal = sorted[lo]
  const hiVal = sorted[hi]
  if (loVal === undefined || hiVal === undefined) return Number.NaN
  if (lo === hi) return loVal
  return loVal + (hiVal - loVal) * (idx - lo)
}

const mean = (values: number[]): number =>
  values.length === 0 ? Number.NaN : values.reduce((acc, v) => acc + v, 0) / values.length

const stdDev = (values: number[]): number => {
  if (values.length < 2) return Number.NaN
  const m = mean(values)
  const variance = values.reduce((acc, v) => acc + (v - m) ** 2, 0) / (values.length - 1)
  return Math.sqrt(variance)
}

// ---------------------------------------------------------------------------
// Per-metric computations
// ---------------------------------------------------------------------------

const computeUlcerIndex = (drawdowns: number[]): number | null => {
  if (drawdowns.length === 0) return null
  const meanSqDD = drawdowns.reduce((acc, d) => acc + d * d, 0) / drawdowns.length
  return Math.sqrt(meanSqDD)
}

const computeTailRatio = (sortedReturns: number[]): number | null => {
  if (sortedReturns.length < MIN_RETURNS_FOR_PERCENTILES) return null
  const high = percentile(sortedReturns, 0.95)
  const low = percentile(sortedReturns, 0.05)
  if (low === 0) return null
  return high / Math.abs(low)
}

const computeOmegaRatio = (returns: number[], threshold = 0): number | null => {
  if (returns.length < MIN_RETURNS_FOR_PERCENTILES) return null
  let gains = 0
  let losses = 0
  for (const r of returns) {
    const diff = r - threshold
    if (diff > 0) gains += diff
    else if (diff < 0) losses += -diff
  }
  if (losses === 0) return null
  return gains / losses
}

const computeRollingSharpe = (
  returns: number[],
  window: number,
  annualization: number | null,
  riskFreeRate: number
): AdvancedRiskMetricsRollingSharpe => {
  if (returns.length < window || annualization === null) {
    return { latest: null, min: null, max: null, average: null, window: null }
  }
  const periodRf = riskFreeRate / annualization
  const samples: number[] = []
  for (let i = window; i <= returns.length; i += 1) {
    const slice = returns.slice(i - window, i)
    const m = mean(slice)
    const s = stdDev(slice)
    if (!Number.isFinite(s) || s === 0) continue
    samples.push(((m - periodRf) / s) * Math.sqrt(annualization))
  }
  if (samples.length === 0) {
    return { latest: null, min: null, max: null, average: null, window }
  }
  return {
    latest: finiteOrNull(samples[samples.length - 1] ?? Number.NaN),
    min: finiteOrNull(Math.min(...samples)),
    max: finiteOrNull(Math.max(...samples)),
    average: finiteOrNull(mean(samples)),
    window,
  }
}

const computeRollingMaxDrawdown = (
  equities: number[],
  window: number
): AdvancedRiskMetricsRollingMaxDrawdown => {
  // Window in equity points (not returns) — we look at consecutive equity slices and compute
  // the worst drawdown reached inside each window.
  if (equities.length < window) {
    return { latest: null, worst: null, window: null }
  }
  let latest: number | null = null
  let worst: number | null = null
  for (let i = window; i <= equities.length; i += 1) {
    const slice = equities.slice(i - window, i)
    const dd = computeRunningDrawdowns(slice)
    const minDD = Math.min(...dd)
    if (worst === null || minDD < worst) worst = minDD
    latest = minDD
  }
  return {
    latest: latest === null ? null : finiteOrNull(latest),
    worst: worst === null ? null : finiteOrNull(worst),
    window,
  }
}

const computeFromTrades = (
  trades: AdvancedRiskMetricsTrade[] | null | undefined
): { averageWin: number | null; averageLoss: number | null; payoffRatio: number | null } => {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { averageWin: null, averageLoss: null, payoffRatio: null }
  }
  const wins: number[] = []
  const losses: number[] = []
  for (const t of trades) {
    const pnl = typeof t?.pnl === 'number' && Number.isFinite(t.pnl) ? t.pnl : null
    if (pnl === null) continue
    if (pnl > 0) wins.push(pnl)
    else if (pnl < 0) losses.push(pnl)
  }
  const averageWin = wins.length > 0 ? mean(wins) : null
  const averageLoss = losses.length > 0 ? mean(losses) : null
  let payoffRatio: number | null = null
  if (averageWin !== null && averageLoss !== null && averageLoss !== 0) {
    payoffRatio = averageWin / Math.abs(averageLoss)
  }
  return {
    averageWin: averageWin === null ? null : finiteOrNull(averageWin),
    averageLoss: averageLoss === null ? null : finiteOrNull(averageLoss),
    payoffRatio: payoffRatio === null ? null : finiteOrNull(payoffRatio),
  }
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export const computeAdvancedRiskMetrics = (
  input: AdvancedRiskMetricsInput
): AdvancedRiskMetricsResult => {
  const riskFreeRate =
    typeof input.riskFreeRate === 'number' && Number.isFinite(input.riskFreeRate)
      ? input.riskFreeRate
      : DEFAULT_RISK_FREE_RATE
  const rollingWindowRequested =
    typeof input.rollingWindow === 'number' && input.rollingWindow > 1
      ? Math.floor(input.rollingWindow)
      : DEFAULT_ROLLING_WINDOW
  const varConfidence = (input.varConfidence ?? DEFAULT_VAR_CONFIDENCE) as 0.95

  const warnings: string[] = []
  const empty: AdvancedRiskMetricsResult = {
    calmarRatio: null,
    marRatio: null,
    recoveryFactor: null,
    ulcerIndex: null,
    tailRatio: null,
    omegaRatio: null,
    valueAtRisk95: null,
    expectedShortfall95: null,
    rollingSharpe: { latest: null, min: null, max: null, average: null, window: null },
    rollingMaxDrawdown: { latest: null, worst: null, window: null },
    payoffRatio: null,
    averageWin: null,
    averageLoss: null,
    assumptions: {
      annualizationPeriods: null,
      riskFreeRate,
      varConfidence,
      rollingWindow: null,
    },
    warnings,
  }

  const tradeMetrics = computeFromTrades(input.trades)

  const { equities, timestamps, validTimestamps } = normalizeEquityCurve(input.equityCurve)
  if (equities.length === 0) {
    warnings.push(
      "Aucune courbe d'équité utilisable — seules les métriques basées sur les trades sont calculables."
    )
    return {
      ...empty,
      ...tradeMetrics,
    }
  }

  const annualizationInferred = validTimestamps ? inferAnnualizationFromTimestamps(timestamps) : null
  const annualization =
    typeof input.annualizationOverride === 'number' &&
    Number.isFinite(input.annualizationOverride) &&
    input.annualizationOverride > 0
      ? input.annualizationOverride
      : annualizationInferred
  if (annualization === null) {
    warnings.push(
      'Cadence des barres irrégulière ou inconnue — métriques annualisées (Calmar, MAR, Sharpe glissant) suppriméess.'
    )
  }

  const returns = computeReturns(equities)
  const drawdowns = computeRunningDrawdowns(equities)
  const maxDrawdown = drawdowns.length > 0 ? Math.min(...drawdowns) : null // negative number

  const firstEquity = equities[0]
  const lastEquity = equities[equities.length - 1]
  const totalReturn =
    equities.length >= 2 && firstEquity !== undefined && firstEquity > 0 && lastEquity !== undefined
      ? lastEquity / firstEquity - 1
      : null

  // Annualised return: (1 + totalReturn) ^ (annualization / N_returns) - 1.
  let annualizedReturn: number | null = null
  if (totalReturn !== null && annualization !== null && returns.length > 0) {
    annualizedReturn = (1 + totalReturn) ** (annualization / returns.length) - 1
  }

  // Calmar / MAR: use absolute max drawdown. MAR is treated identically to Calmar under our
  // simplified data model (no separate "MAR-style" rolling-window denominator); see assumptions.
  let calmarRatio: number | null = null
  let marRatio: number | null = null
  if (annualizedReturn !== null && maxDrawdown !== null && maxDrawdown < 0) {
    calmarRatio = annualizedReturn / Math.abs(maxDrawdown)
    marRatio = calmarRatio
  } else if (maxDrawdown === 0 || maxDrawdown === null) {
    if (annualizedReturn !== null) {
      warnings.push(
        'Drawdown maximal nul ou absent — Calmar / MAR non calculables sur cette série.'
      )
    }
  }

  // Recovery factor: total return / abs(max drawdown). Does NOT need annualisation.
  let recoveryFactor: number | null = null
  if (totalReturn !== null && maxDrawdown !== null && maxDrawdown < 0) {
    recoveryFactor = totalReturn / Math.abs(maxDrawdown)
  }

  const ulcerIndex = computeUlcerIndex(drawdowns)

  const sortedReturns = [...returns].sort((a, b) => a - b)

  let valueAtRisk95: number | null = null
  let expectedShortfall95: number | null = null
  if (sortedReturns.length < MIN_RETURNS_FOR_PERCENTILES) {
    warnings.push(
      `Échantillon de rendements trop court pour VaR/CVaR historiques (${sortedReturns.length} < ${MIN_RETURNS_FOR_PERCENTILES}).`
    )
  } else {
    valueAtRisk95 = percentile(sortedReturns, 1 - varConfidence)
    const varThreshold = valueAtRisk95
    const tailSlice = sortedReturns.filter(r => r <= varThreshold)
    expectedShortfall95 = tailSlice.length > 0 ? mean(tailSlice) : null
  }

  const tailRatio = computeTailRatio(sortedReturns)
  if (tailRatio === null && sortedReturns.length >= MIN_RETURNS_FOR_PERCENTILES) {
    warnings.push('Tail ratio non calculable (5e percentile à zéro).')
  }
  const omegaRatio = computeOmegaRatio(returns)

  const rollingSharpe =
    returns.length >= MIN_RETURNS_FOR_ROLLING
      ? computeRollingSharpe(returns, rollingWindowRequested, annualization, riskFreeRate)
      : { latest: null, min: null, max: null, average: null, window: null }
  if (returns.length < MIN_RETURNS_FOR_ROLLING) {
    warnings.push(
      `Échantillon insuffisant pour le Sharpe glissant (${returns.length} < ${MIN_RETURNS_FOR_ROLLING}).`
    )
  } else if (annualization === null) {
    // Already warned about annualisation; keep the rolling field as null so the UI honours it.
  }
  const rollingMaxDrawdown =
    equities.length >= MIN_RETURNS_FOR_ROLLING
      ? computeRollingMaxDrawdown(equities, rollingWindowRequested)
      : { latest: null, worst: null, window: null }
  if (equities.length < MIN_RETURNS_FOR_ROLLING) {
    warnings.push(
      `Courbe d'équité insuffisante pour le drawdown glissant (${equities.length} < ${MIN_RETURNS_FOR_ROLLING}).`
    )
  }

  return {
    calmarRatio: calmarRatio === null ? null : finiteOrNull(calmarRatio),
    marRatio: marRatio === null ? null : finiteOrNull(marRatio),
    recoveryFactor: recoveryFactor === null ? null : finiteOrNull(recoveryFactor),
    ulcerIndex: ulcerIndex === null ? null : finiteOrNull(ulcerIndex),
    tailRatio: tailRatio === null ? null : finiteOrNull(tailRatio),
    omegaRatio: omegaRatio === null ? null : finiteOrNull(omegaRatio),
    valueAtRisk95: valueAtRisk95 === null ? null : finiteOrNull(valueAtRisk95),
    expectedShortfall95:
      expectedShortfall95 === null ? null : finiteOrNull(expectedShortfall95),
    rollingSharpe,
    rollingMaxDrawdown,
    payoffRatio: tradeMetrics.payoffRatio,
    averageWin: tradeMetrics.averageWin,
    averageLoss: tradeMetrics.averageLoss,
    assumptions: {
      annualizationPeriods: annualization,
      riskFreeRate,
      varConfidence,
      rollingWindow:
        rollingSharpe.window ?? rollingMaxDrawdown.window ?? null,
    },
    warnings,
  }
}

export const buildDemoAdvancedRiskMetrics = (): AdvancedRiskMetricsResult => ({
  // Deterministic illustrative values. Marked with a warning that this is a demo fixture so
  // the UI cannot be mistaken for live analysis. The shape mirrors a realistic "promising but
  // unproven" hypothesis (~252 daily returns, mid-Sharpe, modest drawdown).
  calmarRatio: 0.62,
  marRatio: 0.62,
  recoveryFactor: 0.94,
  ulcerIndex: 0.0421,
  tailRatio: 1.18,
  omegaRatio: 1.27,
  valueAtRisk95: -0.0142,
  expectedShortfall95: -0.0218,
  rollingSharpe: { latest: 1.12, min: 0.34, max: 1.85, average: 1.05, window: 30 },
  rollingMaxDrawdown: { latest: -0.087, worst: -0.182, window: 30 },
  payoffRatio: 1.31,
  averageWin: 124.6,
  averageLoss: -95.2,
  assumptions: {
    annualizationPeriods: 252,
    riskFreeRate: 0,
    varConfidence: 0.95,
    rollingWindow: 30,
  },
  warnings: [
    "Mode démo : métriques déterministes, non issues d'une session réelle.",
  ],
})
