import { pbkdf2Sync, timingSafeEqual } from 'node:crypto'

export type PasswordVerifyFn = (password: string, hash: string) => Promise<boolean>

const ARGON2_PREFIX = '$argon2'
const PBKDF2_PREFIX = 'pbkdf2$'
const PBKDF2_MIN_ITERATIONS = 120_000
const PBKDF2_MIN_KEY_LENGTH = 32

const defaultVerifyPassword: PasswordVerifyFn = async (password, hash) => {
  if (hash.startsWith(ARGON2_PREFIX)) {
    return Bun.password.verify(password, hash)
  }

  if (hash.startsWith(PBKDF2_PREFIX)) {
    return verifyPbkdf2Hash(password, hash)
  }

  throw new Error('Unsupported password hash format')
}

const parsePositiveInteger = (value: string) => {
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null
  }

  return parsed
}

const decodeBase64Url = (value: string) => {
  try {
    return Buffer.from(value, 'base64url')
  } catch {
    return null
  }
}

const verifyPbkdf2Hash = (password: string, hash: string) => {
  const parts = hash.split('$')
  if (parts.length !== 5) {
    throw new Error('Invalid PBKDF2 hash format')
  }

  const algorithm = parts[1] ?? ''
  const iterationsRaw = parts[2] ?? ''
  const saltRaw = parts[3] ?? ''
  const derivedKeyRaw = parts[4] ?? ''
  if (algorithm !== 'sha256' && algorithm !== 'sha512') {
    throw new Error(`Unsupported PBKDF2 algorithm: ${algorithm}`)
  }

  const iterations = parsePositiveInteger(iterationsRaw)
  if (!iterations || iterations < PBKDF2_MIN_ITERATIONS) {
    throw new Error('PBKDF2 iterations are too low')
  }

  const salt = decodeBase64Url(saltRaw)
  const expectedDerivedKey = decodeBase64Url(derivedKeyRaw)
  if (!salt || !expectedDerivedKey || expectedDerivedKey.length < PBKDF2_MIN_KEY_LENGTH) {
    throw new Error('Invalid PBKDF2 salt or key')
  }

  const derivedKey = pbkdf2Sync(password, salt, iterations, expectedDerivedKey.length, algorithm)
  if (derivedKey.length !== expectedDerivedKey.length) {
    return false
  }

  return timingSafeEqual(derivedKey, expectedDerivedKey)
}

export const normalizeEmail = (value: string) => value.trim().toLowerCase()

export const verifyPasswordHash = async ({
  password,
  passwordHash,
  verifyPassword = defaultVerifyPassword,
}: {
  password: string
  passwordHash: string
  verifyPassword?: PasswordVerifyFn
}) => {
  try {
    return await verifyPassword(password, passwordHash)
  } catch (error) {
    throw new Error(
      `Password verification failed: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
