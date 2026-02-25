import { createHmac, timingSafeEqual } from 'node:crypto'
import type { AuthSessionPayload } from './types'

export const AUTH_SESSION_COOKIE_NAME = 'finance_os_session'

const SESSION_TOKEN_SEPARATOR = '.'
const MAX_CLOCK_SKEW_SECONDS = 60
const DAY_IN_SECONDS = 24 * 60 * 60

const isAuthSessionPayload = (value: unknown): value is AuthSessionPayload => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const source = value as Record<string, unknown>
  return source.admin === true && typeof source.iat === 'number' && Number.isFinite(source.iat)
}

const encodeSessionPayload = (payload: AuthSessionPayload) => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

const decodeSessionPayload = (encodedPayload: string): AuthSessionPayload | null => {
  try {
    const rawJson = Buffer.from(encodedPayload, 'base64url').toString('utf8')
    const parsed = JSON.parse(rawJson)

    if (!isAuthSessionPayload(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

const signSessionPayload = (encodedPayload: string, secret: string) => {
  return createHmac('sha256', secret).update(encodedPayload).digest('base64url')
}

const verifySignature = ({
  encodedPayload,
  signature,
  secret,
}: {
  encodedPayload: string
  signature: string
  secret: string
}) => {
  const expected = signSessionPayload(encodedPayload, secret)
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

const getCookieValue = (cookieHeader: string | null, name: string): string | null => {
  if (!cookieHeader) {
    return null
  }

  for (const rawPart of cookieHeader.split(';')) {
    const part = rawPart.trim()
    if (part.length === 0) {
      continue
    }

    const separatorIndex = part.indexOf('=')
    if (separatorIndex < 0) {
      continue
    }

    const key = part.slice(0, separatorIndex)
    if (key !== name) {
      continue
    }

    const rawValue = part.slice(separatorIndex + 1)

    try {
      return decodeURIComponent(rawValue)
    } catch {
      return rawValue
    }
  }

  return null
}

export const createSessionToken = ({
  secret,
  issuedAtSeconds,
}: {
  secret: string
  issuedAtSeconds: number
}) => {
  const payload = encodeSessionPayload({
    admin: true,
    iat: issuedAtSeconds,
  })
  const signature = signSessionPayload(payload, secret)

  return `${payload}${SESSION_TOKEN_SEPARATOR}${signature}`
}

export const readSessionFromCookie = ({
  cookieHeader,
  secret,
  ttlDays,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  cookieHeader: string | null
  secret: string
  ttlDays: number
  nowSeconds?: number
}) => {
  const token = getCookieValue(cookieHeader, AUTH_SESSION_COOKIE_NAME)

  if (!token) {
    return null
  }

  const separatorIndex = token.lastIndexOf(SESSION_TOKEN_SEPARATOR)
  if (separatorIndex < 1) {
    return null
  }

  const encodedPayload = token.slice(0, separatorIndex)
  const signature = token.slice(separatorIndex + 1)

  if (!encodedPayload || !signature) {
    return null
  }

  if (
    !verifySignature({
      encodedPayload,
      signature,
      secret,
    })
  ) {
    return null
  }

  const payload = decodeSessionPayload(encodedPayload)
  if (!payload) {
    return null
  }

  const maxAgeSeconds = ttlDays * DAY_IN_SECONDS

  if (payload.iat > nowSeconds + MAX_CLOCK_SKEW_SECONDS) {
    return null
  }

  if (nowSeconds - payload.iat > maxAgeSeconds) {
    return null
  }

  return payload
}

export const serializeSessionCookie = ({
  token,
  ttlDays,
  secure,
}: {
  token: string
  ttlDays: number
  secure: boolean
}) => {
  const maxAgeSeconds = ttlDays * DAY_IN_SECONDS
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}

export const serializeSessionCookieClear = ({ secure }: { secure: boolean }) => {
  const parts = [
    `${AUTH_SESSION_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0',
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
  ]

  if (secure) {
    parts.push('Secure')
  }

  return parts.join('; ')
}
