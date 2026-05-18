import type { ExternalInvestmentErrorCode, ExternalInvestmentProvider } from './types'

export class ExternalInvestmentProviderError extends Error {
  readonly code: ExternalInvestmentErrorCode
  readonly provider: ExternalInvestmentProvider
  readonly retryable: boolean
  readonly statusCode: number | null

  constructor({
    provider,
    code,
    message,
    retryable = false,
    statusCode = null,
  }: {
    provider: ExternalInvestmentProvider
    code: ExternalInvestmentErrorCode
    message: string
    retryable?: boolean
    statusCode?: number | null
  }) {
    super(message)
    this.name = 'ExternalInvestmentProviderError'
    this.provider = provider
    this.code = code
    this.retryable = retryable
    this.statusCode = statusCode
  }
}

export const toExternalInvestmentErrorCode = (error: unknown): ExternalInvestmentErrorCode => {
  if (error instanceof ExternalInvestmentProviderError) {
    return error.code
  }

  if (error instanceof Error && /timeout|abort/i.test(error.message)) {
    return 'PROVIDER_TIMEOUT'
  }

  return 'NORMALIZATION_FAILED'
}

/**
 * Classify whether an error code is a hard failure or a soft "no-activity"
 * sentinel. Used by the orchestrator to map IBKR / Binance outcomes to
 * refresh-job statuses (success / partial / skipped / failed).
 *
 *   - PROVIDER_NO_ACTIVITY     → success_empty (Last Business Day with no trades)
 *   - PROVIDER_PARTIAL_DATA    → partial
 *   - PROVIDER_STALE_DATA      → partial (data older than expected)
 *   - PROVIDER_RATE_LIMITED    → partial (retry later)
 *   - VALUATION_PARTIAL        → partial
 *   - ADVISOR_BUNDLE_STALE     → partial
 *   - any other                → failed (hard error)
 */
export const isSoftExternalInvestmentError = (code: ExternalInvestmentErrorCode): boolean =>
  code === 'PROVIDER_NO_ACTIVITY' ||
  code === 'PROVIDER_PARTIAL_DATA' ||
  code === 'PROVIDER_STALE_DATA' ||
  code === 'PROVIDER_RATE_LIMITED' ||
  code === 'VALUATION_PARTIAL' ||
  code === 'ADVISOR_BUNDLE_STALE'

export const toSafeExternalInvestmentErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/signature=[^&\s]+/gi, 'signature=[REDACTED]')
    .replace(/apiKey=[^&\s]+/gi, 'apiKey=[REDACTED]')
    .replace(/token=[^&\s]+/gi, 'token=[REDACTED]')
    .slice(0, 1000)
}
