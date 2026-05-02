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

const toFailsoftSourceOrderEnv = (value: string | undefined) => {
  const defaultOrder: Array<'live' | 'cache' | 'demo'> = ['live', 'cache', 'demo']
  const normalized = toOptionalEnv(value)
  if (!normalized) {
    return defaultOrder
  }

  const parsed = normalized
    .split(',')
    .map(entry => entry.trim().toLowerCase())
    .filter(
      (entry): entry is 'live' | 'cache' | 'demo' =>
        entry === 'live' || entry === 'cache' || entry === 'demo'
    )

  return parsed.length > 0 ? Array.from(new Set(parsed)) : defaultOrder
}

const toStringArrayEnv = (value: string | undefined, fallback: string[] = []) => {
  const normalized = toOptionalEnv(value)
  if (!normalized) {
    return fallback
  }

  const parsed = normalized
    .split(',')
    .map(entry => entry.trim())
    .filter(Boolean)

  return parsed.length > 0 ? parsed : fallback
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

const externalInvestmentsShape = {
  EXTERNAL_INVESTMENTS_ENABLED: z
    .string()
    .optional()
    .transform(value => (value === undefined ? true : toBooleanEnv(value))),
  EXTERNAL_INVESTMENTS_SAFE_MODE: z
    .string()
    .optional()
    .transform(value => (value === undefined ? false : toBooleanEnv(value))),
  EXTERNAL_INVESTMENTS_SYNC_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(300),
  EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES: z.coerce
    .number()
    .int()
    .positive()
    .default(24 * 60),
  IBKR_FLEX_ENABLED: z
    .string()
    .optional()
    .transform(value => (value === undefined ? true : toBooleanEnv(value))),
  IBKR_FLEX_BASE_URL: z
    .string()
    .url('IBKR_FLEX_BASE_URL must be a valid URL')
    .default('https://ndcdyn.interactivebrokers.com'),
  IBKR_FLEX_USER_AGENT: z
    .string()
    .min(1, 'IBKR_FLEX_USER_AGENT is required')
    .default('Finance-OS External Investments/1.0'),
  IBKR_FLEX_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  BINANCE_SPOT_ENABLED: z
    .string()
    .optional()
    .transform(value => (value === undefined ? true : toBooleanEnv(value))),
  BINANCE_SPOT_BASE_URL: z
    .string()
    .url('BINANCE_SPOT_BASE_URL must be a valid URL')
    .default('https://api.binance.com'),
  BINANCE_SPOT_RECV_WINDOW_MS: z.coerce.number().int().positive().default(5000),
  BINANCE_SPOT_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
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
    POWENS_DIAGNOSTICS_ENABLED: z
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
    DEMO_DATASET_STRATEGY: z.enum(['legacy', 'minimal', 'v1']).optional().default('v1'),
    DEMO_PERSONA_MATCHING_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRANSACTIONS_SNAPSHOT_STALE_AFTER_MINUTES: z.coerce.number().int().positive().default(30),
    TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT: z.coerce.number().int().min(0).max(100).default(0),
    TRANSACTIONS_CATEGORIZATION_ALERT_DISAGREEMENT_RATE: z.coerce
      .number()
      .min(0)
      .max(1)
      .default(0.08),
    TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(150),
    DERIVED_RECOMPUTE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    LIVE_NEWS_INGESTION_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_AI_CONTEXT_BUNDLE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_MAX_PROVIDER_ITEMS_PER_RUN: z.coerce.number().int().positive().default(20),
    NEWS_METADATA_FETCH_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_METADATA_FETCH_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    NEWS_METADATA_FETCH_MAX_BYTES: z.coerce.number().int().positive().default(131072),
    NEWS_SCRAPER_USER_AGENT: z.string().min(1).optional(),
    SEC_USER_AGENT: z.string().min(1).optional(),
    NEWS_PROVIDER_HN_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_PROVIDER_HN_QUERY: z.string().default('finance OR markets OR inflation OR AI'),
    NEWS_PROVIDER_GDELT_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_PROVIDER_GDELT_QUERY: z
      .string()
      .default(
        '(finance OR inflation OR rates OR sanctions OR cybersecurity OR "artificial intelligence")'
      ),
    NEWS_PROVIDER_ECB_RSS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_PROVIDER_ECB_RSS_FEED_URLS: z
      .string()
      .optional()
      .transform(value =>
        toStringArrayEnv(value, [
          'https://www.ecb.europa.eu/rss/press.html',
          'https://www.ecb.europa.eu/rss/statpress.html',
          'https://www.ecb.europa.eu/rss/pub.html',
          'https://www.ecb.europa.eu/rss/blog.html',
        ])
      ),
    NEWS_PROVIDER_ECB_DATA_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    NEWS_PROVIDER_ECB_DATA_SERIES_KEYS: z
      .string()
      .optional()
      .transform(value => toStringArrayEnv(value, ['EXR/D.USD.EUR.SP00.A'])),
    NEWS_PROVIDER_FED_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_PROVIDER_FED_FEED_URLS: z
      .string()
      .optional()
      .transform(value =>
        toStringArrayEnv(value, [
          'https://www.federalreserve.gov/feeds/press_monetary.xml',
          'https://www.federalreserve.gov/feeds/press_all.xml',
          'https://www.federalreserve.gov/feeds/speeches_and_testimony.xml',
        ])
      ),
    NEWS_PROVIDER_SEC_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_PROVIDER_SEC_TICKERS: z
      .string()
      .optional()
      .transform(value =>
        toStringArrayEnv(value, ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA'])
      ),
    NEWS_PROVIDER_FRED_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    NEWS_PROVIDER_FRED_SERIES_IDS: z
      .string()
      .optional()
      .transform(value => toStringArrayEnv(value, ['FEDFUNDS', 'CPIAUCSL', 'UNRATE', 'DGS10'])),
    NEWS_PROVIDER_X_TWITTER_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    NEWS_PROVIDER_X_TWITTER_QUERY: z
      .string()
      .default(
        '(inflation OR rates OR guidance OR earnings OR sanctions OR cyber OR "artificial intelligence") lang:en -is:retweet'
      ),
    NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: z.string().min(1).optional(),
    BLUESKY_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    BLUESKY_HANDLE: z.string().optional(),
    BLUESKY_APP_PASSWORD: z.string().min(1).optional(),
    BLUESKY_SERVICE_URL: z.string().default('https://bsky.social'),
    SIGNALS_SOCIAL_POLLING_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    SIGNALS_SOCIAL_POLLING_INTERVAL_MS: z
      .string()
      .optional()
      .transform(value => Number(value ?? 3600000)),
    SIGNALS_MANUAL_IMPORT_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    FRED_API_KEY: z.string().min(1).optional(),
    MARKET_DATA_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_REFRESH_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_FAILSOFT_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_EODHD_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_TWELVEDATA_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_FRED_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_US_FRESH_OVERLAY_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    MARKET_DATA_FORCE_FIXTURE_FALLBACK: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    MARKET_DATA_STALE_AFTER_MINUTES: z.coerce
      .number()
      .int()
      .positive()
      .default(16 * 60),
    MARKET_DATA_REFRESH_COOLDOWN_SECONDS: z.coerce.number().int().positive().default(900),
    MARKET_DATA_DEFAULT_WATCHLIST_IDS: z
      .string()
      .optional()
      .transform(value =>
        toStringArrayEnv(value, [
          'spy-us',
          'qqq-us',
          'vgk-us',
          'ewj-us',
          'iemg-us',
          'cw8-pa',
          'meud-pa',
          'aeem-pa',
          'mjp-pa',
          'air-pa',
          'mc-pa',
          'ief-us',
          'gld-us',
          'eza-us',
        ])
      ),
    MARKET_DATA_FRED_SERIES_IDS: z
      .string()
      .optional()
      .transform(value =>
        toStringArrayEnv(value, [
          'FEDFUNDS',
          'SOFR',
          'DGS2',
          'DGS10',
          'T10Y2Y',
          'CPIAUCSL',
          'UNRATE',
        ])
      ),
    EODHD_API_KEY: z.string().min(1).optional(),
    TWELVEDATA_API_KEY: z.string().min(1).optional(),
    FAILSOFT_POLICY_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    FAILSOFT_SOURCE_ORDER: z
      .string()
      .optional()
      .transform(value => toFailsoftSourceOrderEnv(value)),
    FAILSOFT_ALERTS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    FAILSOFT_NEWS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    FAILSOFT_INSIGHTS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_ADVISOR_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_ADVISOR_ADMIN_ONLY: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    AI_ADVISOR_FORCE_LOCAL_ONLY: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    ADVISOR_X_SIGNALS_MODE: z.enum(['off', 'shadow', 'enforced']).default('shadow'),
    AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_SERVICE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    KNOWLEDGE_SERVICE_URL: z
      .string()
      .url('KNOWLEDGE_SERVICE_URL must be a valid URL')
      .default('http://127.0.0.1:8011'),
    KNOWLEDGE_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(2500),
    KNOWLEDGE_GRAPH_BACKEND: z.enum(['local', 'neo4j', 'memgraph', 'falkordb']).default('local'),
    KNOWLEDGE_GRAPH_STORAGE_PATH: z.string().min(1).default('./.knowledge/graph'),
    KNOWLEDGE_GRAPH_REBUILD_ON_START: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_MAX_CONTEXT_TOKENS: z.coerce.number().int().positive().default(1800),
    KNOWLEDGE_GRAPH_VECTOR_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_FULLTEXT_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_TEMPORAL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_DEMO_FIXTURES_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_RETRIEVAL_MODE: z
      .enum(['hybrid', 'graph', 'vector', 'fulltext'])
      .default('hybrid'),
    KNOWLEDGE_GRAPH_RERANKING_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    KNOWLEDGE_GRAPH_MAX_PATH_DEPTH: z.coerce.number().int().min(0).max(5).default(3),
    KNOWLEDGE_GRAPH_MIN_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.35),

    // ── Quant Service / Trading Lab ─────────────────────────────
    QUANT_SERVICE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    QUANT_SERVICE_URL: z
      .string()
      .url('QUANT_SERVICE_URL must be a valid URL')
      .default('http://127.0.0.1:8012'),
    QUANT_SERVICE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
    TRADING_LAB_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRADING_LAB_PAPER_ONLY: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    TRADING_LAB_MAX_BACKTEST_ROWS: z.coerce.number().int().positive().default(50000),
    TRADING_LAB_DEFAULT_FEES_BPS: z.coerce.number().min(0).default(10),
    TRADING_LAB_DEFAULT_SLIPPAGE_BPS: z.coerce.number().min(0).default(5),
    TRADING_LAB_GRAPH_INGEST_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    ATTENTION_SYSTEM_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    ATTENTION_SIGNAL_MIN_RELEVANCE: z.coerce.number().int().min(0).default(60),
    ATTENTION_SIGNAL_MIN_CONFIDENCE: z.coerce.number().int().min(0).default(50),
    KNOWLEDGE_GRAPH_RECENCY_HALF_LIFE_DAYS: z.coerce.number().positive().default(45),
    KNOWLEDGE_GRAPH_EMBEDDING_PROVIDER: z.enum(['local', 'openai', 'none']).default('local'),
    KNOWLEDGE_GRAPH_EMBEDDING_MODEL: z.string().min(1).default('local-hashing-v1'),
    NEO4J_URI: z.string().url('NEO4J_URI must be a valid URL').optional(),
    NEO4J_USERNAME: z.string().min(1).optional(),
    NEO4J_PASSWORD: z.string().min(1).optional(),
    QDRANT_URL: z.string().url('QDRANT_URL must be a valid URL').optional(),
    QDRANT_API_KEY: z.string().min(1).optional(),
    AI_CHAT_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_CHALLENGER_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_RELABEL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_OPENAI_API_KEY: z.string().min(1).optional(),
    AI_OPENAI_BASE_URL: z.string().url('AI_OPENAI_BASE_URL must be a valid URL').optional(),
    AI_OPENAI_CLASSIFIER_MODEL: z.string().default('gpt-5.4-nano'),
    AI_OPENAI_DAILY_MODEL: z.string().default('gpt-5.4-mini'),
    AI_OPENAI_DEEP_MODEL: z.string().default('gpt-5.4'),
    AI_ANTHROPIC_API_KEY: z.string().min(1).optional(),
    AI_ANTHROPIC_BASE_URL: z.string().url('AI_ANTHROPIC_BASE_URL must be a valid URL').optional(),
    AI_ANTHROPIC_CHALLENGER_MODEL: z.string().default('claude-sonnet-4-6'),
    AI_USD_TO_EUR_RATE: z.coerce.number().positive().default(0.92),
    AI_BUDGET_DAILY_USD: z.coerce.number().nonnegative().default(2),
    AI_BUDGET_MONTHLY_USD: z.coerce.number().nonnegative().default(40),
    AI_BUDGET_DISABLE_CHALLENGER_RATIO: z.coerce.number().min(0).max(1).default(0.75),
    AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO: z.coerce.number().min(0).max(1).default(0.5),
    AI_SPEND_ALERT_DAILY_THRESHOLD_PCT: z.coerce.number().min(0).max(1).default(0.8),
    AI_SPEND_ALERT_MONTHLY_THRESHOLD_PCT: z.coerce.number().min(0).max(1).default(0.8),
    AI_MAX_CHAT_MESSAGES_CONTEXT: z.coerce.number().int().min(1).max(20).default(8),
    ENRICHMENT_BULK_TRIAGE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    PWA_NOTIFICATIONS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    PWA_CRITICAL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    PUSH_DELIVERY_PROVIDER_URL: z
      .string()
      .url('PUSH_DELIVERY_PROVIDER_URL must be a valid URL')
      .optional(),
    PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
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
    ...externalInvestmentsShape,
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
  const defaultNewsUserAgent = `finance-os-news/1.0 (+${appUrl})`

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
    NEWS_SCRAPER_USER_AGENT: parsed.NEWS_SCRAPER_USER_AGENT ?? defaultNewsUserAgent,
    SEC_USER_AGENT: parsed.SEC_USER_AGENT ?? parsed.NEWS_SCRAPER_USER_AGENT ?? defaultNewsUserAgent,
  }
}

export const getWorkerEnv = () =>
  parseEnv({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
    REDIS_URL: z.string().min(1, 'REDIS_URL is required'),
    API_INTERNAL_URL: z.string().url('API_INTERNAL_URL must be a valid URL'),
    PRIVATE_ACCESS_TOKEN: z.string().min(12).optional(),
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
    POWENS_SYNC_INCREMENTAL_LOOKBACK_DAYS: z.coerce.number().int().min(1).max(30).default(7),
    POWENS_FORCE_FULL_SYNC: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    POWENS_SYNC_DISABLED_PROVIDERS: z
      .string()
      .optional()
      .transform(value =>
        value
          ? value
              .split(',')
              .map(item => item.trim())
              .filter(Boolean)
          : []
      ),
    WORKER_AUTO_SYNC_ENABLED: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    NEWS_AUTO_INGEST_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    NEWS_FETCH_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(4 * 60 * 60 * 1000),
    SIGNALS_SOCIAL_POLLING_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    SIGNALS_SOCIAL_POLLING_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(60 * 60 * 1000),
    AI_DAILY_AUTO_RUN_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    AI_DAILY_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60 * 1000),
    ATTENTION_SYSTEM_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    ATTENTION_REBUILD_AUTO_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    ATTENTION_REBUILD_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(10 * 60 * 1000),
    AI_DAILY_MARKET_OPEN_WINDOW_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_DAILY_MARKET_OPEN_TIMEZONE: z.string().default('America/New_York'),
    AI_DAILY_MARKET_OPEN_HOUR: z.coerce.number().int().min(0).max(23).default(9),
    AI_DAILY_MARKET_OPEN_MINUTE: z.coerce.number().int().min(0).max(59).default(30),
    AI_DAILY_MARKET_OPEN_LEAD_MINUTES: z.coerce.number().int().min(0).max(240).default(45),
    AI_DAILY_MARKET_OPEN_LAG_MINUTES: z.coerce.number().int().min(0).max(240).default(90),
    MARKET_DATA_AUTO_REFRESH_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    MARKET_DATA_REFRESH_INTERVAL_MS: z.coerce
      .number()
      .int()
      .positive()
      .default(6 * 60 * 60 * 1000),
    SYNC_STATUS_PERSISTENCE_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    POWENS_DIAGNOSTICS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    EXTERNAL_INTEGRATIONS_SAFE_MODE: z
      .string()
      .optional()
      .transform(value => toBooleanEnv(value)),
    ...externalInvestmentsShape,
    PWA_NOTIFICATIONS_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    PWA_CRITICAL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    PUSH_DELIVERY_PROVIDER_URL: z
      .string()
      .url('PUSH_DELIVERY_PROVIDER_URL must be a valid URL')
      .optional(),
    PUSH_VAPID_PUBLIC_KEY: z.string().min(1).optional(),
    PUSH_VAPID_PRIVATE_KEY: z.string().min(1).optional(),
    AI_ADVISOR_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    AI_ADVISOR_FORCE_LOCAL_ONLY: z
      .string()
      .optional()
      .transform(value => (value === undefined ? false : toBooleanEnv(value))),
    ADVISOR_X_SIGNALS_MODE: z.enum(['off', 'shadow', 'enforced']).default('shadow'),
    AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED: z
      .string()
      .optional()
      .transform(value => (value === undefined ? true : toBooleanEnv(value))),
    ...powensShape,
  })
