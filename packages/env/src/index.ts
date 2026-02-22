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

const encryptionKeySchema = z
  .string()
  .min(1, 'APP_ENCRYPTION_KEY is required')
  .refine(value => {
    if (Buffer.byteLength(value, 'utf8') === 32) {
      return true
    }

    if (/^[0-9a-fA-F]{64}$/.test(value)) {
      return true
    }

    try {
      const decoded = Buffer.from(value, 'base64')
      return decoded.length === 32
    } catch {
      return false
    }
  }, 'APP_ENCRYPTION_KEY must be a 32-byte value (raw, hex, or base64)')

const powensShape = {
  POWENS_CLIENT_ID: z.string().min(1, 'POWENS_CLIENT_ID is required'),
  POWENS_CLIENT_SECRET: z.string().min(1, 'POWENS_CLIENT_SECRET is required'),
  POWENS_BASE_URL: z.string().url('POWENS_BASE_URL must be a valid URL'),
  POWENS_DOMAIN: z.string().min(1, 'POWENS_DOMAIN is required'),
  POWENS_REDIRECT_URI_DEV: z.string().url('POWENS_REDIRECT_URI_DEV must be a valid URL'),
  POWENS_REDIRECT_URI_PROD: z.string().url('POWENS_REDIRECT_URI_PROD must be a valid URL').optional(),
  POWENS_WEBVIEW_BASE_URL: z.string().url().default('https://webview.powens.com/connect'),
  POWENS_WEBVIEW_URL: z.string().url().optional(),
  APP_ENCRYPTION_KEY: encryptionKeySchema,
} satisfies z.ZodRawShape

const assertProductionApiEnv = (values: {
  NODE_ENV: 'development' | 'test' | 'production'
  APP_URL?: string | undefined
  WEB_URL?: string | undefined
  WEB_ORIGIN?: string | undefined
  POWENS_REDIRECT_URI_PROD?: string | undefined
}) => {
  if (values.NODE_ENV !== 'production') {
    return
  }

  if (!values.APP_URL && !values.WEB_URL && !values.WEB_ORIGIN) {
    throw new Error(
      'Invalid environment variables:\nAPP_URL or WEB_URL (or legacy WEB_ORIGIN) is required in production'
    )
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
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    APP_URL: z.string().url('APP_URL must be a valid URL').optional(),
    WEB_URL: z.string().url('WEB_URL must be a valid URL').optional(),
    API_URL: z.string().url('API_URL must be a valid URL').optional(),
    WEB_ORIGIN: z.string().url('WEB_ORIGIN must be a valid URL').optional(),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    PRIVATE_ACCESS_TOKEN: z.string().min(12).optional(),
    DEBUG_METRICS_TOKEN: z.string().min(12).optional(),
    POWENS_MANUAL_SYNC_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
    ...powensShape,
  })

  assertProductionApiEnv(parsed)

  const webUrl = normalizeUrl(parsed.WEB_URL ?? parsed.APP_URL ?? parsed.WEB_ORIGIN ?? 'http://127.0.0.1:3000')
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
    POWENS_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(12 * 60 * 60 * 1000),
    POWENS_SYNC_MIN_INTERVAL_PROD_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(12 * 60 * 60 * 1000),
    ...powensShape,
  })
