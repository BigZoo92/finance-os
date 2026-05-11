// Macro Prompt 5 — Pure data-quality compute.
//
// Deterministic helper that maps a closed-vocab snapshot of local rows into a
// browser-safe `DataQualityResponse`. The function performs zero IO — callers
// are responsible for assembling the snapshot from existing repositories.
//
// Scoring philosophy (per Macro Prompt 5 hard constraints):
//   - Conservative. `ok` caps at 95 (never 100) because we cannot prove
//     correctness from a sync snapshot alone.
//   - Unknown / missing data is `score: null`, never 0. The overall score
//     averages only the dimensions with a numeric score so missing inputs do
//     not punish the overall grade arbitrarily.
//   - `down` (configured + failing) maps to a low non-null score; missing /
//     unconfigured / disabled-by-flag map to `null` with explicit reasons.
//   - Stale data downgrades to `usable`/`degraded` rather than `down`.
//   - No score implies financial performance — only data reliability.

import type {
  AdvisorReadiness,
  DataQualityDimension,
  DataQualityDimensionInput,
  DataQualityDimensionInputStatus,
  DataQualityDimensionKey,
  DataQualityGrade,
  DataQualityOverall,
  DataQualityResponse,
} from './data-quality-types'

const STATUS_BASE_SCORE: Record<
  Exclude<
    DataQualityDimensionInputStatus,
    'unknown' | 'missing' | 'unconfigured' | 'disabled_by_flag'
  >,
  number
> = {
  ok: 95,
  degraded: 60,
  down: 20,
  stale: 50,
}

const gradeFromScore = (score: number): Exclude<DataQualityGrade, 'unknown'> => {
  if (score >= 90) return 'excellent'
  if (score >= 75) return 'good'
  if (score >= 55) return 'usable'
  if (score >= 30) return 'degraded'
  return 'insufficient'
}

const computeFreshnessMinutes = (
  lastSuccessAt: string | null,
  generatedAt: Date
): number | null => {
  if (lastSuccessAt === null) return null
  const ts = Date.parse(lastSuccessAt)
  if (Number.isNaN(ts)) return null
  const diffMs = generatedAt.getTime() - ts
  if (diffMs < 0) return 0
  return Math.floor(diffMs / 60_000)
}

interface MappedDimension {
  readonly score: number | null
  readonly grade: DataQualityGrade
  readonly stale: boolean
  readonly degraded: boolean
  readonly missing: boolean
  readonly reasons: ReadonlyArray<string>
}

const mapInputToDimension = (
  input: DataQualityDimensionInput,
  freshnessMinutes: number | null
): MappedDimension => {
  const reasons: string[] = []

  // Compute staleness independently of the input status — a snapshot can be
  // marked `ok` upstream while its `lastSuccessAt` has aged past the threshold.
  const isStale =
    input.staleAfterMinutes !== null &&
    freshnessMinutes !== null &&
    freshnessMinutes > input.staleAfterMinutes

  // Effective status applies stale downgrade. Stale-when-ok → `stale`. Stale-when-degraded
  // stays `degraded` (already worse than stale). Stale never downgrades into `down`.
  let effective: DataQualityDimensionInputStatus = input.status
  if (isStale && (effective === 'ok' || effective === 'stale')) {
    effective = 'stale'
  }

  switch (effective) {
    case 'ok': {
      return {
        score: STATUS_BASE_SCORE.ok,
        grade: gradeFromScore(STATUS_BASE_SCORE.ok),
        stale: false,
        degraded: false,
        missing: false,
        reasons,
      }
    }
    case 'degraded': {
      reasons.push('local snapshot reports degraded state')
      const score = isStale
        ? Math.max(STATUS_BASE_SCORE.degraded - 10, 0)
        : STATUS_BASE_SCORE.degraded
      if (isStale) reasons.push('last successful refresh is older than configured threshold')
      return {
        score,
        grade: gradeFromScore(score),
        stale: isStale,
        degraded: true,
        missing: false,
        reasons,
      }
    }
    case 'down': {
      reasons.push('local snapshot reports failing state')
      return {
        score: STATUS_BASE_SCORE.down,
        grade: gradeFromScore(STATUS_BASE_SCORE.down),
        stale: isStale,
        degraded: true,
        missing: false,
        reasons,
      }
    }
    case 'stale': {
      reasons.push('last successful refresh is older than configured threshold')
      return {
        score: STATUS_BASE_SCORE.stale,
        grade: gradeFromScore(STATUS_BASE_SCORE.stale),
        stale: true,
        degraded: true,
        missing: false,
        reasons,
      }
    }
    case 'unconfigured': {
      reasons.push('provider not configured')
      return {
        score: null,
        grade: 'unknown',
        stale: false,
        degraded: true,
        missing: true,
        reasons,
      }
    }
    case 'disabled_by_flag': {
      reasons.push('feature flag disabled for this provider')
      return {
        score: null,
        grade: 'unknown',
        stale: false,
        degraded: true,
        missing: true,
        reasons,
      }
    }
    case 'missing': {
      reasons.push('no local snapshot recorded yet')
      return {
        score: null,
        grade: 'unknown',
        stale: false,
        degraded: false,
        missing: true,
        reasons,
      }
    }
    case 'unknown': {
      reasons.push('insufficient local data to score this dimension')
      return {
        score: null,
        grade: 'unknown',
        stale: false,
        degraded: false,
        missing: true,
        reasons,
      }
    }
    default: {
      const _exhaustive: never = effective
      return _exhaustive
    }
  }
}

const computeOverall = (dimensions: ReadonlyArray<DataQualityDimension>): DataQualityOverall => {
  const scoredScores = dimensions.flatMap(d => (d.score === null ? [] : [d.score]))
  const anyStale = dimensions.some(d => d.stale)
  const anyDegraded = dimensions.some(d => d.degraded)

  if (scoredScores.length === 0) {
    return {
      score: 0,
      grade: 'insufficient',
      stale: anyStale,
      degraded: anyDegraded,
    }
  }

  const avg = scoredScores.reduce((acc, n) => acc + n, 0) / scoredScores.length
  // Conservative: if any dimension is degraded/stale, cap the overall grade so
  // a few healthy dimensions cannot mask serious issues elsewhere.
  let capped = avg
  if (anyDegraded) capped = Math.min(capped, 75)
  if (anyStale) capped = Math.min(capped, 70)
  const rounded = Math.round(capped)
  return {
    score: rounded,
    grade: gradeFromScore(rounded),
    stale: anyStale,
    degraded: anyDegraded,
  }
}

const ADVISOR_REQUIRED_DIMENSIONS: ReadonlyArray<DataQualityDimensionKey> = [
  'banking',
  'investments',
  'market_data',
]

const ADVISOR_SUPPORTING_DIMENSIONS: ReadonlyArray<DataQualityDimensionKey> = [
  'news',
  'advisor_memory',
  'evals',
]

const computeAdvisorReadiness = (
  dimensions: ReadonlyArray<DataQualityDimension>
): AdvisorReadiness => {
  const byKey = new Map(dimensions.map(d => [d.key, d]))
  const reasons: string[] = []
  const missingInputs: string[] = []
  const staleInputs: string[] = []
  const caveats: string[] = []

  let requiredMissingCount = 0
  let requiredStaleCount = 0
  let requiredDownCount = 0

  for (const key of ADVISOR_REQUIRED_DIMENSIONS) {
    const dimension = byKey.get(key)
    if (!dimension || dimension.missing) {
      missingInputs.push(key)
      requiredMissingCount += 1
      continue
    }
    if (dimension.score !== null && dimension.score <= STATUS_BASE_SCORE.down) {
      reasons.push(`${key} dimension is failing locally`)
      requiredDownCount += 1
    }
    if (dimension.stale) {
      staleInputs.push(key)
      requiredStaleCount += 1
    }
  }

  for (const key of ADVISOR_SUPPORTING_DIMENSIONS) {
    const dimension = byKey.get(key)
    if (!dimension) continue
    if (dimension.missing) {
      caveats.push(`${key} input is missing — advisor will operate without it`)
      continue
    }
    if (dimension.stale) {
      staleInputs.push(key)
      caveats.push(`${key} input is stale`)
    }
  }

  if (requiredMissingCount >= 2 || requiredDownCount >= 2) {
    reasons.push('multiple required inputs are missing or failing')
    return {
      ready: false,
      level: 'not_ready',
      reasons,
      missingInputs,
      staleInputs,
      caveats,
    }
  }

  if (requiredMissingCount >= 1 || requiredDownCount >= 1) {
    reasons.push('one required input is missing or failing')
    return {
      ready: false,
      level: 'limited',
      reasons,
      missingInputs,
      staleInputs,
      caveats,
    }
  }

  if (requiredStaleCount >= 1) {
    reasons.push('one or more required inputs are stale')
    return {
      ready: true,
      level: 'usable_with_caveats',
      reasons,
      missingInputs,
      staleInputs,
      caveats,
    }
  }

  return {
    ready: true,
    level: 'ready',
    reasons,
    missingInputs,
    staleInputs,
    caveats,
  }
}

const collectBlockingIssues = (
  dimensions: ReadonlyArray<DataQualityDimension>
): ReadonlyArray<string> => {
  const issues: string[] = []
  for (const dim of dimensions) {
    if (dim.score !== null && dim.score <= STATUS_BASE_SCORE.down) {
      issues.push(`${dim.key} dimension is failing locally`)
    }
  }
  return issues
}

const collectCaveats = (dimensions: ReadonlyArray<DataQualityDimension>): ReadonlyArray<string> => {
  const caveats: string[] = []
  for (const dim of dimensions) {
    if (dim.missing) {
      caveats.push(`${dim.key} dimension has no local snapshot — score reported as null`)
    } else if (dim.stale) {
      caveats.push(`${dim.key} dimension is older than its configured staleness threshold`)
    }
  }
  caveats.push('scores reflect local data reliability only — not investment performance')
  return caveats
}

export interface ComputeDataQualityInput {
  readonly mode: 'demo' | 'admin'
  readonly generatedAt: Date
  readonly dimensions: ReadonlyArray<DataQualityDimensionInput>
}

export const computeDataQuality = (input: ComputeDataQualityInput): DataQualityResponse => {
  const generatedAt = input.generatedAt.toISOString()
  // Stable ordering: sort by the canonical key order regardless of input order.
  const canonicalOrder: ReadonlyArray<DataQualityDimensionKey> = [
    'banking',
    'investments',
    'crypto',
    'market_data',
    'news',
    'advisor_memory',
    'evals',
    'post_mortems',
  ]
  const byKey = new Map<DataQualityDimensionKey, DataQualityDimensionInput>()
  for (const dim of input.dimensions) {
    byKey.set(dim.key, dim)
  }

  const dimensions: DataQualityDimension[] = canonicalOrder
    .filter(key => byKey.has(key))
    .map(key => {
      const raw = byKey.get(key) as DataQualityDimensionInput
      const freshnessMinutes = computeFreshnessMinutes(raw.lastSuccessAt, input.generatedAt)
      const mapped = mapInputToDimension(raw, freshnessMinutes)
      const reasons: string[] = [...mapped.reasons]
      if (raw.extraReasons && raw.extraReasons.length > 0) {
        reasons.push(...raw.extraReasons)
      }
      return {
        key,
        score: mapped.score,
        grade: mapped.grade,
        freshnessMinutes,
        stale: mapped.stale,
        degraded: mapped.degraded,
        missing: mapped.missing,
        reasons,
        providers: [...raw.providers],
      }
    })

  const overall = computeOverall(dimensions)
  const advisorReadiness = computeAdvisorReadiness(dimensions)
  const blockingIssues = collectBlockingIssues(dimensions)
  const caveats = collectCaveats(dimensions)

  return {
    generatedAt,
    mode: input.mode,
    overall,
    dimensions,
    advisorReadiness,
    blockingIssues,
    caveats,
  }
}
