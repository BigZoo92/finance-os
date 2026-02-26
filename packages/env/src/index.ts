import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

let rootEnvLoaded = false

const loadRootEnv = () => {
  if (rootEnvLoaded) return

  const __filename = fileURLToPath(import.meta.url)
  const __dirname = dirname(__filename)

  config({
    path: resolve(__dirname, '../../../.env'),
    override: true,
  })

  rootEnvLoaded = true
}

const parseEnv = <T extends z.ZodRawShape>(shape: T) => {
  loadRootEnv()

  const schema = z.object(shape)
  const normalizedEnv = Object.fromEntries(
    Object.entries(process.env).map(([key, value]) => [key, value === '' ? undefined : value])
  )
  const parsed = schema.safeParse(normalizedEnv)

  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(
        parsed.error.flatten().fieldErrors,
        null,
        2
      )}`
    )
  }

  return parsed.data
}

const normalizeUrl = (url: string) => url.replace(/\/+$/, '')

const toDecodedBuffer = (value: string): Buffer | null => {
  const trimmed = value.trim()

  if (/^[0-9a-fA-F]+$/.test(trimmed) && trimmed.length % 2 === 0) {
    try {
      return Buffer.from(trimmed, 'hex')
    } catch {
      return null
    }
  }

  if (/^[A-Za-z0-9+/]+={0,2}$/.test(trimmed)) {
    try {
      return Buffer.from(trimmed, 'base64')
    } catch {
      return null
    }
  }

  if (/^[A-Za-z0-9_-]+$/.test(trimmed)) {
    try {
      return Buffer.from(trimmed, 'base64url')
    } catch {
      return null
    }
  }

  return null
}

const hasExactByteLength = (value: string, bytes: number) => {
  if (Buffer.byteLength(value, 'utf8') === bytes) {
    return true
  }

  const decoded = toDecodedBuffer(value)
  return decoded?.length === bytes
}

const hasMinimumByteLength = (value: string, bytes: number) => {
  if (Buffer.byteLength(value, 'utf8') >= bytes) {
    return true
  }

  const decoded = toDecodedBuffer(value)
  return (decoded?.length ?? 0) >= bytes
}

const encryptionKeySchema = z
  .string()
  .min(1, 'APP_ENCRYPTION_KEY is required')
  .refine(
    value => hasExactByteLength(value, 32),
    'APP_ENCRYPTION_KEY must be a 32-byte value (raw, hex, base64, or base64url)'
  )

const authSessionSecretSchema = z
  .string()
  .min(1, 'AUTH_SESSION_SECRET is required')
  .refine(
    value => hasMinimumByteLength(value, 32),
    'AUTH_SESSION_SECRET must be at least 32 bytes (raw, hex, base64, or base64url)'
  )

const authPasswordHashSchema = z
  .string()
  .min(1, 'AUTH_PASSWORD_HASH is required')
  .superRefine((value, ctx) => {
    console.log('[env-debug] refine prefix:', value.slice(0, 12))
    if (!value.startsWith('$argon2')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `AUTH_PASSWORD_HASH must start with $argon2 (got prefix: ${value.slice(0, 12)})`,
      })
    }
  })

const powensShape = {
  POWENS_CLIENT_ID: z.string().min(1, 'POWENS_CLIENT_ID is required'),
  POWENS_CLIENT_SECRET: z.string().min(1, 'POWENS_CLIENT_SECRET is required'),
  POWENS_BASE_URL: z.string().url('POWENS_BASE_URL must be a valid URL'),
  POWENS_DOMAIN: z.string().min(1, 'POWENS_DOMAIN is required'),
  POWENS_REDIRECT_URI_DEV: z.string().url('POWENS_REDIRECT_URI_DEV must be a valid URL'),
  POWENS_REDIRECT_URI_PROD: z
    .string()
    .url('POWENS_REDIRECT_URI_PROD must be a valid URL')
    .optional(),
  POWENS_WEBVIEW_BASE_URL: z.string().url().default('https://webview.powens.com/connect'),
  POWENS_WEBVIEW_URL: z.string().url().optional(),
  APP_ENCRYPTION_KEY: encryptionKeySchema,
} satisfies z.ZodRawShape

const assertProductionApiEnv = (values: {
  NODE_ENV: 'development' | 'test' | 'production'
  POWENS_REDIRECT_URI_PROD?: string | undefined
}) => {
  if (values.NODE_ENV !== 'production') {
    return
  }

  if (!values.POWENS_REDIRECT_URI_PROD) {
    throw new Error(
      'Invalid environment variables:\nPOWENS_REDIRECT_URI_PROD is required in production'
    )
  }
}

export const getApiEnv = () => {
  const raw = process.env.AUTH_PASSWORD_HASH
  console.log('[env-debug] AUTH_PASSWORD_HASH exists?', raw != null)
  console.log('[env-debug] AUTH_PASSWORD_HASH type:', typeof raw)
  console.log('[env-debug] AUTH_PASSWORD_HASH prefix:', raw?.slice(0, 12))
  console.log('[env-debug] AUTH_PASSWORD_HASH length:', raw?.length)
  console.log('[env-debug] AUTH_PASSWORD_HASH hasWhitespaceEnds:', raw ? raw.trim() !== raw : null)
  const parsed = parseEnv({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url('APP_URL must be a valid URL'),
    WEB_URL: z.string().url('WEB_URL must be a valid URL').optional(),
    API_URL: z.string().url('API_URL must be a valid URL').optional(),
    WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL').optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    PRIVATE_ACCESS_TOKEN: z.string().min(12).optional(),
    DEBUG_METRICS_TOKEN: z.string().min(12).optional(),
    POWENS_MANUAL_SYNC_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
    AUTH_ADMIN_EMAIL: z.string().email('AUTH_ADMIN_EMAIL must be a valid email'),
    AUTH_PASSWORD_HASH: authPasswordHashSchema,
    AUTH_SESSION_SECRET: authSessionSecretSchema,
    AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
    ...powensShape,
  })

  assertProductionApiEnv(parsed)

  const webUrl = normalizeUrl(parsed.WEB_URL ?? parsed.WEB_ORIGIN ?? parsed.APP_URL)
  const appUrl = normalizeUrl(parsed.APP_URL ?? webUrl)
  const apiUrl = normalizeUrl(parsed.API_URL ?? `${appUrl}/api`)

  return {
    ...parsed,
    APP_URL: appUrl,
    WEB_URL: webUrl,
    API_URL: apiUrl,
    WEB_ORIGIN: webUrl,
  }
}

export const getWorkerEnv = () =>
  parseEnv({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    WORKER_HEARTBEAT_MS: z.coerce.number().int().positive().default(30000),
    POWENS_SYNC_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(12 * 60 * 60 * 1000),
    POWENS_SYNC_MIN_INTERVAL_PROD_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(12 * 60 * 60 * 1000),
    ...powensShape,
  })
