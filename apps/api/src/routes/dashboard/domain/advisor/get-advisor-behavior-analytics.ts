// PR15A — Advisor Behavior Analytics use-case.
//
// Read-only, paper-only, retrospective. Inspired by Tradetally-style decision journaling, but
// re-implemented under our license — no Tradetally code or dependency.
//
// Hard guarantees verified by tests:
//   • No LLM call, no provider call, no graph ingest, no DB write.
//   • The repository adapter NEVER receives or returns `freeNote` content. The compute layer
//     ignores anything not in its narrow input shape; even if a misbehaving repo passed extra
//     keys, the response shape is hand-typed and only echoes typed fields.
//   • Insufficient data ⇒ deterministic `insufficient_sample` learning signal AND `null`
//     rates. Never fabricated zeros, never fabricated rates.
//   • Causality is NEVER claimed. Reason-code "caution" copy is descriptive only.

import type {
  DashboardAdvisorBehaviorAnalyticsResponse,
  DashboardAdvisorBehaviorDecisionBreakdownEntry,
  DashboardAdvisorBehaviorLearningSignal,
  DashboardAdvisorBehaviorOutcomeMix,
  DashboardAdvisorBehaviorReasonCodeBreakdownEntry,
} from '../../advisor-contract'

export const BEHAVIOR_WINDOW_MIN = 7
export const BEHAVIOR_WINDOW_MAX = 365
export const BEHAVIOR_WINDOW_DEFAULT = 30
export const BEHAVIOR_DECISION_LIMIT = 5000
export const BEHAVIOR_INSUFFICIENT_SAMPLE = 5
export const BEHAVIOR_LOW_COVERAGE_RATE = 0.4
export const BEHAVIOR_OVER_DEFERRAL_RATE = 0.4
export const BEHAVIOR_HIGH_NEG_ACCEPTANCE_RATE = 0.4
export const BEHAVIOR_POSITIVE_REJECTION_RATE = 0.3

// `accepted | rejected | deferred | ignored` — explicit canonical order so the array is
// deterministic.
const DECISION_KINDS = ['accepted', 'rejected', 'deferred', 'ignored'] as const
type DecisionKind = (typeof DECISION_KINDS)[number]

const PERMANENT_CAVEATS: readonly string[] = [
  "Analyse rétrospective basée sur le journal de décisions. Ne constitue pas une recommandation.",
  "Aucune causalité inférée : un schéma observé n'est pas une preuve d'effet.",
  "Les notes libres ne sont jamais incluses dans cette analyse.",
]

export const clampWindowDays = (raw: number | null | undefined): number => {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return BEHAVIOR_WINDOW_DEFAULT
  const n = Math.floor(raw)
  if (n < BEHAVIOR_WINDOW_MIN) return BEHAVIOR_WINDOW_MIN
  if (n > BEHAVIOR_WINDOW_MAX) return BEHAVIOR_WINDOW_MAX
  return n
}

const isDecisionKind = (value: string): value is DecisionKind =>
  (DECISION_KINDS as readonly string[]).includes(value)

const emptyOutcomeMix = (): DashboardAdvisorBehaviorOutcomeMix => ({
  positive: 0,
  negative: 0,
  neutral: 0,
  mixed: 0,
  unknown: 0,
})

const incrementOutcomeMix = (mix: DashboardAdvisorBehaviorOutcomeMix, kind: string): void => {
  if (kind === 'positive') mix.positive += 1
  else if (kind === 'negative') mix.negative += 1
  else if (kind === 'neutral') mix.neutral += 1
  else if (kind === 'mixed') mix.mixed += 1
  else mix.unknown += 1
}

const safeRate = (numerator: number, denominator: number): number | null =>
  denominator > 0 ? numerator / denominator : null

const round = (value: number | null, digits = 4): number | null =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits

// ---------------------------------------------------------------------------
// Repository adapter — narrow, freeNote-free.
// ---------------------------------------------------------------------------

export interface BehaviorAnalyticsDecision {
  id: number
  decision: string
  reasonCode: string
  decidedAt: string
  recommendationId: number | null
  runId: number | null
}

export interface BehaviorAnalyticsOutcome {
  decisionId: number
  outcomeKind: string
  observedAt: string
}

export interface BehaviorAnalyticsRepositoryAdapter {
  listDecisionsForBehaviorAnalytics: (input: {
    windowDays: number
    limit: number
  }) => Promise<{
    decisions: BehaviorAnalyticsDecision[]
    outcomes: BehaviorAnalyticsOutcome[]
  }>
}

// ---------------------------------------------------------------------------
// Pure compute
// ---------------------------------------------------------------------------

export interface ComputeBehaviorAnalyticsInput {
  decisions: BehaviorAnalyticsDecision[]
  outcomes: BehaviorAnalyticsOutcome[]
  windowDays: number
  generatedAt: Date
  mode: 'demo' | 'admin'
}

export const computeBehaviorAnalytics = (
  input: ComputeBehaviorAnalyticsInput
): DashboardAdvisorBehaviorAnalyticsResponse => {
  const { decisions, outcomes, windowDays, generatedAt, mode } = input

  const totalDecisions = decisions.length
  const outcomesByDecision = new Map<number, BehaviorAnalyticsOutcome[]>()
  for (const o of outcomes) {
    const list = outcomesByDecision.get(o.decisionId) ?? []
    list.push(o)
    outcomesByDecision.set(o.decisionId, list)
  }

  // Latest outcome per decision (used for outcome-coverage + per-decision outcomeMix).
  const latestOutcomeByDecision = new Map<number, BehaviorAnalyticsOutcome>()
  for (const [decisionId, list] of outcomesByDecision.entries()) {
    let latest = list[0]
    for (const o of list) {
      if (latest === undefined || o.observedAt > latest.observedAt) latest = o
    }
    if (latest !== undefined) latestOutcomeByDecision.set(decisionId, latest)
  }
  const decisionsWithOutcomes = latestOutcomeByDecision.size

  const decisionCounts: Record<DecisionKind, number> = {
    accepted: 0,
    rejected: 0,
    deferred: 0,
    ignored: 0,
  }
  const decisionOutcomeMix: Record<DecisionKind, DashboardAdvisorBehaviorOutcomeMix> = {
    accepted: emptyOutcomeMix(),
    rejected: emptyOutcomeMix(),
    deferred: emptyOutcomeMix(),
    ignored: emptyOutcomeMix(),
  }

  // Reason-code aggregation — keyed by raw string from the journal so unknown reason codes
  // surface honestly rather than being silently merged into 'other'.
  const reasonAgg = new Map<
    string,
    {
      count: number
      positive: number
      negative: number
      unknown: number
    }
  >()

  for (const d of decisions) {
    if (isDecisionKind(d.decision)) {
      decisionCounts[d.decision] += 1
      const latest = latestOutcomeByDecision.get(d.id)
      if (latest) incrementOutcomeMix(decisionOutcomeMix[d.decision], latest.outcomeKind)
      else incrementOutcomeMix(decisionOutcomeMix[d.decision], 'unknown')
    }

    const reasonBucket = reasonAgg.get(d.reasonCode) ?? {
      count: 0,
      positive: 0,
      negative: 0,
      unknown: 0,
    }
    reasonBucket.count += 1
    const latest = latestOutcomeByDecision.get(d.id)
    if (!latest) reasonBucket.unknown += 1
    else if (latest.outcomeKind === 'positive') reasonBucket.positive += 1
    else if (latest.outcomeKind === 'negative') reasonBucket.negative += 1
    // 'neutral'/'mixed'/'unknown' don't increment positive/negative; we keep the count visible
    // via `count - positive - negative`.
    reasonAgg.set(d.reasonCode, reasonBucket)
  }

  const summary = {
    totalDecisions,
    decisionsWithOutcomes,
    outcomeCoverageRate: round(safeRate(decisionsWithOutcomes, totalDecisions)),
    acceptedRate: round(safeRate(decisionCounts.accepted, totalDecisions)),
    rejectedRate: round(safeRate(decisionCounts.rejected, totalDecisions)),
    deferredRate: round(safeRate(decisionCounts.deferred, totalDecisions)),
    ignoredRate: round(safeRate(decisionCounts.ignored, totalDecisions)),
  }

  const decisionBreakdown: DashboardAdvisorBehaviorDecisionBreakdownEntry[] = DECISION_KINDS.map(
    kind => {
      const count = decisionCounts[kind]
      return {
        decision: kind,
        count,
        rate: round(safeRate(count, totalDecisions)),
        outcomeMix: decisionOutcomeMix[kind],
      }
    }
  )

  const reasonCodeBreakdown: DashboardAdvisorBehaviorReasonCodeBreakdownEntry[] = [...reasonAgg.entries()]
    .sort((a, b) => {
      // Most-frequent first; tie-break alphabetical for determinism.
      if (b[1].count !== a[1].count) return b[1].count - a[1].count
      return a[0].localeCompare(b[0])
    })
    .map(([reasonCode, agg]) => {
      const evaluated = agg.positive + agg.negative
      let caution: string | null = null
      if (evaluated >= BEHAVIOR_INSUFFICIENT_SAMPLE && agg.negative >= 2 * Math.max(1, agg.positive)) {
        caution = 'Plus de résultats négatifs que positifs sur un échantillon évalué.'
      }
      return {
        reasonCode,
        count: agg.count,
        positiveOutcomes: agg.positive,
        negativeOutcomes: agg.negative,
        unknownOutcomes: agg.count - agg.positive - agg.negative,
        caution,
      }
    })

  // ----- Learning signals -----
  const signals: DashboardAdvisorBehaviorLearningSignal[] = []

  if (totalDecisions < BEHAVIOR_INSUFFICIENT_SAMPLE) {
    signals.push({
      kind: 'insufficient_sample',
      severity: 'info',
      message: `Échantillon insuffisant (${totalDecisions} décisions sur ${windowDays} jours).`,
    })
  }

  if (
    summary.outcomeCoverageRate !== null &&
    summary.outcomeCoverageRate < BEHAVIOR_LOW_COVERAGE_RATE &&
    totalDecisions >= BEHAVIOR_INSUFFICIENT_SAMPLE
  ) {
    signals.push({
      kind: 'low_outcome_coverage',
      severity: 'warning',
      message: `Seulement ${Math.round(summary.outcomeCoverageRate * 100)}% des décisions disposent d'un suivi d'outcome.`,
    })
  }

  if (
    summary.deferredRate !== null &&
    summary.deferredRate >= BEHAVIOR_OVER_DEFERRAL_RATE &&
    totalDecisions >= BEHAVIOR_INSUFFICIENT_SAMPLE
  ) {
    signals.push({
      kind: 'over_deferral',
      severity: 'info',
      message: `Taux de "deferred" élevé (${Math.round(summary.deferredRate * 100)}%) — pas de critique en soi, mais à observer.`,
    })
  }

  // High-negative-acceptance: of accepted decisions that have ANY outcome, what fraction is negative?
  const acceptedMix = decisionOutcomeMix.accepted
  const acceptedEvaluated = acceptedMix.positive + acceptedMix.negative
  if (
    acceptedEvaluated >= BEHAVIOR_INSUFFICIENT_SAMPLE &&
    acceptedMix.negative / acceptedEvaluated >= BEHAVIOR_HIGH_NEG_ACCEPTANCE_RATE
  ) {
    signals.push({
      kind: 'high_negative_acceptance',
      severity: 'warning',
      message: `${Math.round((acceptedMix.negative / acceptedEvaluated) * 100)}% des décisions "accepted" évaluées sont négatives.`,
    })
  }

  // Ignored followups: ignored decisions whose outcome ended up positive — i.e., a missed call.
  const ignoredMix = decisionOutcomeMix.ignored
  if (
    ignoredMix.positive >= BEHAVIOR_INSUFFICIENT_SAMPLE &&
    ignoredMix.positive >= ignoredMix.negative
  ) {
    signals.push({
      kind: 'ignored_followups',
      severity: 'info',
      message: `${ignoredMix.positive} décisions "ignored" ont eu un outcome positif — à revoir éventuellement.`,
    })
  }

  // Positive rejections: rejected decisions whose outcome turned positive.
  const rejectedMix = decisionOutcomeMix.rejected
  const rejectedEvaluated = rejectedMix.positive + rejectedMix.negative
  if (
    rejectedEvaluated >= BEHAVIOR_INSUFFICIENT_SAMPLE &&
    rejectedMix.positive / rejectedEvaluated >= BEHAVIOR_POSITIVE_REJECTION_RATE
  ) {
    signals.push({
      kind: 'positive_rejections',
      severity: 'info',
      message: `${Math.round((rejectedMix.positive / rejectedEvaluated) * 100)}% des décisions "rejected" évaluées ont eu un outcome positif.`,
    })
  }

  return {
    generatedAt: generatedAt.toISOString(),
    mode,
    windowDays,
    summary,
    decisionBreakdown,
    reasonCodeBreakdown,
    learningSignals: signals,
    caveats: [...PERMANENT_CAVEATS],
  }
}

// ---------------------------------------------------------------------------
// Demo fixture
// ---------------------------------------------------------------------------

export const buildDemoAdvisorBehaviorAnalytics = (
  generatedAt: Date,
  windowDays: number
): DashboardAdvisorBehaviorAnalyticsResponse => ({
  generatedAt: generatedAt.toISOString(),
  mode: 'demo',
  windowDays,
  summary: {
    totalDecisions: 20,
    decisionsWithOutcomes: 12,
    outcomeCoverageRate: 0.6,
    acceptedRate: 0.45,
    rejectedRate: 0.25,
    deferredRate: 0.2,
    ignoredRate: 0.1,
  },
  decisionBreakdown: [
    {
      decision: 'accepted',
      count: 9,
      rate: 0.45,
      outcomeMix: { positive: 4, negative: 2, neutral: 1, mixed: 0, unknown: 2 },
    },
    {
      decision: 'rejected',
      count: 5,
      rate: 0.25,
      outcomeMix: { positive: 1, negative: 2, neutral: 0, mixed: 0, unknown: 2 },
    },
    {
      decision: 'deferred',
      count: 4,
      rate: 0.2,
      outcomeMix: { positive: 0, negative: 0, neutral: 0, mixed: 0, unknown: 4 },
    },
    {
      decision: 'ignored',
      count: 2,
      rate: 0.1,
      outcomeMix: { positive: 0, negative: 0, neutral: 0, mixed: 0, unknown: 2 },
    },
  ],
  reasonCodeBreakdown: [
    {
      reasonCode: 'accepted',
      count: 9,
      positiveOutcomes: 4,
      negativeOutcomes: 2,
      unknownOutcomes: 3,
      caution: null,
    },
    {
      reasonCode: 'rejected_low_confidence',
      count: 3,
      positiveOutcomes: 1,
      negativeOutcomes: 1,
      unknownOutcomes: 1,
      caution: null,
    },
    {
      reasonCode: 'deferred_need_more_data',
      count: 4,
      positiveOutcomes: 0,
      negativeOutcomes: 0,
      unknownOutcomes: 4,
      caution: null,
    },
    {
      reasonCode: 'rejected_disagree_thesis',
      count: 2,
      positiveOutcomes: 0,
      negativeOutcomes: 1,
      unknownOutcomes: 1,
      caution: null,
    },
    {
      reasonCode: 'ignored_no_action',
      count: 2,
      positiveOutcomes: 0,
      negativeOutcomes: 0,
      unknownOutcomes: 2,
      caution: null,
    },
  ],
  learningSignals: [
    {
      kind: 'low_outcome_coverage',
      severity: 'warning',
      message: "Seulement 60% des décisions disposent d'un suivi d'outcome.",
    },
  ],
  caveats: [...PERMANENT_CAVEATS],
})

// ---------------------------------------------------------------------------
// Use-case factory
// ---------------------------------------------------------------------------

export interface AdvisorBehaviorAnalyticsUseCase {
  getAdvisorBehaviorAnalytics: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    windowDays?: number | null
    now?: Date
  }) => Promise<DashboardAdvisorBehaviorAnalyticsResponse>
}

export const createAdvisorBehaviorAnalyticsUseCase = ({
  repository,
}: {
  repository: BehaviorAnalyticsRepositoryAdapter
}): AdvisorBehaviorAnalyticsUseCase => ({
  async getAdvisorBehaviorAnalytics(input) {
    const windowDays = clampWindowDays(input.windowDays ?? null)
    const generatedAt = input.now ?? new Date()
    if (input.mode === 'demo') {
      return buildDemoAdvisorBehaviorAnalytics(generatedAt, windowDays)
    }
    const { decisions, outcomes } = await repository.listDecisionsForBehaviorAnalytics({
      windowDays,
      limit: BEHAVIOR_DECISION_LIMIT,
    })
    return computeBehaviorAnalytics({
      decisions,
      outcomes,
      windowDays,
      generatedAt,
      mode: 'admin',
    })
  },
})
