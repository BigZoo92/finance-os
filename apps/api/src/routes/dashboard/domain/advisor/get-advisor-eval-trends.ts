// PR9 — Advisor Eval Trends use-case.
//
// Read-only computation. DB-only. NEVER calls LLM, providers, knowledge-service, or graph.
//
// Walks recent `aiEvalRun` rows (newest-first), reads each summary's optional `byCategory`
// breakdown, and falls back to deriving per-category pass/fail from `failedCaseDetails` for
// legacy rows that pre-date PR9. The output is grouped (quality / safety / economics) and
// surfaces `insufficient_data` rather than fabricating deltas when fewer than 2 historical
// runs exist for a given category.

import type {
  DashboardAdvisorEvalRunResponse,
  DashboardAdvisorEvalTrendCategory,
  DashboardAdvisorEvalTrendCategoryLatest,
  DashboardAdvisorEvalTrendCategoryPrevious,
  DashboardAdvisorEvalTrendGroup,
  DashboardAdvisorEvalTrendStatus,
  DashboardAdvisorEvalTrendsGroup,
  DashboardAdvisorEvalTrendsResponse,
} from '../../advisor-contract'

export const EVAL_TREND_WINDOW_MIN = 7
export const EVAL_TREND_WINDOW_MAX = 90
export const EVAL_TREND_WINDOW_DEFAULT = 30
export const EVAL_TREND_RUN_LIMIT = 50
export const EVAL_TREND_DELTA_TOLERANCE = 0.05

const CATEGORY_GROUP: Record<string, DashboardAdvisorEvalTrendsGroup> = {
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

export const groupForCategory = (category: string): DashboardAdvisorEvalTrendsGroup =>
  CATEGORY_GROUP[category] ?? 'quality'

export const clampWindowDays = (raw: number | null | undefined): number => {
  if (raw === null || raw === undefined || Number.isNaN(raw)) return EVAL_TREND_WINDOW_DEFAULT
  const n = Math.floor(raw)
  if (n < EVAL_TREND_WINDOW_MIN) return EVAL_TREND_WINDOW_MIN
  if (n > EVAL_TREND_WINDOW_MAX) return EVAL_TREND_WINDOW_MAX
  return n
}

interface CategoryCounts {
  total: number
  passed: number
  failed: number
  skipped: number
  failedCaseKeys: string[]
}

const isCategoryCounts = (value: unknown): value is CategoryCounts => {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return (
    typeof v.total === 'number' &&
    typeof v.passed === 'number' &&
    typeof v.failed === 'number' &&
    typeof v.skipped === 'number' &&
    Array.isArray(v.failedCaseKeys)
  )
}

// Derives a per-category breakdown from the run summary. PR9+ runs carry `byCategory` directly;
// legacy runs are reconstructed from `failedCaseDetails` (which already records each failed case's
// category). For legacy runs we cannot recover passed counts because we don't know the case
// total per category at run time — so we report `failed` only and `passed=0`, which marks the
// category run as fully failed for legacy data. That is intentional: the alternative is to
// silently fabricate a denominator.
const extractByCategory = (
  summary: Record<string, unknown> | null
): Record<string, CategoryCounts> => {
  if (!summary) return {}
  const native = summary.byCategory
  if (native && typeof native === 'object') {
    const out: Record<string, CategoryCounts> = {}
    for (const [category, counts] of Object.entries(native as Record<string, unknown>)) {
      if (isCategoryCounts(counts)) {
        out[category] = {
          total: counts.total,
          passed: counts.passed,
          failed: counts.failed,
          skipped: counts.skipped,
          failedCaseKeys: counts.failedCaseKeys.filter((k): k is string => typeof k === 'string'),
        }
      }
    }
    return out
  }

  // Legacy fallback: only failed cases are recoverable.
  const details = Array.isArray(summary.failedCaseDetails) ? summary.failedCaseDetails : []
  const out: Record<string, CategoryCounts> = {}
  for (const d of details) {
    if (!d || typeof d !== 'object') continue
    const item = d as Record<string, unknown>
    const category = typeof item.category === 'string' ? item.category : null
    const caseId = typeof item.caseId === 'string' ? item.caseId : null
    if (!category || !caseId) continue
    let bucket = out[category]
    if (!bucket) {
      bucket = { total: 0, passed: 0, failed: 0, skipped: 0, failedCaseKeys: [] }
      out[category] = bucket
    }
    bucket.total += 1
    bucket.failed += 1
    bucket.failedCaseKeys.push(caseId)
  }
  return out
}

const passRateOf = (counts: CategoryCounts): number | null => {
  const denom = counts.total - counts.skipped
  if (denom <= 0) return null
  return counts.passed / denom
}

const statusForDelta = (
  delta: number | null,
  totalRuns: number
): DashboardAdvisorEvalTrendStatus => {
  if (totalRuns < 2 || delta === null) return 'insufficient_data'
  if (delta > EVAL_TREND_DELTA_TOLERANCE) return 'improving'
  if (delta < -EVAL_TREND_DELTA_TOLERANCE) return 'regressing'
  return 'stable'
}

const collectAllCategories = (runs: DashboardAdvisorEvalRunResponse[]): string[] => {
  const set = new Set<string>()
  for (const run of runs) {
    const breakdown = extractByCategory(run.summary)
    for (const cat of Object.keys(breakdown)) set.add(cat)
  }
  return [...set].sort()
}

export interface EvalTrendsRepositoryAdapter {
  listAdvisorEvalTrendRuns: (input: {
    windowDays: number
    limit: number
  }) => Promise<DashboardAdvisorEvalRunResponse[]>
}

export const computeAdvisorEvalTrends = (
  runs: DashboardAdvisorEvalRunResponse[],
  windowDays: number,
  generatedAt: Date
): DashboardAdvisorEvalTrendsResponse => {
  // Runs come in newest-first. Build a per-category history (also newest-first) of runs that
  // mention that category in their breakdown.
  const perCategoryRuns = new Map<
    string,
    Array<{ run: DashboardAdvisorEvalRunResponse; counts: CategoryCounts }>
  >()
  for (const run of runs) {
    const breakdown = extractByCategory(run.summary)
    for (const [category, counts] of Object.entries(breakdown)) {
      const list = perCategoryRuns.get(category) ?? []
      list.push({ run, counts })
      perCategoryRuns.set(category, list)
    }
  }

  const allCategories = collectAllCategories(runs)
  const groupBuckets = new Map<DashboardAdvisorEvalTrendsGroup, DashboardAdvisorEvalTrendCategory[]>([
    ['quality', []],
    ['safety', []],
    ['economics', []],
  ])

  for (const category of allCategories) {
    const history = perCategoryRuns.get(category) ?? []
    const totalRuns = history.length
    const latestEntry = history[0] ?? null
    const previousEntry = history[1] ?? null

    const latestPassRate = latestEntry ? passRateOf(latestEntry.counts) : null
    const previousPassRate = previousEntry ? passRateOf(previousEntry.counts) : null
    const delta =
      latestPassRate !== null && previousPassRate !== null
        ? latestPassRate - previousPassRate
        : null

    const latest: DashboardAdvisorEvalTrendCategoryLatest = latestEntry
      ? {
          runId: String(latestEntry.run.id),
          createdAt: latestEntry.run.createdAt,
          passRate: latestPassRate,
          passed: latestEntry.counts.passed,
          failed: latestEntry.counts.failed,
          skipped: latestEntry.counts.skipped,
          failedCaseKeys: latestEntry.counts.failedCaseKeys,
        }
      : {
          runId: null,
          createdAt: null,
          passRate: null,
          passed: 0,
          failed: 0,
          skipped: 0,
          failedCaseKeys: [],
        }

    const previous: DashboardAdvisorEvalTrendCategoryPrevious | null = previousEntry
      ? {
          runId: String(previousEntry.run.id),
          createdAt: previousEntry.run.createdAt,
          passRate: previousPassRate,
        }
      : null

    const trendCategory: DashboardAdvisorEvalTrendCategory = {
      category,
      totalRuns,
      latest,
      previous,
      delta,
      status: statusForDelta(delta, totalRuns),
    }

    const group = groupForCategory(category)
    const bucket = groupBuckets.get(group)
    if (bucket) bucket.push(trendCategory)
  }

  // Group-level rollup: total runs is the max category-level totalRuns inside the group; pass
  // rates are weighted by case count of each category's latest/previous run. If no category in
  // the group has data, surface nulls (do not fabricate).
  const groups: DashboardAdvisorEvalTrendGroup[] = []
  for (const groupName of ['quality', 'safety', 'economics'] as const) {
    const cats = (groupBuckets.get(groupName) ?? []).sort((a, b) =>
      a.category.localeCompare(b.category)
    )
    const totalRuns = cats.reduce((m, c) => Math.max(m, c.totalRuns), 0)

    let latestPassed = 0
    let latestEvaluable = 0
    let previousPassed = 0
    let previousEvaluable = 0
    let hasLatestData = false
    let hasPreviousData = false
    for (const c of cats) {
      const latestEvalDenom = c.latest.passed + c.latest.failed
      if (latestEvalDenom > 0) {
        latestPassed += c.latest.passed
        latestEvaluable += latestEvalDenom
        hasLatestData = true
      }
      if (c.previous && c.previous.passRate !== null) {
        // To weight previous, we need previous run counts. They aren't on the
        // DashboardAdvisorEvalTrendCategoryPrevious shape — only the rate. Approximate by reusing
        // latest's evaluable denominator for that category as the weight; if latest isn't
        // present, fall back to 1. This matches how dashboards typically render previous as a
        // rate-only reference and avoids pretending we have separate sample sizes.
        const weight = latestEvalDenom > 0 ? latestEvalDenom : 1
        previousPassed += c.previous.passRate * weight
        previousEvaluable += weight
        hasPreviousData = true
      }
    }

    const latestPassRate = hasLatestData && latestEvaluable > 0 ? latestPassed / latestEvaluable : null
    const previousPassRate =
      hasPreviousData && previousEvaluable > 0 ? previousPassed / previousEvaluable : null
    const delta =
      latestPassRate !== null && previousPassRate !== null
        ? latestPassRate - previousPassRate
        : null

    groups.push({
      group: groupName,
      totalRuns,
      latestPassRate,
      previousPassRate,
      delta,
      categories: cats,
    })
  }

  const caveats: string[] = [
    'Tendances calculées à partir des evals déterministes uniquement. Aucune affirmation de profitabilité ou de prédictivité.',
  ]
  const hasAnyData = groups.some(g => g.totalRuns > 0)
  if (!hasAnyData) {
    caveats.push("Aucune exécution d'eval enregistrée dans la fenêtre demandée.")
  } else if (runs.some(r => !r.summary || !('byCategory' in (r.summary ?? {})))) {
    caveats.push(
      'Certains runs antérieurs ne contiennent pas de répartition par catégorie ; les valeurs `passed` ont été reconstruites à partir des échecs uniquement.'
    )
  }

  return {
    generatedAt: generatedAt.toISOString(),
    mode: 'admin',
    windowDays,
    groups,
    caveats,
  }
}

export const buildDeterministicAdvisorEvalTrendsDemo = (
  generatedAt: Date,
  windowDays: number
): DashboardAdvisorEvalTrendsResponse => {
  // Deterministic, never-fabricated: the demo surface mirrors the seeded eval categories with a
  // mild "improving on quality, stable on safety/economics" posture so the UI can render every
  // state. Numbers are intentionally moderate; this is a fixture, not a claim.
  const mkCategory = (
    category: string,
    latestPassed: number,
    latestFailed: number,
    previousRate: number | null,
    runs: number
  ): DashboardAdvisorEvalTrendCategory => {
    const denom = latestPassed + latestFailed
    const latestRate = denom > 0 ? latestPassed / denom : null
    const delta = latestRate !== null && previousRate !== null ? latestRate - previousRate : null
    return {
      category,
      totalRuns: runs,
      latest: {
        runId: `demo-${category}`,
        createdAt: generatedAt.toISOString(),
        passRate: latestRate,
        passed: latestPassed,
        failed: latestFailed,
        skipped: 0,
        failedCaseKeys: [],
      },
      previous:
        previousRate !== null
          ? {
              runId: `demo-${category}-prev`,
              createdAt: new Date(generatedAt.getTime() - 24 * 60 * 60 * 1000).toISOString(),
              passRate: previousRate,
            }
          : null,
      delta,
      status: statusForDelta(delta, runs),
    }
  }

  const qualityCategories: DashboardAdvisorEvalTrendCategory[] = [
    mkCategory('causal_reasoning', 1, 0, 0.5, 4),
    mkCategory('recommendation_quality', 0, 0, null, 1),
    mkCategory('strategy_quality', 1, 0, 1.0, 4),
    mkCategory('transaction_classification', 0, 0, null, 1),
  ]
  const safetyCategories: DashboardAdvisorEvalTrendCategory[] = [
    mkCategory('challenger', 0, 0, null, 1),
    mkCategory('data_sufficiency', 0, 0, null, 1),
    mkCategory('post_mortem_safety', 1, 0, 1.0, 3),
    mkCategory('risk_calibration', 1, 0, 1.0, 3),
  ]
  const economicsCategories: DashboardAdvisorEvalTrendCategory[] = [
    mkCategory('cost_control', 0, 0, null, 1),
  ]

  const buildGroup = (
    group: DashboardAdvisorEvalTrendsGroup,
    cats: DashboardAdvisorEvalTrendCategory[]
  ): DashboardAdvisorEvalTrendGroup => {
    const totalRuns = cats.reduce((m, c) => Math.max(m, c.totalRuns), 0)
    let p = 0
    let e = 0
    let pp = 0
    let pe = 0
    for (const c of cats) {
      const d = c.latest.passed + c.latest.failed
      if (d > 0) {
        p += c.latest.passed
        e += d
      }
      if (c.previous && c.previous.passRate !== null && d > 0) {
        pp += c.previous.passRate * d
        pe += d
      }
    }
    const latestPassRate = e > 0 ? p / e : null
    const previousPassRate = pe > 0 ? pp / pe : null
    const delta =
      latestPassRate !== null && previousPassRate !== null ? latestPassRate - previousPassRate : null
    return { group, totalRuns, latestPassRate, previousPassRate, delta, categories: cats }
  }

  return {
    generatedAt: generatedAt.toISOString(),
    mode: 'demo',
    windowDays,
    groups: [
      buildGroup('quality', qualityCategories),
      buildGroup('safety', safetyCategories),
      buildGroup('economics', economicsCategories),
    ],
    caveats: [
      'Mode démo : données déterministes, non issues d’une exécution réelle.',
      'Tendances basées sur les evals déterministes ; aucune affirmation de profitabilité ou de prédictivité.',
    ],
  }
}

export interface AdvisorEvalTrendsUseCase {
  getAdvisorEvalsTrends: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    windowDays?: number | null
    now?: Date
  }) => Promise<DashboardAdvisorEvalTrendsResponse>
}

export const createAdvisorEvalTrendsUseCase = ({
  repository,
}: {
  repository: EvalTrendsRepositoryAdapter
}): AdvisorEvalTrendsUseCase => ({
  async getAdvisorEvalsTrends(input) {
    const windowDays = clampWindowDays(input.windowDays ?? null)
    const generatedAt = input.now ?? new Date()
    if (input.mode === 'demo') {
      return buildDeterministicAdvisorEvalTrendsDemo(generatedAt, windowDays)
    }
    const runs = await repository.listAdvisorEvalTrendRuns({
      windowDays,
      limit: EVAL_TREND_RUN_LIMIT,
    })
    return computeAdvisorEvalTrends(runs, windowDays, generatedAt)
  },
})
