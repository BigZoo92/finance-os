/**
 * PR10 — Trading Lab pattern detection: demo fixture builder.
 *
 * Lives in its own module (no DB / quant-service imports) so unit tests can
 * import it without pulling the full route factory's transitive dependencies.
 *
 * Demo fixtures are deterministic: same input body produces the same output
 * (matching the production engine's identity contract). The helper NEVER
 * makes a network call, NEVER calls the LLM, and NEVER touches the graph.
 */

const DEMO_GENERATED_AT = '2026-05-08T09:00:00.000Z'
const DEMO_OBSERVED_AT = '2026-05-07T16:00:00+00:00'

const ALL_PATTERN_KEYS = [
  'ema20_horizontal_level',
  'ema200_one_touch',
  'parabolic_sar_rci',
  'volume_profile_zones',
  // PR15B — SMC/ICT keys exposed for demo selection. The demo helper renders an FVG
  // detection deterministically; other SMC keys can be selected but produce no fixture.
  'fair_value_gap',
  'liquidity_sweep',
  'break_of_structure',
  'change_of_character',
  'order_block_candidate',
] as const

export interface PatternDetectionDemoBody {
  symbol?: string
  timeframe?: string
  candles?: unknown[]
  patterns?: string[]
}

export const buildDemoPatternDetectionResponse = (body: unknown) => {
  const input = (body ?? {}) as PatternDetectionDemoBody
  const candleCount = Array.isArray(input.candles) ? input.candles.length : 0
  const requested =
    Array.isArray(input.patterns) && input.patterns.length > 0
      ? input.patterns
      : [...ALL_PATTERN_KEYS]
  const detections: Array<Record<string, unknown>> = []

  if (requested.includes('ema20_horizontal_level')) {
    detections.push({
      id: 'det_demo_ema20_level',
      patternType: 'ema20_horizontal_level',
      direction: 'neutral',
      confidence: 'low',
      observedAt: DEMO_OBSERVED_AT,
      evidence: [
        'EMA20 confluence with retested horizontal level (demo fixture).',
        'Demo fixture is deterministic and not derived from live market data.',
      ],
      invalidationHints: [
        'A sustained close beyond the level by more than the tolerance band invalidates the confluence.',
      ],
      metrics: { level: 100, ema20: 100.05, retestCount: 4, candlesUsed: candleCount },
      limitations: [
        'Demo fixture: numbers are illustrative. Run an admin session for real detections.',
        'Pattern is observational; it does NOT predict price direction.',
      ],
    })
  }
  if (requested.includes('fair_value_gap')) {
    detections.push({
      id: 'det_demo_fvg_bullish',
      patternType: 'fair_value_gap',
      direction: 'bullish',
      confidence: 'low',
      observedAt: DEMO_OBSERVED_AT,
      evidence: [
        '3-candle FVG (bullish) detected on a displacement candle (demo fixture).',
        'Gap range: [99.95, 100.65].',
        'Mitigation: no.',
      ],
      invalidationHints: [
        'Gap mitigation by a subsequent candle invalidates the unmitigated FVG read.',
        'A reversal in the displacement direction within a few candles weakens the FVG inference.',
      ],
      metrics: {
        gapLow: 99.95,
        gapHigh: 100.65,
        displacementAtr: 0.42,
        mitigated: false,
        mitigationIndex: -1,
        candlesUsed: candleCount,
      },
      limitations: [
        'Demo fixture: numbers are illustrative. Run an admin session for real detections.',
        'Detection is heuristic; SMC/ICT concepts are interpretive and subjective.',
        'Pattern is observational; it does NOT predict price direction.',
      ],
    })
  }
  if (requested.includes('parabolic_sar_rci')) {
    detections.push({
      id: 'det_demo_sar_rci',
      patternType: 'parabolic_sar_rci',
      direction: 'neutral',
      confidence: 'low',
      observedAt: DEMO_OBSERVED_AT,
      evidence: ['Demo SAR/RCI fixture, low confidence.'],
      invalidationHints: ['SAR flip on the next candle invalidates the alignment read.'],
      metrics: {
        sarTrend: 1,
        rci14: 12.5,
        aligned: false,
        diverged: false,
        candlesUsed: candleCount,
      },
      limitations: [
        'Demo fixture: not based on live data.',
        'Pattern reads regime, not outcome. No directional certainty implied.',
      ],
    })
  }
  return {
    ok: true,
    generatedAt: DEMO_GENERATED_AT,
    timeframe: input.timeframe ?? '1d',
    ...(input.symbol !== undefined ? { symbol: input.symbol } : {}),
    dataQuality: {
      candleCount,
      hasVolume: false,
      sufficient: candleCount >= 60,
      warnings: candleCount < 60 ? ['Demo fixture: candle count below recommended threshold.'] : [],
    },
    detections,
    caveats: [
      'Mode démo : données déterministes, non issues d’une session réelle.',
      'Patterns are deterministic research observations only. Not financial advice.',
      'Research-only output; no order routing. Paper-only research layer.',
    ],
  }
}
