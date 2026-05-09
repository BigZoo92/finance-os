// PR5 — pure view-model helpers for the Advisor Learning Loop UI surfaces.
//
// Extracted into a standalone module so they can be unit-tested without DOM rendering
// (vitest is configured for `environment: 'node'` in this repo).
//
// No network, no DOM, no React imports. Pure data shaping.

import type {
  DashboardAdvisorDecisionJournalCreateInput,
  DashboardAdvisorDecisionKind,
  DashboardAdvisorDecisionReasonCode,
  DashboardAdvisorEvalCaseResponse,
  DashboardAdvisorEvalRunResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorEvalTrendCategory,
  DashboardAdvisorEvalTrendGroup,
  DashboardAdvisorEvalTrendsGroup,
  DashboardAdvisorEvalTrendsResponse,
  DashboardAdvisorEvalTrendStatus,
  DashboardAdvisorPostMortemRow,
  DashboardAdvisorPostMortemRunResponse,
  DashboardAdvisorPostMortemRunStatus,
  DashboardTradingLabHypothesis,
  DashboardTradingLabHypothesisCreateInput,
  DashboardTradingLabPatternDetection,
  DashboardTradingLabPatternKey,
  DashboardTradingLabStrategyScorecardEvidenceGrade,
  DashboardTradingLabStrategyScorecardQualityFlag,
} from './dashboard-types'

// ---------------------------------------------------------------------------
// Decision Recorder — payload shaping + validation
// ---------------------------------------------------------------------------

export const DECISION_KIND_OPTIONS: ReadonlyArray<{
  value: DashboardAdvisorDecisionKind
  label: string
  description: string
}> = [
  { value: 'accepted', label: 'Suivre', description: 'Je suis cette recommandation.' },
  { value: 'deferred', label: 'Reporter', description: 'À revoir plus tard, pas maintenant.' },
  { value: 'rejected', label: 'Refuser', description: "Je ne suis pas d'accord ou ce n'est pas pour moi." },
  { value: 'ignored', label: 'Ignorer', description: 'Aucune action prévue.' },
]

export const REASON_CODE_OPTIONS: ReadonlyArray<{
  value: DashboardAdvisorDecisionReasonCode
  label: string
  appliesTo: ReadonlyArray<DashboardAdvisorDecisionKind>
}> = [
  { value: 'accepted', label: 'Validée', appliesTo: ['accepted'] },
  { value: 'rejected_low_confidence', label: 'Confiance trop basse', appliesTo: ['rejected'] },
  {
    value: 'rejected_disagree_thesis',
    label: 'Désaccord avec la thèse',
    appliesTo: ['rejected'],
  },
  {
    value: 'rejected_risk_mismatch',
    label: 'Profil de risque inadapté',
    appliesTo: ['rejected'],
  },
  { value: 'deferred_need_more_data', label: 'Besoin de plus de données', appliesTo: ['deferred'] },
  { value: 'ignored_no_action', label: "Pas d'action prévue", appliesTo: ['ignored'] },
  {
    value: 'other',
    label: 'Autre',
    appliesTo: ['accepted', 'rejected', 'deferred', 'ignored'],
  },
]

export const DECISION_FREE_NOTE_MAX_LENGTH = 2000

export const reasonCodesForDecision = (
  decision: DashboardAdvisorDecisionKind
): ReadonlyArray<{ value: DashboardAdvisorDecisionReasonCode; label: string }> =>
  REASON_CODE_OPTIONS.filter(option => option.appliesTo.includes(decision)).map(option => ({
    value: option.value,
    label: option.label,
  }))

export const defaultReasonCode = (
  decision: DashboardAdvisorDecisionKind
): DashboardAdvisorDecisionReasonCode => {
  const candidates = reasonCodesForDecision(decision)
  const preferred = candidates.find(c => c.value !== 'other')
  return (preferred ?? candidates[0])?.value ?? 'other'
}

export interface DecisionRecorderFormState {
  decision: DashboardAdvisorDecisionKind
  reasonCode: DashboardAdvisorDecisionReasonCode
  freeNote: string
  expectedOutcomeAt: string
}

export interface BuildDecisionPayloadResult {
  ok: boolean
  payload?: DashboardAdvisorDecisionJournalCreateInput
  error?: string
}

const isIsoTimestamp = (value: string): boolean => {
  // Permissive ISO check; matches the API regex from PR1.
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:?\d{2})?$/.test(value)) {
    return false
  }
  return !Number.isNaN(new Date(value).getTime())
}

const isPlainDate = (value: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(value)

export const buildDecisionPayload = (params: {
  recommendationId: number | null
  recommendationKey: string | null
  runId?: number | null
  state: DecisionRecorderFormState
}): BuildDecisionPayloadResult => {
  const { recommendationId, recommendationKey, runId, state } = params
  if (!REASON_CODE_OPTIONS.some(option => option.value === state.reasonCode)) {
    return { ok: false, error: 'reasonCode invalide' }
  }
  const trimmedNote = state.freeNote.trim()
  if (trimmedNote.length > DECISION_FREE_NOTE_MAX_LENGTH) {
    return {
      ok: false,
      error: `Note trop longue (max ${DECISION_FREE_NOTE_MAX_LENGTH} caractères)`,
    }
  }
  let expectedOutcomeAt: string | null = null
  if (state.expectedOutcomeAt.trim().length > 0) {
    const raw = state.expectedOutcomeAt.trim()
    if (isPlainDate(raw)) {
      expectedOutcomeAt = `${raw}T00:00:00.000Z`
    } else if (isIsoTimestamp(raw)) {
      expectedOutcomeAt = raw
    } else {
      return { ok: false, error: 'Date de suivi invalide' }
    }
  }
  return {
    ok: true,
    payload: {
      ...(recommendationId !== null ? { recommendationId } : {}),
      ...(recommendationKey !== null ? { recommendationKey } : {}),
      ...(runId !== undefined && runId !== null ? { runId } : {}),
      decision: state.decision,
      reasonCode: state.reasonCode,
      freeNote: trimmedNote.length > 0 ? trimmedNote : null,
      ...(expectedOutcomeAt ? { expectedOutcomeAt } : {}),
    },
  }
}

export const decisionLabelFor = (decision: DashboardAdvisorDecisionKind): string =>
  DECISION_KIND_OPTIONS.find(option => option.value === decision)?.label ?? decision

// ---------------------------------------------------------------------------
// Eval Scorecard — group fine categories into quality / safety / economics
// ---------------------------------------------------------------------------

export type EvalScorecardGroup = 'quality' | 'safety' | 'economics'

const CATEGORY_GROUP: Record<string, EvalScorecardGroup> = {
  transaction_classification: 'quality',
  recommendation_quality: 'quality',
  causal_reasoning: 'quality',
  strategy_quality: 'quality',
  challenger: 'safety',
  data_sufficiency: 'safety',
  risk_calibration: 'safety',
  post_mortem_safety: 'safety',
  cost_control: 'economics',
}

export const groupForCategory = (category: string): EvalScorecardGroup =>
  CATEGORY_GROUP[category] ?? 'quality'

export interface EvalScorecardCategoryRow {
  category: string
  group: EvalScorecardGroup
  caseCount: number
  description: string
}

export interface EvalScorecardRunSummary {
  status: DashboardAdvisorEvalRunResponse['status'] | null
  totalCases: number
  passedCases: number
  failedCases: number
  failedCaseKeys: string[]
  failedCaseDetails: Array<{
    caseId: string
    category: string
    failedExpectations: string[]
  }>
  evaluatedAt: string | null
}

export interface EvalScorecardViewModel {
  hasData: boolean
  groups: ReadonlyArray<{
    group: EvalScorecardGroup
    label: string
    rows: EvalScorecardCategoryRow[]
  }>
  run: EvalScorecardRunSummary
  trendsAvailable: boolean
}

const GROUP_LABEL: Record<EvalScorecardGroup, string> = {
  quality: 'Qualité',
  safety: 'Sécurité',
  economics: 'Économie',
}

const readSummaryArray = (
  summary: Record<string, unknown> | null,
  key: string
): unknown[] => {
  if (!summary) return []
  const value = summary[key]
  return Array.isArray(value) ? value : []
}

export const buildEvalScorecard = (
  evals: DashboardAdvisorEvalsResponse | undefined
): EvalScorecardViewModel => {
  if (!evals) {
    return {
      hasData: false,
      groups: [],
      run: {
        status: null,
        totalCases: 0,
        passedCases: 0,
        failedCases: 0,
        failedCaseKeys: [],
        failedCaseDetails: [],
        evaluatedAt: null,
      },
      trendsAvailable: false,
    }
  }
  const cases = evals.cases ?? []
  const byGroup = new Map<EvalScorecardGroup, Map<string, EvalScorecardCategoryRow>>()
  for (const c of cases as DashboardAdvisorEvalCaseResponse[]) {
    const group = groupForCategory(c.category)
    const groupBucket = byGroup.get(group) ?? new Map<string, EvalScorecardCategoryRow>()
    const existing = groupBucket.get(c.category)
    if (existing) {
      existing.caseCount += 1
    } else {
      groupBucket.set(c.category, {
        category: c.category,
        group,
        caseCount: 1,
        description: c.description,
      })
    }
    byGroup.set(group, groupBucket)
  }
  const groups: EvalScorecardViewModel['groups'] = (
    ['quality', 'safety', 'economics'] as const
  ).map(group => ({
    group,
    label: GROUP_LABEL[group],
    rows: [...(byGroup.get(group)?.values() ?? [])].sort((a, b) =>
      a.category.localeCompare(b.category)
    ),
  }))

  const latestRun = evals.latestRun
  const failedCaseKeys = readSummaryArray(latestRun?.summary ?? null, 'failedCaseKeys').filter(
    (v): v is string => typeof v === 'string'
  )
  const rawFailedDetails = readSummaryArray(latestRun?.summary ?? null, 'failedCaseDetails')
  const failedCaseDetails = rawFailedDetails
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const caseId = typeof record.caseId === 'string' ? record.caseId : null
      const category = typeof record.category === 'string' ? record.category : null
      const failedExpectations = Array.isArray(record.failedExpectations)
        ? record.failedExpectations.filter((v): v is string => typeof v === 'string')
        : []
      if (!caseId || !category) return null
      return { caseId, category, failedExpectations }
    })
    .filter((v): v is { caseId: string; category: string; failedExpectations: string[] } => v !== null)

  return {
    hasData: cases.length > 0,
    groups,
    run: {
      status: latestRun?.status ?? null,
      totalCases: latestRun?.totalCases ?? 0,
      passedCases: latestRun?.passedCases ?? 0,
      failedCases: latestRun?.failedCases ?? 0,
      failedCaseKeys,
      failedCaseDetails,
      evaluatedAt: latestRun?.createdAt ?? null,
    },
    // PR9 — `trendsAvailable` is now driven by the trends view-model (see
    // `buildEvalScorecardTrends`). The scorecard component composes both.
    trendsAvailable: false,
  }
}

// ---------------------------------------------------------------------------
// PR9 — Eval Trends view-model
// ---------------------------------------------------------------------------

export interface EvalTrendsCategoryView {
  category: string
  group: EvalScorecardGroup
  status: DashboardAdvisorEvalTrendStatus
  latestPassRate: number | null
  previousPassRate: number | null
  delta: number | null
  totalRuns: number
  failedCaseKeys: string[]
}

export interface EvalTrendsGroupView {
  group: EvalScorecardGroup
  label: string
  status: DashboardAdvisorEvalTrendStatus
  totalRuns: number
  latestPassRate: number | null
  previousPassRate: number | null
  delta: number | null
  categories: EvalTrendsCategoryView[]
}

export type EvalTrendsLoadState =
  | { kind: 'flag_disabled' }
  | { kind: 'loading' }
  | { kind: 'unavailable' }
  | { kind: 'ready'; groups: EvalTrendsGroupView[]; caveats: string[]; windowDays: number; mode: 'demo' | 'admin' }
  | { kind: 'empty'; caveats: string[]; windowDays: number; mode: 'demo' | 'admin' }

const groupSummaryStatus = (
  group: DashboardAdvisorEvalTrendGroup
): DashboardAdvisorEvalTrendStatus => {
  if (group.totalRuns < 2 || group.delta === null) return 'insufficient_data'
  if (group.delta > 0.05) return 'improving'
  if (group.delta < -0.05) return 'regressing'
  return 'stable'
}

const mapCategory = (cat: DashboardAdvisorEvalTrendCategory): EvalTrendsCategoryView => ({
  category: cat.category,
  group: groupForCategory(cat.category),
  status: cat.status,
  latestPassRate: cat.latest.passRate,
  previousPassRate: cat.previous?.passRate ?? null,
  delta: cat.delta,
  totalRuns: cat.totalRuns,
  failedCaseKeys: [...cat.latest.failedCaseKeys].slice(0, 5),
})

export const buildEvalScorecardTrends = (input: {
  flagEnabled: boolean
  data: DashboardAdvisorEvalTrendsResponse | undefined
  isError: boolean
  isPending: boolean
}): EvalTrendsLoadState => {
  if (!input.flagEnabled) return { kind: 'flag_disabled' }
  if (input.isError) return { kind: 'unavailable' }
  if (input.isPending && !input.data) return { kind: 'loading' }
  if (!input.data) return { kind: 'unavailable' }

  const data = input.data
  const groups: EvalTrendsGroupView[] = (
    ['quality', 'safety', 'economics'] as DashboardAdvisorEvalTrendsGroup[]
  ).map(groupName => {
    const raw = data.groups.find(g => g.group === groupName)
    if (!raw) {
      return {
        group: groupName,
        label: GROUP_LABEL[groupName],
        status: 'insufficient_data',
        totalRuns: 0,
        latestPassRate: null,
        previousPassRate: null,
        delta: null,
        categories: [],
      }
    }
    return {
      group: groupName,
      label: GROUP_LABEL[groupName],
      status: groupSummaryStatus(raw),
      totalRuns: raw.totalRuns,
      latestPassRate: raw.latestPassRate,
      previousPassRate: raw.previousPassRate,
      delta: raw.delta,
      categories: raw.categories.map(mapCategory),
    }
  })

  const hasAny = groups.some(g => g.totalRuns > 0)
  if (!hasAny) {
    return {
      kind: 'empty',
      caveats: data.caveats,
      windowDays: data.windowDays,
      mode: data.mode,
    }
  }
  return {
    kind: 'ready',
    groups,
    caveats: input.data.caveats,
    windowDays: input.data.windowDays,
    mode: input.data.mode,
  }
}

export const TREND_STATUS_LABEL: Record<DashboardAdvisorEvalTrendStatus, string> = {
  improving: 'Amélioration',
  stable: 'Stable',
  regressing: 'Régression détectée',
  insufficient_data: 'Données insuffisantes',
}

export const TREND_GROUP_LABEL = GROUP_LABEL

// ---------------------------------------------------------------------------
// Post-Mortem feed — view-model + run-status mapping
// ---------------------------------------------------------------------------

export interface PostMortemRunStatusView {
  tone: 'success' | 'info' | 'warn' | 'error'
  label: string
  detail: string
}

export const describePostMortemRunStatus = (
  status: DashboardAdvisorPostMortemRunStatus
): PostMortemRunStatusView => {
  switch (status) {
    case 'completed':
      return { tone: 'success', label: 'Terminé', detail: 'Le batch a produit des leçons advisory-only.' }
    case 'skipped_disabled':
      return {
        tone: 'info',
        label: 'Désactivé',
        detail: 'AI_POST_MORTEM_ENABLED est sur false côté serveur — aucune analyse n\'a tourné.',
      }
    case 'skipped_budget_blocked':
      return {
        tone: 'warn',
        label: 'Budget bloqué',
        detail: 'Le budget IA quotidien/mensuel ne permet pas une analyse profonde.',
      }
    case 'skipped_no_due_items':
      return {
        tone: 'info',
        label: 'Aucune recommandation à analyser',
        detail: 'Aucune recommandation expirée n\'attend une analyse rétrospective.',
      }
    case 'failed':
      return {
        tone: 'error',
        label: 'Échec',
        detail: 'Le batch a échoué. Les leçons éventuelles ne sont pas persistées comme utilisables.',
      }
  }
}

export interface PostMortemFeedRow {
  id: number
  recommendationKey: string | null
  status: DashboardAdvisorPostMortemRow['status']
  evaluatedAt: string | null
  expectedOutcomeAt: string | null
  summary: string
  overallOutcome: string | null
  calibrationFrom: string | null
  calibrationTo: string | null
  learningActions: Array<{ kind: string; title: string; description: string }>
  errorCode: string | null
  skippedReason: string | null
  graphIngestDeferred: boolean
}

const stringField = (value: unknown): string | null => (typeof value === 'string' ? value : null)

export const buildPostMortemFeed = (
  list: DashboardAdvisorPostMortemRow[] | undefined
): PostMortemFeedRow[] => {
  if (!list) return []
  return list.map(row => {
    const findings = (row.findings ?? {}) as Record<string, unknown>
    const calibration = (row.calibration ?? {}) as Record<string, unknown>
    const riskNotes = (row.riskNotes ?? {}) as Record<string, unknown>
    const actions = (row.learningActions ?? []) as Array<Record<string, unknown>>
    return {
      id: row.id,
      recommendationKey: row.recommendationKey,
      status: row.status,
      evaluatedAt: row.evaluatedAt,
      expectedOutcomeAt: row.expectedOutcomeAt,
      summary: stringField(findings.summary) ?? "Pas de résumé",
      overallOutcome: stringField(findings.overallOutcome),
      calibrationFrom: stringField(calibration.previousConfidence),
      calibrationTo: stringField(calibration.calibratedConfidence),
      learningActions: actions
        .map(a => {
          const kind = stringField(a.kind) ?? 'caveat'
          const title = stringField(a.title)
          const description = stringField(a.description)
          if (!title || !description) return null
          return { kind, title, description }
        })
        .filter((v): v is { kind: string; title: string; description: string } => v !== null),
      errorCode: row.errorCode,
      skippedReason: row.skippedReason,
      graphIngestDeferred: stringField(riskNotes.graphIngest) === 'deferred',
    }
  })
}

export const summarizePostMortemRunResponse = (
  response: DashboardAdvisorPostMortemRunResponse
): { view: PostMortemRunStatusView; meta: string[] } => {
  const view = describePostMortemRunStatus(response.status)
  const meta: string[] = [
    `Évalué à ${response.evaluatedAt}`,
    `Items dus: ${response.totalDue}`,
    `Traités: ${response.processed}`,
    response.failedItems > 0 ? `Échecs: ${response.failedItems}` : null,
    response.budgetReasons.length > 0 ? `Budget: ${response.budgetReasons.join(', ')}` : null,
  ].filter((v): v is string => v !== null)
  return { view, meta }
}

// ---------------------------------------------------------------------------
// Hypothesis Lab — surface the structured `parameters.hypothesis` payload safely
// ---------------------------------------------------------------------------

export interface HypothesisExtrasView {
  thesis: string | null
  invalidationCriteria: string[]
  evidenceNotes: string[]
  horizon: string | null
}

export const readHypothesisExtras = (
  parameters: Record<string, unknown> | null | undefined
): HypothesisExtrasView => {
  const raw = parameters?.hypothesis as Record<string, unknown> | undefined
  return {
    thesis: typeof raw?.thesis === 'string' ? raw.thesis : null,
    invalidationCriteria: Array.isArray(raw?.invalidationCriteria)
      ? raw.invalidationCriteria.filter((v): v is string => typeof v === 'string')
      : [],
    evidenceNotes: Array.isArray(raw?.evidenceNotes)
      ? raw.evidenceNotes.filter((v): v is string => typeof v === 'string')
      : [],
    horizon: typeof raw?.horizon === 'string' ? raw.horizon : null,
  }
}

export interface HypothesisFormState {
  name: string
  slug: string
  description: string
  thesis: string
  invalidationCriteriaRaw: string // newline-separated
  evidenceNotesRaw: string // newline-separated
  horizon: string
  status: DashboardTradingLabHypothesis['status']
}

export interface BuildHypothesisCreatePayloadResult {
  ok: boolean
  payload?: {
    name: string
    slug: string
    description: string | null
    thesis: string | null
    assumptions: string[]
    caveats: string[]
    invalidationCriteria: string[]
    evidenceNotes: string[] | undefined
    horizon: string | null
    status: DashboardTradingLabHypothesis['status']
  }
  error?: string
}

export const splitLines = (raw: string): string[] =>
  raw
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line.length > 0)

export const buildHypothesisCreatePayload = (
  state: HypothesisFormState
): BuildHypothesisCreatePayloadResult => {
  const name = state.name.trim()
  const slug = state.slug.trim()
  if (name.length === 0) return { ok: false, error: 'Nom requis' }
  if (slug.length === 0 || !/^[a-z0-9-]+$/.test(slug)) {
    return { ok: false, error: 'Slug invalide (a-z, 0-9, tirets)' }
  }
  const invalidationCriteria = splitLines(state.invalidationCriteriaRaw)
  if (invalidationCriteria.length === 0) {
    return {
      ok: false,
      error: "Au moins un critère d'invalidation est requis",
    }
  }
  const evidenceNotes = splitLines(state.evidenceNotesRaw)
  return {
    ok: true,
    payload: {
      name,
      slug,
      description: state.description.trim().length > 0 ? state.description.trim() : null,
      thesis: state.thesis.trim().length > 0 ? state.thesis.trim() : null,
      assumptions: [],
      caveats: [],
      invalidationCriteria,
      evidenceNotes: evidenceNotes.length > 0 ? evidenceNotes : undefined,
      horizon: state.horizon.trim().length > 0 ? state.horizon.trim() : null,
      status: state.status,
    },
  }
}

// ---------------------------------------------------------------------------
// PR11 — Pattern detection → hypothesis draft mapping.
//
// Lifts a `DashboardTradingLabPatternDetection` into a manual hypothesis draft. We do NOT
// mint thesis copy from numeric metrics — the title and thesis are derived from the canonical
// pattern label and a deliberately cautious template. Evidence and invalidation hints from the
// detector flow into the hypothesis as-is. Limitations become caveats. Horizon stays null
// because pattern detection does NOT supply a temporal commitment.
// ---------------------------------------------------------------------------

export const PATTERN_LABELS_FR: Record<DashboardTradingLabPatternKey, string> = {
  ema20_horizontal_level: 'EMA20 + niveau horizontal',
  ema200_one_touch: 'EMA200 one-touch',
  parabolic_sar_rci: 'Parabolic SAR + RCI',
  volume_profile_zones: 'Volume Profile (POC / VAH / VAL)',
  // PR15B — SMC/ICT research labels. Deliberately neutral copy: "candidate", "structure",
  // never "signal" or "entry". The panel additionally shows an SMC/ICT-research badge.
  fair_value_gap: 'Fair Value Gap',
  liquidity_sweep: 'Liquidity Sweep',
  break_of_structure: 'Break of Structure',
  change_of_character: 'Change of Character',
  order_block_candidate: 'Order Block (candidate)',
}

const slugify = (raw: string): string => {
  const cleaned = raw
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return cleaned.length > 0 ? cleaned : 'pattern'
}

export interface PatternDetectionDraftContext {
  symbol?: string | null
  timeframe?: string | null
}

export const buildHypothesisDraftFromDetection = (
  detection: DashboardTradingLabPatternDetection,
  context: PatternDetectionDraftContext = {}
): DashboardTradingLabHypothesisCreateInput => {
  const label = PATTERN_LABELS_FR[detection.patternType] ?? detection.patternType
  const symbolPart = context.symbol && context.symbol.trim().length > 0 ? context.symbol.trim() : null
  const timeframePart =
    context.timeframe && context.timeframe.trim().length > 0 ? context.timeframe.trim() : null
  const titleSegments = [label]
  if (symbolPart) titleSegments.push(symbolPart)
  if (timeframePart) titleSegments.push(timeframePart)
  const name = `Hypothèse paper · ${titleSegments.join(' · ')}`
  const slug = slugify(
    [
      detection.patternType,
      symbolPart ?? '',
      timeframePart ?? '',
      detection.id.slice(-6),
    ].join('-')
  ).slice(0, 80)

  // Deliberately cautious thesis: phrased as an observation to be tested, never as a directive.
  const thesisSegments = [
    `Détection ${label}`,
    symbolPart ? `sur ${symbolPart}` : null,
    timeframePart ? `(${timeframePart})` : null,
    `— direction observée: ${detection.direction}, confiance: ${detection.confidence}.`,
    'Hypothèse à tester en paper trading uniquement.',
  ].filter((s): s is string => typeof s === 'string')
  const thesis = thesisSegments.join(' ')

  const invalidationCriteria =
    detection.invalidationHints.length > 0
      ? [...detection.invalidationHints]
      : ['À définir avant tout suivi paper.']

  const evidenceNotes = detection.evidence.length > 0 ? [...detection.evidence] : undefined
  const caveats = [
    'Cette détection n’est pas une recommandation.',
    'Les résultats doivent être backtestés avant toute conclusion.',
    ...detection.limitations,
  ]

  const draft: DashboardTradingLabHypothesisCreateInput = {
    name,
    slug,
    thesis,
    description: null,
    horizon: null,
    invalidationCriteria,
    caveats,
    assumptions: [],
    tags: ['pattern-detection', detection.patternType, 'paper-only'],
    status: 'draft',
  }
  if (evidenceNotes !== undefined) {
    draft.evidenceNotes = evidenceNotes
  }
  return draft
}

export const TREND_PATTERN_DIRECTION_LABEL_FR: Record<
  DashboardTradingLabPatternDetection['direction'],
  string
> = {
  bullish: 'Haussier (observation)',
  bearish: 'Baissier (observation)',
  neutral: 'Neutre',
  unknown: 'Indéterminé',
}

export const PATTERN_CONFIDENCE_LABEL_FR: Record<
  DashboardTradingLabPatternDetection['confidence'],
  string
> = {
  low: 'Confiance faible',
  medium: 'Confiance moyenne',
  high: 'Confiance élevée',
}

// ---------------------------------------------------------------------------
// PR12 — Strategy Scorecard view-model helpers (label + tone constants).
//
// These never compute the grade — that lives server-side. The view-model only
// translates the deterministic enum into UI copy + tone classes.
// ---------------------------------------------------------------------------

export const SCORECARD_GRADE_LABEL_FR: Record<
  DashboardTradingLabStrategyScorecardEvidenceGrade,
  string
> = {
  insufficient: 'Evidence insuffisante',
  weak: 'Fragile',
  promising: 'Prometteur',
  strong_but_unproven: 'Solide mais non prouvé',
  invalidated: 'Invalidé',
}

export const SCORECARD_GRADE_TONE: Record<
  DashboardTradingLabStrategyScorecardEvidenceGrade,
  'success' | 'info' | 'warning' | 'danger' | 'muted'
> = {
  insufficient: 'muted',
  weak: 'warning',
  promising: 'info',
  strong_but_unproven: 'success',
  invalidated: 'danger',
}

export const SCORECARD_FLAG_TONE: Record<
  DashboardTradingLabStrategyScorecardQualityFlag['severity'],
  'info' | 'warning' | 'danger'
> = {
  info: 'info',
  warning: 'warning',
  danger: 'danger',
}
