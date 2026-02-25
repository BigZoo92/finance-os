import { describe, expect, it } from 'bun:test'
import {
  AUTH_SESSION_COOKIE_NAME,
  createSessionToken,
  readSessionFromCookie,
  serializeSessionCookie,
} from './session'

const SECRET = 'test-secret-with-at-least-thirty-two-bytes!!'

describe('auth session cookie', () => {
  it('creates and reads a valid admin session from cookie header', () => {
    const issuedAtSeconds = 1_700_000_000
    const token = createSessionToken({
      secret: SECRET,
      issuedAtSeconds,
    })

    const cookie = serializeSessionCookie({
      token,
      ttlDays: 30,
      secure: false,
    })

    const parsed = readSessionFromCookie({
      cookieHeader: `${cookie}; other_cookie=foo`,
      secret: SECRET,
      ttlDays: 30,
      nowSeconds: issuedAtSeconds + 10,
    })

    expect(parsed).toEqual({
      admin: true,
      iat: issuedAtSeconds,
    })
  })

  it('returns null for expired sessions', () => {
    const issuedAtSeconds = 1_700_000_000
    const token = createSessionToken({
      secret: SECRET,
      issuedAtSeconds,
    })

    const cookieHeader = `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`

    const parsed = readSessionFromCookie({
      cookieHeader,
      secret: SECRET,
      ttlDays: 1,
      nowSeconds: issuedAtSeconds + 2 * 24 * 60 * 60,
    })

    expect(parsed).toBeNull()
  })

  it('returns null for tampered tokens', () => {
    const issuedAtSeconds = 1_700_000_000
    const token = createSessionToken({
      secret: SECRET,
      issuedAtSeconds,
    })

    const tamperedToken = `${token}x`
    const cookieHeader = `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(tamperedToken)}`

    const parsed = readSessionFromCookie({
      cookieHeader,
      secret: SECRET,
      ttlDays: 30,
      nowSeconds: issuedAtSeconds + 60,
    })

    expect(parsed).toBeNull()
  })
})
