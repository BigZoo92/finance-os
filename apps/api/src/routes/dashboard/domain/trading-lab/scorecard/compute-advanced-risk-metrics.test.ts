import { describe, expect, it } from 'bun:test'
import {
  buildDemoAdvancedRiskMetrics,
  computeAdvancedRiskMetrics,
  type AdvancedRiskMetricsEquityPoint,
  type AdvancedRiskMetricsTrade,
} from './compute-advanced-risk-metrics'

// ---------------------------------------------------------------------------
// Fixtures — deterministic synthetic equity curves
// ---------------------------------------------------------------------------

const baseDate = new Date('2025-01-01T00:00:00Z')
const dailyTimestamp = (i: number) =>
  new Date(baseDate.getTime() + i * 24 * 60 * 60 * 1000).toISOString()

// Smooth trending curve with mild volatility — covers daily annualisation, percentile metrics,
// rolling Sharpe, rolling drawdown.
const buildSyntheticDaily = (n: number): AdvancedRiskMetricsEquityPoint[] => {
  const points: AdvancedRiskMetricsEquityPoint[] = []
  let equity = 10000
  for (let i = 0; i < n; i += 1) {
    // Trend + zigzag so we get both wins and losses, and a non-trivial drawdown.
    const drift = 0.0015
    const cycle = 0.012 * Math.sin((i / 7) * Math.PI)
    const dip = i >= 60 && i < 75 ? -0.006 : 0
    equity = equity * (1 + drift + cycle + dip)
    points.push({ date: dailyTimestamp(i), equity })
  }
  return points
}

const buildFlatLine = (n: number): AdvancedRiskMetricsEquityPoint[] =>
  Array.from({ length: n }, (_, i) => ({ date: dailyTimestamp(i), equity: 10000 }))

const buildIrregular = (n: number): AdvancedRiskMetricsEquityPoint[] => {
  // Strictly increasing timestamps with irregular gaps (1, 2, 3, 5, 1, 2, 3, 5, ...).
  // Equity oscillates so we get a real drawdown segment.
  const points: AdvancedRiskMetricsEquityPoint[] = []
  const stepDays = [1, 2, 3, 5]
  let dayOffset = 0
  let equity = 10000
  for (let i = 0; i < n; i += 1) {
    dayOffset += stepDays[i % stepDays.length] ?? 1
    const cycle = 0.012 * Math.sin((i / 6) * Math.PI)
    const dip = i >= 40 && i < 55 ? -0.008 : 0
    equity = equity * (1 + 0.0008 + cycle + dip)
    points.push({
      date: new Date(baseDate.getTime() + dayOffset * 24 * 60 * 60 * 1000).toISOString(),
      equity,
    })
  }
  return points
}

const buildTrades = (count: number): AdvancedRiskMetricsTrade[] =>
  Array.from({ length: count }, (_, i) => ({
    pnl: i % 3 === 0 ? -50 : 80, // 1 loss every 3 trades, 2 wins
  }))

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('computeAdvancedRiskMetrics', () => {
  it('computes Calmar / MAR / recovery factor / ulcer index from a smooth daily curve', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    expect(out.assumptions.annualizationPeriods).toBe(252)
    expect(out.calmarRatio).not.toBeNull()
    // Calmar should be a finite ratio; not zero (we have both return and drawdown).
    expect(out.calmarRatio).toBeGreaterThan(0)
    expect(out.marRatio).toBe(out.calmarRatio)
    expect(out.recoveryFactor).not.toBeNull()
    expect(out.recoveryFactor).toBeGreaterThan(0)
    expect(out.ulcerIndex).not.toBeNull()
    expect(out.ulcerIndex).toBeGreaterThanOrEqual(0)
  })

  it('computes tail ratio and omega ratio when sample is large enough', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    expect(out.tailRatio).not.toBeNull()
    expect(out.tailRatio).toBeGreaterThan(0)
    expect(out.omegaRatio).not.toBeNull()
    expect(out.omegaRatio).toBeGreaterThan(0)
  })

  it('reports historical VaR 95 and expected shortfall 95', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    expect(out.valueAtRisk95).not.toBeNull()
    expect(out.expectedShortfall95).not.toBeNull()
    const v = out.valueAtRisk95
    const es = out.expectedShortfall95
    if (v === null || es === null) throw new Error('expected non-null VaR / ES')
    // Historical VaR is typically a NEGATIVE return at the 5th percentile.
    expect(v).toBeLessThanOrEqual(0)
    // Expected shortfall is at least as bad (≤) as VaR.
    expect(es).toBeLessThanOrEqual(v)
    expect(out.assumptions.varConfidence).toBe(0.95)
  })

  it('returns rollingSharpe with latest/min/max/average/window when sample ≥ 60 returns', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    const rs = out.rollingSharpe
    expect(rs.window).toBe(30)
    expect(rs.latest).not.toBeNull()
    expect(rs.min).not.toBeNull()
    expect(rs.max).not.toBeNull()
    expect(rs.average).not.toBeNull()
    if (rs.min === null || rs.max === null) throw new Error('expected non-null rolling Sharpe')
    expect(rs.min).toBeLessThanOrEqual(rs.max)
  })

  it('returns null + warning for rollingSharpe when sample is too short', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(40) })
    expect(out.rollingSharpe.latest).toBeNull()
    expect(out.rollingSharpe.window).toBeNull()
    expect(out.warnings.some(w => /Sharpe glissant/.test(w))).toBe(true)
  })

  it('returns null + warning for rollingMaxDrawdown when equity points are too few', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(40) })
    expect(out.rollingMaxDrawdown.latest).toBeNull()
    expect(out.rollingMaxDrawdown.worst).toBeNull()
    expect(out.rollingMaxDrawdown.window).toBeNull()
    expect(out.warnings.some(w => /drawdown glissant/i.test(w))).toBe(true)
  })

  it('suppresses Calmar / MAR when bar cadence is irregular and emits a warning', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildIrregular(120) })
    expect(out.assumptions.annualizationPeriods).toBeNull()
    expect(out.calmarRatio).toBeNull()
    expect(out.marRatio).toBeNull()
    expect(out.warnings.some(w => /irrégulière|annualisées/i.test(w))).toBe(true)
  })

  it('returns recovery factor even when annualisation is missing (no annualisation needed)', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildIrregular(120) })
    expect(out.recoveryFactor).not.toBeNull()
  })

  it('computes win/loss/payoff from trades when present', () => {
    const out = computeAdvancedRiskMetrics({
      equityCurve: buildSyntheticDaily(120),
      trades: buildTrades(30),
    })
    expect(out.averageWin).toBeCloseTo(80, 6)
    expect(out.averageLoss).toBeCloseTo(-50, 6)
    expect(out.payoffRatio).toBeCloseTo(80 / 50, 6)
  })

  it('returns null win/loss/payoff when no trades have non-zero pnl', () => {
    const out = computeAdvancedRiskMetrics({
      equityCurve: buildSyntheticDaily(120),
      trades: [{ pnl: 0 }, { pnl: null }],
    })
    expect(out.averageWin).toBeNull()
    expect(out.averageLoss).toBeNull()
    expect(out.payoffRatio).toBeNull()
  })

  it('returns all-null + warning when equity curve is empty', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: [] })
    expect(out.calmarRatio).toBeNull()
    expect(out.recoveryFactor).toBeNull()
    expect(out.ulcerIndex).toBeNull()
    expect(out.valueAtRisk95).toBeNull()
    expect(out.expectedShortfall95).toBeNull()
    expect(out.tailRatio).toBeNull()
    expect(out.omegaRatio).toBeNull()
    expect(out.warnings.length).toBeGreaterThan(0)
  })

  it('keeps trade metrics computable even when equity curve is empty', () => {
    const out = computeAdvancedRiskMetrics({
      equityCurve: null,
      trades: buildTrades(15),
    })
    expect(out.averageWin).not.toBeNull()
    expect(out.averageLoss).not.toBeNull()
    expect(out.payoffRatio).not.toBeNull()
    // Equity-derived metrics stay null.
    expect(out.calmarRatio).toBeNull()
    expect(out.ulcerIndex).toBeNull()
  })

  it('returns null Calmar / MAR when drawdown is exactly zero (flat line)', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildFlatLine(252) })
    expect(out.calmarRatio).toBeNull()
    expect(out.marRatio).toBeNull()
    // Recovery factor is 0 / 0 ⇒ null too.
    expect(out.recoveryFactor).toBeNull()
    // Ulcer index is 0 (no drawdown).
    expect(out.ulcerIndex).toBe(0)
    expect(out.warnings.some(w => /Drawdown maximal nul/i.test(w))).toBe(true)
  })

  it('honours a manual annualizationOverride for tests / known timeframes', () => {
    const out = computeAdvancedRiskMetrics({
      equityCurve: buildIrregular(120),
      annualizationOverride: 252,
    })
    expect(out.assumptions.annualizationPeriods).toBe(252)
    expect(out.calmarRatio).not.toBeNull()
  })

  it('rounds outputs to 6 decimals (deterministic, no floating-point noise on the API)', () => {
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    const numericFields: Array<number | null> = [
      out.calmarRatio,
      out.marRatio,
      out.recoveryFactor,
      out.ulcerIndex,
      out.tailRatio,
      out.omegaRatio,
      out.valueAtRisk95,
      out.expectedShortfall95,
      out.rollingSharpe.latest,
      out.rollingSharpe.min,
      out.rollingSharpe.max,
      out.rollingSharpe.average,
      out.rollingMaxDrawdown.latest,
      out.rollingMaxDrawdown.worst,
    ]
    for (const v of numericFields) {
      if (v === null) continue
      // round to 6 decimals AND read back ⇒ same value (idempotent).
      const rounded = Math.round(v * 1e6) / 1e6
      expect(v).toBe(rounded)
    }
  })

  it('never emits execution vocabulary in warnings or assumptions', () => {
    const banned = ['buy', 'sell', 'execute', 'execution', 'place order', 'leverage', 'futures']
    const wb = (term: string) =>
      term.includes(' ')
        ? new RegExp(term, 'i')
        : new RegExp(`\\b${term}\\b`, 'i')
    const out = computeAdvancedRiskMetrics({ equityCurve: buildSyntheticDaily(252) })
    const text = [...out.warnings].join(' ')
    for (const term of banned) {
      expect(wb(term).test(text)).toBe(false)
    }
  })
})

describe('buildDemoAdvancedRiskMetrics', () => {
  it('is deterministic — same call produces same output', () => {
    const a = buildDemoAdvancedRiskMetrics()
    const b = buildDemoAdvancedRiskMetrics()
    expect(JSON.stringify(a)).toBe(JSON.stringify(b))
  })

  it('carries the demo warning + risk-free + var confidence assumptions', () => {
    const out = buildDemoAdvancedRiskMetrics()
    expect(out.warnings.some(w => /démo/i.test(w))).toBe(true)
    expect(out.assumptions.riskFreeRate).toBe(0)
    expect(out.assumptions.varConfidence).toBe(0.95)
  })
})
