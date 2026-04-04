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

const toOptionalEnv = (value: string | undefined) => {
  if (!value) {
    return undefined
  }

  const normalized = value.trim()
  return normalized.length > 0 ? normalized : undefined
}

const toBooleanEnv = (value: string | undefined) => {
  const normalized = toOptionalEnv(value)?.toLowerCase()
  return normalized === '1' || normalized === 'true' || normalized === 'yes'
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

const AUTH_PASSWORD_HASH_PREFIX_ARGON2 = '$argon2'
const AUTH_PASSWORD_HASH_PREFIX_PBKDF2 = 'pbkdf2$'
const AUTH_PASSWORD_HASH_DEBUG_PREFIX_LENGTH = 24

type ResolvedAuthPasswordHashSource =
  | 'AUTH_ADMIN_PASSWORD_HASH'
  | 'AUTH_ADMIN_PASSWORD_HASH_B64'
  | 'AUTH_PASSWORD_HASH'
  | 'AUTH_PASSWORD_HASH_B64'

type ResolvedAuthPasswordHash = {
  hash: string
  source: ResolvedAuthPasswordHashSource
}

const isDebugLogLevel = (value: string) => value.trim().toLowerCase() === 'debug'

const base64ValuePattern = /^[A-Za-z0-9+/]+={0,2}$/

const decodeBase64Utf8Strict = (value: string): string | null => {
  const normalized = value.trim()
  if (
    normalized.length === 0 ||
    normalized.length % 4 !== 0 ||
    !base64ValuePattern.test(normalized)
  ) {
    return null
  }

  try {
    const decodedBuffer = Buffer.from(normalized, 'base64')
    const normalizedInput = normalized.replace(/=+$/, '')
    const normalizedOutput = decodedBuffer.toString('base64').replace(/=+$/, '')

    if (normalizedInput !== normalizedOutput) {
      return null
    }

    return new TextDecoder('utf-8', { fatal: true }).decode(decodedBuffer)
  } catch {
    return null
  }
}

const hasSupportedAuthPasswordHashPrefix = (value: string) => {
  return (
    value.startsWith(AUTH_PASSWORD_HASH_PREFIX_ARGON2) ||
    value.startsWith(AUTH_PASSWORD_HASH_PREFIX_PBKDF2)
  )
}

const authPasswordHashInputsSchema = z
  .object({
    AUTH_ADMIN_PASSWORD_HASH: z.string().optional(),
    AUTH_ADMIN_PASSWORD_HASH_B64: z.string().optional(),
    AUTH_PASSWORD_HASH: z.string().optional(),
    AUTH_PASSWORD_HASH_B64: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    const hashInputsByPriority: Array<{
      source: ResolvedAuthPasswordHashSource
      value: string | undefined
      encoded: boolean
    }> = [
      {
        source: 'AUTH_ADMIN_PASSWORD_HASH_B64',
        value: toOptionalEnv(values.AUTH_ADMIN_PASSWORD_HASH_B64),
        encoded: true,
      },
      {
        source: 'AUTH_ADMIN_PASSWORD_HASH',
        value: toOptionalEnv(values.AUTH_ADMIN_PASSWORD_HASH),
        encoded: false,
      },
      {
        source: 'AUTH_PASSWORD_HASH_B64',
        value: toOptionalEnv(values.AUTH_PASSWORD_HASH_B64),
        encoded: true,
      },
      {
        source: 'AUTH_PASSWORD_HASH',
        value: toOptionalEnv(values.AUTH_PASSWORD_HASH),
        encoded: false,
      },
    ]

    const selected = hashInputsByPriority.find(item => item.value)
    if (!selected || !selected.value) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['AUTH_ADMIN_PASSWORD_HASH'],
        message:
          'AUTH_ADMIN_PASSWORD_HASH_B64, AUTH_ADMIN_PASSWORD_HASH, AUTH_PASSWORD_HASH_B64 or AUTH_PASSWORD_HASH is required',
      })
      return
    }

    if (selected.encoded) {
      const decoded = decodeBase64Utf8Strict(selected.value)
      if (!decoded) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [selected.source],
          message: `${selected.source} is not valid base64`,
        })
        return
      }

      if (!hasSupportedAuthPasswordHashPrefix(decoded)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [selected.source],
          message: 'Decoded hash must start with $argon2 or pbkdf2$',
        })
      }

      return
    }

    if (!hasSupportedAuthPasswordHashPrefix(selected.value)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [selected.source],
        message: `${selected.source} must start with $argon2 or pbkdf2$ (got prefix: ${selected.value.slice(0, 18)})`,
      })
    }
  })
  .transform(values => {
    const hashInputsByPriority: Array<{
      source: ResolvedAuthPasswordHashSource
      value: string | undefined
      encoded: boolean
    }> = [
      {
        source: 'AUTH_ADMIN_PASSWORD_HASH_B64',
        value: toOptionalEnv(values.AUTH_ADMIN_PASSWORD_HASH_B64),
        encoded: true,
      },
      {
        source: 'AUTH_ADMIN_PASSWORD_HASH',
        value: toOptionalEnv(values.AUTH_ADMIN_PASSWORD_HASH),
        encoded: false,
      },
      {
        source: 'AUTH_PASSWORD_HASH_B64',
        value: toOptionalEnv(values.AUTH_PASSWORD_HASH_B64),
        encoded: true,
      },
      {
        source: 'AUTH_PASSWORD_HASH',
        value: toOptionalEnv(values.AUTH_PASSWORD_HASH),
        encoded: false,
      },
    ]

    const selected = hashInputsByPriority.find(item => item.value)
    if (!selected || !selected.value) {
      throw new Error(
        'AUTH_ADMIN_PASSWORD_HASH_B64, AUTH_ADMIN_PASSWORD_HASH, AUTH_PASSWORD_HASH_B64 or AUTH_PASSWORD_HASH is required'
      )
    }

    if (selected.encoded) {
      const decoded = decodeBase64Utf8Strict(selected.value)
      if (!decoded) {
        throw new Error(`${selected.source} is not valid base64`)
      }

      return {
        hash: decoded,
        source: selected.source,
      } as const
    }

    return {
      hash: selected.value,
      source: selected.source,
    } as const
  })

const resolveAuthPasswordHash = (values: {
  AUTH_ADMIN_PASSWORD_HASH?: string | undefined
  AUTH_ADMIN_PASSWORD_HASH_B64?: string | undefined
  AUTH_PASSWORD_HASH?: string | undefined
  AUTH_PASSWORD_HASH_B64?: string | undefined
}): ResolvedAuthPasswordHash => {
  const parsed = authPasswordHashInputsSchema.safeParse(values)
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${JSON.stringify(parsed.error.flatten().fieldErrors, null, 2)}`
    )
  }

  return parsed.data
}

const logResolvedAuthPasswordHash = ({
  logLevel,
  resolvedAuthPasswordHash,
}: {
  logLevel: string
  resolvedAuthPasswordHash: ResolvedAuthPasswordHash
}) => {
  if (!isDebugLogLevel(logLevel)) {
    return
  }

  console.info('[api:env] auth password hash resolved', {
    source: resolvedAuthPasswordHash.source,
    hashLength: resolvedAuthPasswordHash.hash.length,
    hashPrefix: resolvedAuthPasswordHash.hash.slice(0, AUTH_PASSWORD_HASH_DEBUG_PREFIX_LENGTH),
  })
}

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
  const parsed = parseEnv({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    LOG_LEVEL: z.string().default('info'),
    APP_VERSION: z.string().min(1).optional(),
    APP_COMMIT_SHA: z.string().min(1).optional(),
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
    SYNC_STATUS_PERSISTENCE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRANSACTIONS_SNAPSHOT_FIRST_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    POWENS_REFRESH_BACKGROUND_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRANSACTIONS_SNAPSHOT_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
    DERIVED_RECOMPUTE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AUTH_ADMIN_EMAIL: z.string().email('AUTH_ADMIN_EMAIL must be a valid email'),
    AUTH_ADMIN_PASSWORD_HASH: z.string().optional(),
    AUTH_ADMIN_PASSWORD_HASH_B64: z.string().optional(),
    AUTH_PASSWORD_HASH: z.string().optional(),
    AUTH_PASSWORD_HASH_B64: z.string().optional(),
    AUTH_SESSION_SECRET: authSessionSecretSchema,
    AUTH_SESSION_TTL_DAYS: z.coerce.number().int().positive().default(30),
    AUTH_LOGIN_RATE_LIMIT_PER_MIN: z.coerce.number().int().positive().default(5),
    AUTH_ALLOW_INSECURE_COOKIE_IN_PROD: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    EXTERNAL_INTEGRATIONS_SAFE_MODE: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    ...powensShape,
  })

  const resolvedAuthPasswordHash = resolveAuthPasswordHash({
    AUTH_ADMIN_PASSWORD_HASH: parsed.AUTH_ADMIN_PASSWORD_HASH,
    AUTH_ADMIN_PASSWORD_HASH_B64: parsed.AUTH_ADMIN_PASSWORD_HASH_B64,
    AUTH_PASSWORD_HASH: parsed.AUTH_PASSWORD_HASH,
    AUTH_PASSWORD_HASH_B64: parsed.AUTH_PASSWORD_HASH_B64,
  })

  logResolvedAuthPasswordHash({
    logLevel: parsed.LOG_LEVEL,
    resolvedAuthPasswordHash,
  })

  assertProductionApiEnv(parsed)

  const webUrl = normalizeUrl(parsed.WEB_URL ?? parsed.WEB_ORIGIN ?? parsed.APP_URL)
  const appUrl = normalizeUrl(parsed.APP_URL ?? webUrl)
  const apiUrl = normalizeUrl(parsed.API_URL ?? `${appUrl}/api`)

  const {
    AUTH_ADMIN_PASSWORD_HASH: _authAdminPasswordHash,
    AUTH_ADMIN_PASSWORD_HASH_B64: _authAdminPasswordHashB64,
    AUTH_PASSWORD_HASH: _authPasswordHash,
    AUTH_PASSWORD_HASH_B64: _authPasswordHashB64,
    ...remainingParsed
  } = parsed

  return {
    ...remainingParsed,
    AUTH_PASSWORD_HASH: resolvedAuthPasswordHash.hash,
    AUTH_PASSWORD_HASH_SOURCE: resolvedAuthPasswordHash.source,
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
    WORKER_AUTO_SYNC_ENABLED: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    SYNC_STATUS_PERSISTENCE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    EXTERNAL_INTEGRATIONS_SAFE_MODE: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    ...powensShape,
  })
