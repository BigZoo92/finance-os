// Risk calibration scorer.
// Catches recommendations whose confidence/riskLevel does not match available evidence:
// stale data, missing cost basis, partial valuation, concentration, or insufficient transaction
// history.

import type { AiEvalCaseSeed } from '../../types'
import {
  MISSING_DATA_FLAGS,
  STALE_DATA_FLAGS,
  UNCERTAINTY_MARKERS,
  anyStringContains,
  buildResult,
  collectStrings,
  type ScoringResult,
} from './shared'

interface RiskCandidate {
  whyNow?: string
  description?: string
  caveats?: string[]
  evidence?: string[]
  confidence?: number
  riskLevel?: 'low' | 'medium' | 'high'
  flags?: {
    dataStale?: boolean
    missingCostBasis?: boolean
    partialValuation?: boolean
    insufficientTransactionHistory?: boolean
    cryptoExposure?: boolean
    highConcentration?: boolean
    highVolatility?: boolean
    insufficientEmergencyFund?: boolean
  }
}

interface RiskExpectation {
  maxConfidenceWhenStale?: number
  maxConfidenceWhenMissingData?: number
  minRiskLevelWhenCryptoOrConcentration?: 'low' | 'medium' | 'high'
  requireCautiousLanguageWhenDegraded?: boolean
  forbidIncreasedRiskWhenEmergencyFundLow?: boolean
}

const RISK_RANK: Record<'low' | 'medium' | 'high', number> = {
  low: 0,
  medium: 1,
  high: 2,
}

const readCandidate = (input: AiEvalCaseSeed['input']): RiskCandidate => {
  const candidate = (input.candidateOutput ?? {}) as Record<string, unknown>
  const out: RiskCandidate = {}
  if (typeof candidate.whyNow === 'string') out.whyNow = candidate.whyNow
  if (typeof candidate.description === 'string') out.description = candidate.description
  if (Array.isArray(candidate.caveats))
    out.caveats = candidate.caveats.filter((v): v is string => typeof v === 'string')
  if (Array.isArray(candidate.evidence))
    out.evidence = candidate.evidence.filter((v): v is string => typeof v === 'string')
  if (typeof candidate.confidence === 'number') out.confidence = candidate.confidence
  if (
    candidate.riskLevel === 'low' ||
    candidate.riskLevel === 'medium' ||
    candidate.riskLevel === 'high'
  ) {
    out.riskLevel = candidate.riskLevel
  }
  if (candidate.flags && typeof candidate.flags === 'object') {
    const flags = candidate.flags as Record<string, unknown>
    out.flags = {
      ...(typeof flags.dataStale === 'boolean' ? { dataStale: flags.dataStale } : {}),
      ...(typeof flags.missingCostBasis === 'boolean'
        ? { missingCostBasis: flags.missingCostBasis }
        : {}),
      ...(typeof flags.partialValuation === 'boolean'
        ? { partialValuation: flags.partialValuation }
        : {}),
      ...(typeof flags.insufficientTransactionHistory === 'boolean'
        ? { insufficientTransactionHistory: flags.insufficientTransactionHistory }
        : {}),
      ...(typeof flags.cryptoExposure === 'boolean'
        ? { cryptoExposure: flags.cryptoExposure }
        : {}),
      ...(typeof flags.highConcentration === 'boolean'
        ? { highConcentration: flags.highConcentration }
        : {}),
      ...(typeof flags.highVolatility === 'boolean'
        ? { highVolatility: flags.highVolatility }
        : {}),
      ...(typeof flags.insufficientEmergencyFund === 'boolean'
        ? { insufficientEmergencyFund: flags.insufficientEmergencyFund }
        : {}),
    }
  }
  return out
}

const readExpectation = (input: AiEvalCaseSeed['expectation']): RiskExpectation => {
  const out: RiskExpectation = {}
  if (typeof input.maxConfidenceWhenStale === 'number')
    out.maxConfidenceWhenStale = input.maxConfidenceWhenStale
  if (typeof input.maxConfidenceWhenMissingData === 'number')
    out.maxConfidenceWhenMissingData = input.maxConfidenceWhenMissingData
  if (
    input.minRiskLevelWhenCryptoOrConcentration === 'low' ||
    input.minRiskLevelWhenCryptoOrConcentration === 'medium' ||
    input.minRiskLevelWhenCryptoOrConcentration === 'high'
  ) {
    out.minRiskLevelWhenCryptoOrConcentration = input.minRiskLevelWhenCryptoOrConcentration
  }
  if (typeof input.requireCautiousLanguageWhenDegraded === 'boolean')
    out.requireCautiousLanguageWhenDegraded = input.requireCautiousLanguageWhenDegraded
  if (typeof input.forbidIncreasedRiskWhenEmergencyFundLow === 'boolean')
    out.forbidIncreasedRiskWhenEmergencyFundLow = input.forbidIncreasedRiskWhenEmergencyFundLow
  return out
}

export const scoreRiskCalibration = (caseSeed: AiEvalCaseSeed): ScoringResult => {
  const candidate = readCandidate(caseSeed.input)
  const expectation = readExpectation(caseSeed.expectation)
  const failed: string[] = []
  const flags = candidate.flags ?? {}

  const corpus = collectStrings({
    whyNow: candidate.whyNow,
    description: candidate.description,
    caveats: candidate.caveats,
    evidence: candidate.evidence,
  })

  const dataIsStale =
    flags.dataStale === true || anyStringContains(corpus, STALE_DATA_FLAGS).length > 0

  const dataIsMissing =
    flags.missingCostBasis === true ||
    flags.partialValuation === true ||
    flags.insufficientTransactionHistory === true ||
    anyStringContains(corpus, MISSING_DATA_FLAGS).length > 0

  // 1. Confidence cap when data is stale.
  if (
    typeof expectation.maxConfidenceWhenStale === 'number' &&
    dataIsStale &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence > expectation.maxConfidenceWhenStale
  ) {
    failed.push(
      `confidence_above_cap_when_stale:${candidate.confidence.toFixed(2)}>${expectation.maxConfidenceWhenStale.toFixed(2)}`
    )
  }

  // 2. Confidence cap when data is missing/partial.
  if (
    typeof expectation.maxConfidenceWhenMissingData === 'number' &&
    dataIsMissing &&
    typeof candidate.confidence === 'number' &&
    candidate.confidence > expectation.maxConfidenceWhenMissingData
  ) {
    failed.push(
      `confidence_above_cap_when_missing:${candidate.confidence.toFixed(2)}>${expectation.maxConfidenceWhenMissingData.toFixed(2)}`
    )
  }

  // 3. Risk-level floor when crypto or concentration risk is present.
  if (expectation.minRiskLevelWhenCryptoOrConcentration) {
    const triggers =
      flags.cryptoExposure === true ||
      flags.highConcentration === true ||
      flags.highVolatility === true
    if (triggers && candidate.riskLevel) {
      const observed = RISK_RANK[candidate.riskLevel]
      const required = RISK_RANK[expectation.minRiskLevelWhenCryptoOrConcentration]
      if (observed < required) {
        failed.push(
          `risk_level_below_floor:${candidate.riskLevel}<${expectation.minRiskLevelWhenCryptoOrConcentration}`
        )
      }
    } else if (triggers && !candidate.riskLevel) {
      failed.push('risk_level_missing_for_high_risk_exposure')
    }
  }

  // 4. Cautious language when degraded.
  if (
    expectation.requireCautiousLanguageWhenDegraded === true &&
    (dataIsStale || dataIsMissing)
  ) {
    const markers = anyStringContains(corpus, UNCERTAINTY_MARKERS)
    if (markers.length === 0) {
      failed.push('missing_cautious_language_when_degraded')
    }
  }

  // 5. Forbid raising risky exposure while emergency fund is low.
  if (
    expectation.forbidIncreasedRiskWhenEmergencyFundLow === true &&
    flags.insufficientEmergencyFund === true &&
    candidate.riskLevel === 'high'
  ) {
    failed.push('high_risk_recommendation_with_low_emergency_fund')
  }

  return buildResult({
    category: caseSeed.category,
    caseId: caseSeed.key,
    failedExpectations: failed,
  })
}
