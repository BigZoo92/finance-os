import type {
  AdvisorAccountScope,
  AdvisorInvestmentAction,
  AdvisorInvestmentHorizon,
} from '@finance-os/db/schema'

export type AdvisorInvestmentRecommendationDraft = {
  runId?: number | null
  accountScope: AdvisorAccountScope
  assetId?: string | null
  instrumentId?: string | null
  symbol: string
  action: AdvisorInvestmentAction
  horizon: AdvisorInvestmentHorizon
  thesis: string
  supportingSignals: Array<Record<string, unknown>>
  contradictingSignals: Array<Record<string, unknown>>
  riskLevel: string
  confidence: number
  priceUsed?: number | null
  priceSnapshotId?: number | null
  priceSource?: string | null
  priceSourceType?: string | null
  marketTimestamp?: string | null
  fetchedAt?: string | null
  delaySeconds?: number | null
  isPriceStale: boolean
  staleReason?: string | null
  invalidationCriteria: Array<Record<string, unknown>>
  expectedMove?: number | null
  probability?: number | null
  reviewDates: Array<'J1' | 'J7' | 'J30'>
  missingData: string[]
  humanValidationRequired: true
  noAutoTrade: true
}

export type AdvisorInvestmentRecommendationValidation =
  | { ok: true }
  | { ok: false; code: string; message: string }

export const validateInvestmentRecommendationContract = (
  draft: AdvisorInvestmentRecommendationDraft
): AdvisorInvestmentRecommendationValidation => {
  if (draft.humanValidationRequired !== true || draft.noAutoTrade !== true) {
    return {
      ok: false,
      code: 'AUTO_TRADING_GUARDRAIL_REQUIRED',
      message:
        'Investment recommendations must require human validation and must not be executable orders.',
    }
  }

  if (draft.action === 'buy' && !draft.priceSnapshotId) {
    return {
      ok: false,
      code: 'BUY_REQUIRES_PRICE_SNAPSHOT',
      message:
        'A buy recommendation requires a price snapshot with provenance and freshness metadata.',
    }
  }

  if (draft.action === 'buy' && draft.isPriceStale) {
    return {
      ok: false,
      code: 'BUY_REQUIRES_FRESH_PRICE',
      message:
        'A buy recommendation cannot use a stale price; downgrade to watch or insufficient_data.',
    }
  }

  if (
    draft.action === 'buy' &&
    (!draft.priceSource || !draft.priceSourceType || !draft.marketTimestamp || !draft.fetchedAt)
  ) {
    return {
      ok: false,
      code: 'BUY_REQUIRES_PRICE_METADATA',
      message:
        'A buy recommendation requires price source, source type, market timestamp, and fetched timestamp.',
    }
  }

  return { ok: true }
}

export const downgradeUnsafeBuyRecommendation = (
  draft: AdvisorInvestmentRecommendationDraft
): AdvisorInvestmentRecommendationDraft => {
  const validation = validateInvestmentRecommendationContract(draft)
  if (validation.ok || draft.action !== 'buy') {
    return draft
  }
  return {
    ...draft,
    action: 'insufficient_data',
    missingData: Array.from(new Set([...draft.missingData, validation.code])),
  }
}
