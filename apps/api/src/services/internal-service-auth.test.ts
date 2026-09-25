import { describe, expect, it } from 'bun:test'
import { INTERNAL_SERVICE_TOKEN_HEADER, internalServiceHeaders } from './internal-service-auth'

describe('internalServiceHeaders', () => {
  it('returns an empty object when no token is configured', () => {
    expect(internalServiceHeaders(undefined)).toEqual({})
    expect(internalServiceHeaders('')).toEqual({})
  })

  it('returns only the x-internal-service-token header when configured', () => {
    expect(INTERNAL_SERVICE_TOKEN_HEADER).toBe('x-internal-service-token')
    expect(internalServiceHeaders('secret-token-value')).toEqual({
      'x-internal-service-token': 'secret-token-value',
    })
  })
})
