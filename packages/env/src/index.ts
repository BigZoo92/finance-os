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
  const parsed = schema.safeParse(process.env)

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

export const getApiEnv = () =>
  parseEnv({
    API_HOST: z.string().default('0.0.0.0'),
    API_PORT: z.coerce.number().int().positive().default(3001),
    WEB_ORIGIN: z.string().default('http://127.0.0.1:3000'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    ...powensShape,
  })

export const getWorkerEnv = () =>
  parseEnv({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    WORKER_HEARTBEAT_MS: z.coerce.number().int().positive().default(30000),
    POWENS_SYNC_INTERVAL_MS: z.coerce.number().int().positive().default(12 * 60 * 60 * 1000),
    ...powensShape,
  })
