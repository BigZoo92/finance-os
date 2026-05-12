import { describe, expect, it } from 'bun:test'
import { __testing } from './x-twitter-lookup'

describe('x-twitter-lookup route helpers', () => {
  it('maps lookup outcome codes to verificationStatus values', () => {
    expect(__testing.mapVerificationStatus('PAYMENT_REQUIRED')).toBe('unverified_payment_required')
    expect(__testing.mapVerificationStatus('FORBIDDEN')).toBe('unverified_forbidden')
    expect(__testing.mapVerificationStatus('RATE_LIMITED')).toBe('unverified_rate_limited')
    expect(__testing.mapVerificationStatus('NOT_FOUND')).toBe('unverified_not_found')
    expect(__testing.mapVerificationStatus('TOKEN_INVALID')).toBe('unverified_token_invalid')
    expect(__testing.mapVerificationStatus('TOKEN_MISSING')).toBe('unverified_token_invalid')
    expect(__testing.mapVerificationStatus('INVALID_HANDLE')).toBe('unverified_invalid_handle')
    expect(__testing.mapVerificationStatus('NETWORK_ERROR')).toBe('unverified_provider_error')
    expect(__testing.mapVerificationStatus('PROVIDER_UNAVAILABLE')).toBe('unverified_provider_error')
  })

  it('produces deterministic Redis cache keys regardless of @ prefix or case', () => {
    expect(__testing.cacheKey('@UnUsual_Whales')).toBe('x:profile:v1:unusual_whales')
    expect(__testing.cacheKey('unusual_whales')).toBe('x:profile:v1:unusual_whales')
  })
})
