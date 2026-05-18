import { describe, expect, it } from 'bun:test'
import {
  ExternalInvestmentProviderError,
  isSoftExternalInvestmentError,
  toExternalInvestmentErrorCode,
  toSafeExternalInvestmentErrorMessage,
} from './errors'

describe('isSoftExternalInvestmentError', () => {
  it('treats PROVIDER_NO_ACTIVITY as soft (success_empty / partial outcome)', () => {
    expect(isSoftExternalInvestmentError('PROVIDER_NO_ACTIVITY')).toBe(true)
  })

  it('treats provider degradation codes as soft', () => {
    expect(isSoftExternalInvestmentError('PROVIDER_PARTIAL_DATA')).toBe(true)
    expect(isSoftExternalInvestmentError('PROVIDER_STALE_DATA')).toBe(true)
    expect(isSoftExternalInvestmentError('PROVIDER_RATE_LIMITED')).toBe(true)
    expect(isSoftExternalInvestmentError('VALUATION_PARTIAL')).toBe(true)
    expect(isSoftExternalInvestmentError('ADVISOR_BUNDLE_STALE')).toBe(true)
  })

  it('treats hard errors as not soft', () => {
    expect(isSoftExternalInvestmentError('PROVIDER_CREDENTIALS_INVALID')).toBe(false)
    expect(isSoftExternalInvestmentError('PROVIDER_TIMEOUT')).toBe(false)
    expect(isSoftExternalInvestmentError('NORMALIZATION_FAILED')).toBe(false)
    expect(isSoftExternalInvestmentError('PROVIDER_SCHEMA_CHANGED')).toBe(false)
  })
})

describe('toExternalInvestmentErrorCode', () => {
  it('preserves ExternalInvestmentProviderError code', () => {
    const error = new ExternalInvestmentProviderError({
      provider: 'ibkr',
      code: 'PROVIDER_PARTIAL_DATA',
      message: 'partial',
    })
    expect(toExternalInvestmentErrorCode(error)).toBe('PROVIDER_PARTIAL_DATA')
  })

  it('maps timeout-shaped errors to PROVIDER_TIMEOUT', () => {
    expect(toExternalInvestmentErrorCode(new Error('Request timeout after 30s'))).toBe(
      'PROVIDER_TIMEOUT'
    )
    expect(toExternalInvestmentErrorCode(new Error('AbortError'))).toBe('PROVIDER_TIMEOUT')
  })

  it('falls back to NORMALIZATION_FAILED for unknown errors', () => {
    expect(toExternalInvestmentErrorCode(new Error('something else'))).toBe('NORMALIZATION_FAILED')
  })
})

describe('toSafeExternalInvestmentErrorMessage', () => {
  it('redacts token, apiKey, signature query params', () => {
    const result = toSafeExternalInvestmentErrorMessage(
      new Error('Failed: token=SECRETTOKEN&apiKey=APIKEY&signature=SIG123')
    )
    expect(result).toContain('token=[REDACTED]')
    expect(result).toContain('apiKey=[REDACTED]')
    expect(result).toContain('signature=[REDACTED]')
    expect(result).not.toContain('SECRETTOKEN')
  })
})
