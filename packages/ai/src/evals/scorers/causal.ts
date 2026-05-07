// Causal reasoning scorer.
// Catches overconfident causal claims drawn from weak temporal correlation.

import type { AiEvalCaseSeed } from '../../types'
import {
  CAUSAL_OVERCLAIM_TERMS,
  UNCERTAINTY_MARKERS,
  anyStringContains,
  buildResult,
  collectStrings,
  type ScoringResult,
} from './shared'

interface CausalCandidate {
  whyNow?: string
  description?: string
  evidence?: string[]
  assumptions?: string[]
  alternatives?: string[]
  confidence?: number
}

interface CausalExpectation {
  maxConfidence?: number
  minEvidenceCount?: number
  requireUncertaintyMarkers?: boolean
  bannedCausalClaims?: string[]
  requireAlternatives?: boolean
}

const readCandidate = (input: AiEvalCaseSeed['input']): CausalCandidate => {
  const candidate = (input.candidateOutput ?? {}) as Record<string, unknown>
  const out: CausalCandidate = {}
  if (typeof candidate.whyNow === 'string') out.whyNow = candidate.whyNow
  if (typeof candidate.description === 'string') out.description = candidate.description
  if (Array.isArray(candidate.evidence))
    out.evidence = candidate.evidence.filter((v): v is string => typeof v === 'string')
  if (Array.isArray(candidate.assumptions))
    out.assumptions = candidate.assumptions.filter((v): v is string => typeof v === 'string')
  if (Array.isArray(candidate.alternatives))
    out.alternatives = candidate.alternatives.filter((v): v is string => typeof v === 'string')
  if (typeof candidate.confidence === 'number') out.confidence = candidate.confidence
  return out
}

const readExpectation = (input: AiEvalCaseSeed['expectation']): CausalExpectation => {
  const out: CausalExpectation = {}
  if (typeof input.maxConfidence === 'number') out.maxConfidence = input.maxConfidence
  if (typeof input.minEvidenceCount === 'number') out.minEvidenceCount = input.minEvidenceCount
  if (typeof input.requireUncertaintyMarkers === 'boolean')
    out.requireUncertaintyMarkers = input.requireUncertaintyMarkers
  if (Array.isArray(input.bannedCausalClaims))
    out.bannedCausalClaims = input.bannedCausalClaims.filter(
      (v): v is string => typeof v === 'string'
    )
  if (typeof input.requireAlternatives === 'boolean')
    out.requireAlternatives = input.requireAlternatives
  return out
}

export const scoreCausalReasoning = (caseSeed: AiEvalCaseSeed): ScoringResult => {
  const candidate = readCandidate(caseSeed.input)
  const expectation = readExpectation(caseSeed.expectation)
  const failed: string[] = []

  const corpus = collectStrings({
    whyNow: candidate.whyNow,
    description: candidate.description,
    assumptions: candidate.assumptions,
    alternatives: candidate.alternatives,
  })

  // 1. Banned causal-overclaim vocabulary.
  const banned = expectation.bannedCausalClaims ?? CAUSAL_OVERCLAIM_TERMS.slice()
  const overclaims = anyStringContains(corpus, banned)
  if (overclaims.length > 0) {
    failed.push(`overclaim_terms_present:${overclaims.join('|')}`)
  }

  // 2. Confidence cap.
  if (
    typeof expectation.maxConfidence === 'number' &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence > expectation.maxConfidence
  ) {
    failed.push(
      `confidence_above_cap:${candidate.confidence.toFixed(2)}>${expectation.maxConfidence.toFixed(2)}`
    )
  }

  // 3. Evidence count.
  const evidenceCount = candidate.evidence?.length ?? 0
  if (
    typeof expectation.minEvidenceCount === 'number' &&
    evidenceCount < expectation.minEvidenceCount
  ) {
    failed.push(
      `evidence_below_minimum:${evidenceCount}<${expectation.minEvidenceCount}`
    )
  }

  // 4. Uncertainty markers required when evidence is weak or banned vocab risk is high.
  if (expectation.requireUncertaintyMarkers === true) {
    const markers = anyStringContains(corpus, UNCERTAINTY_MARKERS)
    if (markers.length === 0) {
      failed.push('missing_uncertainty_markers')
    }
  }

  // 5. Alternative explanations required.
  if (expectation.requireAlternatives === true) {
    const alternatives = candidate.alternatives ?? []
    if (alternatives.length === 0) {
      failed.push('missing_alternative_explanations')
    }
  }

  return buildResult({
    category: caseSeed.category,
    caseId: caseSeed.key,
    failedExpectations: failed,
  })
}
