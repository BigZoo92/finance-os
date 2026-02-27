import { createHmac, timingSafeEqual } from 'node:crypto'

type PowensStatePayload = {
  admin: true
  exp: number
}

const STATE_SEPARATOR = '.'
const POWENS_STATE_TTL_SECONDS = 10 * 60
const MAX_CLOCK_SKEW_SECONDS = 30

const isPowensStatePayload = (value: unknown): value is PowensStatePayload => {
  if (!value || typeof value !== 'object') {
    return false
  }

  const source = value as Record<string, unknown>
  return source.admin === true && typeof source.exp === 'number' && Number.isFinite(source.exp)
}

const encodePayload = (payload: PowensStatePayload) => {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
}

const decodePayload = (value: string): PowensStatePayload | null => {
  try {
    const json = Buffer.from(value, 'base64url').toString('utf8')
    const parsed = JSON.parse(json)
    if (!isPowensStatePayload(parsed)) {
      return null
    }

    return parsed
  } catch {
    return null
  }
}

const sign = ({ encodedPayload, secret }: { encodedPayload: string; secret: string }) => {
  return createHmac('sha256', secret).update(`powens:${encodedPayload}`).digest('base64url')
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
  const expected = sign({
    encodedPayload,
    secret,
  })
  const expectedBuffer = Buffer.from(expected, 'utf8')
  const providedBuffer = Buffer.from(signature, 'utf8')

  if (expectedBuffer.length !== providedBuffer.length) {
    return false
  }

  return timingSafeEqual(expectedBuffer, providedBuffer)
}

export const createPowensCallbackState = ({
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  secret: string
  nowSeconds?: number
}) => {
  const encodedPayload = encodePayload({
    admin: true,
    exp: nowSeconds + POWENS_STATE_TTL_SECONDS,
  })
  const signature = sign({
    encodedPayload,
    secret,
  })

  return `${encodedPayload}${STATE_SEPARATOR}${signature}`
}

export const readPowensCallbackState = ({
  value,
  secret,
  nowSeconds = Math.floor(Date.now() / 1000),
}: {
  value: string | undefined
  secret: string
  nowSeconds?: number
}) => {
  if (!value) {
    return null
  }

  const separatorIndex = value.lastIndexOf(STATE_SEPARATOR)
  if (separatorIndex < 1) {
    return null
  }

  const encodedPayload = value.slice(0, separatorIndex)
  const signature = value.slice(separatorIndex + 1)
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

  const payload = decodePayload(encodedPayload)
  if (!payload) {
    return null
  }

  if (payload.exp < nowSeconds - MAX_CLOCK_SKEW_SECONDS) {
    return null
  }

  return payload
}
