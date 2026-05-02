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

export const toSafeExternalInvestmentErrorMessage = (error: unknown) => {
  const raw = error instanceof Error ? error.message : String(error)
  return raw
    .replace(/signature=[^&\s]+/gi, 'signature=[REDACTED]')
    .replace(/apiKey=[^&\s]+/gi, 'apiKey=[REDACTED]')
    .replace(/token=[^&\s]+/gi, 'token=[REDACTED]')
    .slice(0, 1000)
}
