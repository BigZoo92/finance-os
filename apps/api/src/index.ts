import { randomUUID } from 'node:crypto'
import { cors } from '@elysiajs/cors'
import { createDbClient } from '@finance-os/db'
import { resolveRuntimeVersion } from '@finance-os/prelude'
import { createInMemoryRedisClient, createRedisClient } from '@finance-os/redis'
import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from './auth/context'
import { deriveAuth } from './auth/derive'
import {
  isDemoModeForbiddenError,
  isInternalTokenRequiredError,
  isInternalTokenValid,
  readInternalTokenFromRequest,
} from './auth/guard'
import {
  createAllowedBrowserOrigins,
  isSameOriginMutationRequest,
  isUnsafeHttpMethod,
} from './auth/origin'
import { createAuthRoutes } from './auth/routes'
import { env } from './env'
import { isApiDebugEnabled, logApiEvent, toErrorLogFields } from './observability/logger'
import { createDashboardRoutes } from './routes/dashboard/router'
import { createDebugRoutes } from './routes/debug/router'
import { createEnrichmentRoutes } from './routes/enrichment/router'
import { createExternalInvestmentsRoutes } from './routes/integrations/external-investments/router'
import { createPowensRoutes } from './routes/integrations/powens/router'
import { createNotificationsRoutes } from './routes/notifications/router'
import { registerSystemRoutes } from './routes/system'
import { applyApiSecurityHeaders, createApiSecurityHeaders } from './security/http-headers'

const { db, sql, close } = createDbClient(env.DATABASE_URL)
const redisClient = env.API_ALLOW_IN_MEMORY_REDIS
  ? createInMemoryRedisClient()
  : createRedisClient(env.REDIS_URL)

if (env.API_ALLOW_IN_MEMORY_REDIS) {
  logApiEvent({
    level: 'warn',
    msg: 'api using in-memory redis adapter',
    nodeEnv: env.NODE_ENV,
  })
}

const withApiCompatibilityPaths = (paths: string[]) => {
  const expanded = new Set<string>()

  for (const path of paths) {
    expanded.add(path)
    expanded.add(`/api${path}`)
  }

  return expanded
}

const ALWAYS_PUBLIC_PATHS = withApiCompatibilityPaths(['/health', '/db/health'])
const DEV_AUTH_PUBLIC_PATHS = withApiCompatibilityPaths(['/auth/login', '/auth/logout', '/auth/me'])
const DEV_DEBUG_PUBLIC_PATHS = withApiCompatibilityPaths(['/debug/auth'])
const INTERNAL_TOKEN_PROTECTED_PATHS = withApiCompatibilityPaths([
  '/debug/metrics',
  '/debug/health',
  '/debug/auth',
  '/debug/config',
  '/__routes',
])

const NO_STORE_EXACT_PATHS = new Set([
  '/auth/login',
  '/auth/logout',
  '/auth/me',
  '/dashboard/derived-recompute',
  '/integrations/powens/callback',
  '/debug/health',
  '/debug/auth',
  '/debug/metrics',
  '/debug/config',
  '/__routes',
  '/debug/routes',
  '/version',
])

const NO_STORE_PREFIX_PATHS = [
  '/auth/',
  '/integrations/powens/',
  '/integrations/external-investments/',
  '/enrichment/',
  '/debug/',
]

const normalizeCompatibilityPath = (pathname: string) => {
  if (pathname === '/api') {
    return '/'
  }

  if (pathname.startsWith('/api/')) {
    return pathname.slice(4)
  }

  return pathname
}

const shouldSetNoStore = (pathname: string) => {
  const normalizedPath = normalizeCompatibilityPath(pathname)
  if (NO_STORE_EXACT_PATHS.has(normalizedPath)) {
    return true
  }

  return NO_STORE_PREFIX_PATHS.some(prefix => normalizedPath.startsWith(prefix))
}

const getRuntimeVersion = () =>
  resolveRuntimeVersion({
    service: 'api',
    nodeEnv: env.NODE_ENV,
    gitSha: process.env.GIT_SHA,
    gitTag: process.env.GIT_TAG,
    buildTime: process.env.BUILD_TIME,
    appCommitSha: env.APP_COMMIT_SHA,
    appVersion: env.APP_VERSION,
  })

const shouldBypassPrivateAccessGate = ({
  pathname,
  nodeEnv,
}: {
  pathname: string
  nodeEnv: string
}) => {
  if (ALWAYS_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (nodeEnv !== 'production' && DEV_AUTH_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  if (nodeEnv !== 'production' && DEV_DEBUG_PUBLIC_PATHS.has(pathname)) {
    return true
  }

  return !INTERNAL_TOKEN_PROTECTED_PATHS.has(pathname)
}

const resolveRequestId = (request: Request) => {
  const provided = request.headers.get('x-request-id')?.trim()
  return provided && provided.length > 0 ? provided : randomUUID()
}

const canAccessRoutesDebug = (request: Request) => {
  if (env.NODE_ENV !== 'production') {
    return true
  }

  const debugTokenHeader = request.headers.get('x-finance-os-debug-token')?.trim()
  if (env.DEBUG_METRICS_TOKEN && debugTokenHeader === env.DEBUG_METRICS_TOKEN) {
    return true
  }

  const { token } = readInternalTokenFromRequest(request)
  return isInternalTokenValid({
    providedToken: token,
    env,
  })
}

const listRegisteredRoutes = (app: { routes?: unknown[] }) => {
  const routes = app.routes
  if (!Array.isArray(routes)) {
    return []
  }

  const seen = new Set<string>()
  const normalized = routes
    .map(route => {
      const candidate = route as { method?: unknown; path?: unknown }
      const methodValue = candidate.method
      const method =
        typeof methodValue === 'string'
          ? methodValue.toUpperCase()
          : Array.isArray(methodValue)
            ? methodValue.map(value => String(value).toUpperCase()).join(',')
            : 'UNKNOWN'
      const path = typeof candidate.path === 'string' ? candidate.path : '/'
      const key = `${method} ${path}`

      if (seen.has(key)) {
        return null
      }

      seen.add(key)
      return { method, path }
    })
    .filter((route): route is { method: string; path: string } => route !== null)

  return normalized.sort((a, b) => {
    if (a.path === b.path) {
      return a.method.localeCompare(b.method)
    }

    return a.path.localeCompare(b.path)
  })
}

type RouteSignature = {
  method: 'GET' | 'POST'
  path: string
}

const REQUIRED_PRODUCTION_ROUTE_SIGNATURES: RouteSignature[] = [
  { method: 'GET', path: '/health' },
  { method: 'GET', path: '/api/health' },
  { method: 'GET', path: '/version' },
  { method: 'GET', path: '/api/version' },
  { method: 'GET', path: '/auth/me' },
  { method: 'GET', path: '/api/auth/me' },
  { method: 'GET', path: '/notifications/push/settings' },
  { method: 'GET', path: '/api/notifications/push/settings' },
  { method: 'POST', path: '/integrations/powens/callback' },
  { method: 'POST', path: '/api/integrations/powens/callback' },
]

const hasRouteSignature = ({
  routes,
  signature,
}: {
  routes: Array<{ method: string; path: string }>
  signature: RouteSignature
}) => {
  return routes.some(route => {
    if (route.path !== signature.path) {
      return false
    }

    const methods = route.method
      .split(',')
      .map(value => value.trim().toUpperCase())
      .filter(value => value.length > 0)

    return methods.includes(signature.method)
  })
}

const assertRequiredProductionRoutes = ({
  routes,
}: {
  routes: Array<{ method: string; path: string }>
}) => {
  const missing = REQUIRED_PRODUCTION_ROUTE_SIGNATURES.filter(
    signature => !hasRouteSignature({ routes, signature })
  )

  if (missing.length === 0) {
    return
  }

  const missingRoutes = missing.map(signature => `${signature.method} ${signature.path}`)
  logApiEvent({
    level: 'error',
    msg: 'api startup missing required routes',
    missingRoutes,
  })

  throw new Error(`Missing required API routes: ${missingRoutes.join(', ')}`)
}

const registerAppRoutes = (app: Elysia) => {
  const withFeatureRoutes = app
    .use(
      createAuthRoutes({
        env,
        redisClient: redisClient.client,
      })
    )
    .use(
      createDashboardRoutes({
        db,
        redisClient: redisClient.client,
        featureEnabled: env.DERIVED_RECOMPUTE_ENABLED,
        liveNewsIngestionEnabled: env.LIVE_NEWS_INGESTION_ENABLED,
        transactionsSnapshotStaleAfterMinutes: env.TRANSACTIONS_SNAPSHOT_STALE_AFTER_MINUTES,
        transactionsCategorizationMigrationEnabled:
          env.TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED,
        transactionsCategorizationRolloutPercent: env.TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT,
        transactionsCategorizationDisagreementAlertRate:
          env.TRANSACTIONS_CATEGORIZATION_ALERT_DISAGREEMENT_RATE,
        transactionsCategorizationShadowLatencyBudgetMs:
          env.TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS,
        failsoftPolicyEnabled: env.FAILSOFT_POLICY_ENABLED,
        failsoftSourceOrder: env.FAILSOFT_SOURCE_ORDER,
        failsoftNewsEnabled: env.FAILSOFT_NEWS_ENABLED,
        aiContextBundleEnabled: env.NEWS_AI_CONTEXT_BUNDLE_ENABLED,
        maxNewsItemsPerProvider: env.NEWS_MAX_PROVIDER_ITEMS_PER_RUN,
        metadataFetchEnabled: env.NEWS_METADATA_FETCH_ENABLED,
        metadataFetchTimeoutMs: env.NEWS_METADATA_FETCH_TIMEOUT_MS,
        metadataFetchMaxBytes: env.NEWS_METADATA_FETCH_MAX_BYTES,
        metadataFetchUserAgent: env.NEWS_SCRAPER_USER_AGENT,
        newsProviderHnEnabled: env.NEWS_PROVIDER_HN_ENABLED,
        newsProviderHnQuery: env.NEWS_PROVIDER_HN_QUERY,
        newsProviderGdeltEnabled: env.NEWS_PROVIDER_GDELT_ENABLED,
        newsProviderGdeltQuery: env.NEWS_PROVIDER_GDELT_QUERY,
        newsProviderEcbRssEnabled: env.NEWS_PROVIDER_ECB_RSS_ENABLED,
        newsProviderEcbRssFeedUrls: env.NEWS_PROVIDER_ECB_RSS_FEED_URLS,
        newsProviderEcbDataEnabled: env.NEWS_PROVIDER_ECB_DATA_ENABLED,
        newsProviderEcbDataSeriesKeys: env.NEWS_PROVIDER_ECB_DATA_SERIES_KEYS,
        newsProviderFedEnabled: env.NEWS_PROVIDER_FED_ENABLED,
        newsProviderFedFeedUrls: env.NEWS_PROVIDER_FED_FEED_URLS,
        newsProviderSecEnabled: env.NEWS_PROVIDER_SEC_ENABLED,
        newsProviderSecUserAgent: env.SEC_USER_AGENT,
        newsProviderSecTickers: env.NEWS_PROVIDER_SEC_TICKERS,
        newsProviderFredEnabled: env.NEWS_PROVIDER_FRED_ENABLED,
        newsProviderFredApiKey: env.FRED_API_KEY,
        newsProviderFredSeriesIds: env.NEWS_PROVIDER_FRED_SERIES_IDS,
        newsProviderXTwitterEnabled: env.NEWS_PROVIDER_X_TWITTER_ENABLED,
        newsProviderXTwitterQuery: env.NEWS_PROVIDER_X_TWITTER_QUERY,
        newsProviderXTwitterBearerToken: env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN,
        marketDataEnabled: env.MARKET_DATA_ENABLED,
        marketDataRefreshEnabled: env.MARKET_DATA_REFRESH_ENABLED,
        marketDataForceFixtureFallback: env.MARKET_DATA_FORCE_FIXTURE_FALLBACK,
        marketDataStaleAfterMinutes: env.MARKET_DATA_STALE_AFTER_MINUTES,
        marketDataEodhdEnabled: env.MARKET_DATA_EODHD_ENABLED,
        marketDataTwelveDataEnabled: env.MARKET_DATA_TWELVEDATA_ENABLED,
        marketDataFredEnabled: env.MARKET_DATA_FRED_ENABLED,
        marketDataUsFreshOverlayEnabled: env.MARKET_DATA_US_FRESH_OVERLAY_ENABLED,
        marketDataDefaultWatchlistIds: env.MARKET_DATA_DEFAULT_WATCHLIST_IDS,
        marketDataFredSeriesIds: env.MARKET_DATA_FRED_SERIES_IDS,
        eodhdApiKey: env.EODHD_API_KEY,
        twelveDataApiKey: env.TWELVEDATA_API_KEY,
        aiAdvisorEnabled: env.AI_ADVISOR_ENABLED,
        aiAdvisorAdminOnly: env.AI_ADVISOR_ADMIN_ONLY,
        aiAdvisorForceLocalOnly: env.AI_ADVISOR_FORCE_LOCAL_ONLY,
        aiKnowledgeQaRetrievalEnabled: env.AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED,
        aiChatEnabled: env.AI_CHAT_ENABLED,
        aiChallengerEnabled: env.AI_CHALLENGER_ENABLED,
        aiRelabelEnabled: env.AI_RELABEL_ENABLED,
        aiOpenAiApiKey: env.AI_OPENAI_API_KEY,
        aiOpenAiBaseUrl: env.AI_OPENAI_BASE_URL,
        aiOpenAiClassifierModel: env.AI_OPENAI_CLASSIFIER_MODEL,
        aiOpenAiDailyModel: env.AI_OPENAI_DAILY_MODEL,
        aiOpenAiDeepModel: env.AI_OPENAI_DEEP_MODEL,
        aiAnthropicApiKey: env.AI_ANTHROPIC_API_KEY,
        aiAnthropicBaseUrl: env.AI_ANTHROPIC_BASE_URL,
        aiAnthropicChallengerModel: env.AI_ANTHROPIC_CHALLENGER_MODEL,
        aiBudgetDailyUsd: env.AI_BUDGET_DAILY_USD,
        aiBudgetMonthlyUsd: env.AI_BUDGET_MONTHLY_USD,
        aiBudgetDisableChallengerRatio: env.AI_BUDGET_DISABLE_CHALLENGER_RATIO,
        aiBudgetDisableDeepAnalysisRatio: env.AI_BUDGET_DISABLE_DEEP_ANALYSIS_RATIO,
        aiMaxChatMessagesContext: env.AI_MAX_CHAT_MESSAGES_CONTEXT,
        aiUsdToEurRate: env.AI_USD_TO_EUR_RATE,
        advisorXSignalsMode: env.ADVISOR_X_SIGNALS_MODE,
        knowledgeServiceEnabled: env.KNOWLEDGE_SERVICE_ENABLED,
        knowledgeServiceUrl: env.KNOWLEDGE_SERVICE_URL,
        knowledgeServiceTimeoutMs: env.KNOWLEDGE_SERVICE_TIMEOUT_MS,
        knowledgeGraphMaxContextTokens: env.KNOWLEDGE_GRAPH_MAX_CONTEXT_TOKENS,
        knowledgeGraphRetrievalMode: env.KNOWLEDGE_GRAPH_RETRIEVAL_MODE,
        knowledgeGraphMaxPathDepth: env.KNOWLEDGE_GRAPH_MAX_PATH_DEPTH,
        knowledgeGraphMinConfidence: env.KNOWLEDGE_GRAPH_MIN_CONFIDENCE,
        quantServiceEnabled: env.QUANT_SERVICE_ENABLED,
        quantServiceUrl: env.QUANT_SERVICE_URL,
        quantServiceTimeoutMs: env.QUANT_SERVICE_TIMEOUT_MS,
        tradingLabGraphIngestEnabled: env.TRADING_LAB_GRAPH_INGEST_ENABLED,
        externalInvestmentsEnabled: env.EXTERNAL_INVESTMENTS_ENABLED,
        externalInvestmentsSafeMode:
          env.EXTERNAL_INTEGRATIONS_SAFE_MODE || env.EXTERNAL_INVESTMENTS_SAFE_MODE,
        externalInvestmentsStaleAfterMinutes: env.EXTERNAL_INVESTMENTS_STALE_AFTER_MINUTES,
        ibkrFlexEnabled: env.IBKR_FLEX_ENABLED,
        binanceSpotEnabled: env.BINANCE_SPOT_ENABLED,
      })
    )
    .use(
      createPowensRoutes({
        db,
        redisClient: redisClient.client,
        env,
      })
    )
    .use(
      createExternalInvestmentsRoutes({
        db,
        redisClient: redisClient.client,
        env,
      })
    )
    .use(
      createEnrichmentRoutes({
        db,
        bulkEnabled: env.ENRICHMENT_BULK_TRIAGE_ENABLED,
      })
    )
    .use(
      createNotificationsRoutes({
        redis: redisClient.client,
        env,
      })
    )
    .use(
      createDebugRoutes({
        db,
        redisClient: redisClient.client,
        env,
      })
    )

  const withSystemRoutes = registerSystemRoutes(withFeatureRoutes as unknown as Elysia, env)

  return withSystemRoutes.get('/db/health', async () => {
    const result = await sql<{ now: string }[]>`
        select now()::text as now
      `

    return {
      status: 'ok',
      service: 'api',
      database: 'ok',
      databaseTime: result[0]?.now ?? null,
      timestamp: new Date().toISOString(),
    }
  })
}

const toPathname = (request: Request) => {
  return new URL(request.url).pathname
}

const resolveStatusCode = (value: unknown) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  return 200
}

const resolveUserMode = (context: object) => {
  const auth = getAuth(context)
  const internalAuth = getInternalAuth(context)

  if (auth.mode === 'admin') {
    return 'admin'
  }

  if (internalAuth.hasValidToken) {
    return 'internal'
  }

  return 'demo'
}

const toValidationDetails = (error: unknown) => {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const rawIssues = (error as { all?: unknown }).all
  if (!Array.isArray(rawIssues)) {
    return undefined
  }

  const details = rawIssues.slice(0, 10).map(issue => {
    if (!issue || typeof issue !== 'object') {
      return {
        path: 'unknown',
        message: String(issue),
      }
    }

    const source = issue as {
      path?: string
      schema?: { error?: string }
      summary?: string
      message?: string
    }

    return {
      path: source.path ?? 'unknown',
      message: source.message ?? source.summary ?? source.schema?.error ?? 'Invalid input',
    }
  })

  return details.length > 0 ? details : undefined
}

const buildApiErrorResponse = ({
  status,
  code,
  message,
  requestId,
  details,
}: {
  status: number
  code: string
  message: string
  requestId: string
  details?: unknown
}) => {
  return new Response(
    JSON.stringify({
      ok: false,
      code,
      message,
      requestId,
      ...(details === undefined ? {} : { details }),
    }),
    {
      status,
      headers: {
        ...createApiSecurityHeaders({ nodeEnv: env.NODE_ENV }),
        'content-type': 'application/json',
        'cache-control': 'no-store',
        'x-request-id': requestId,
      },
    }
  )
}

await redisClient.connect()

const app = new Elysia()
  .use(
    cors({
      origin: [env.WEB_ORIGIN, 'http://localhost:3000', 'http://127.0.0.1:3000'],
      credentials: true,
      allowedHeaders: [
        'Accept',
        'Content-Type',
        'authorization',
        'x-finance-os-access-token',
        'x-finance-os-debug-token',
        'x-internal-token',
        'x-request-id',
      ],
      exposeHeaders: ['retry-after', 'x-request-id', 'x-robots-tag'],
    })
  )
  .use(deriveAuth({ env }))
  .onBeforeHandle(context => {
    if (!env.PRIVATE_ACCESS_TOKEN) {
      return
    }

    if (context.request.method === 'OPTIONS') {
      return
    }

    const pathname = toPathname(context.request)
    if (
      shouldBypassPrivateAccessGate({
        pathname,
        nodeEnv: env.NODE_ENV,
      })
    ) {
      return
    }

    if (getInternalAuth(context).hasValidToken) {
      return
    }

    context.set.status = 401
    applyApiSecurityHeaders(context.set.headers, { nodeEnv: env.NODE_ENV })
    const requestId = getRequestMeta(context).requestId
    logApiEvent({
      level: 'warn',
      msg: 'api request denied by internal token gate',
      route: pathname,
      method: context.request.method,
      status: 401,
      requestId,
      errName: 'InternalTokenRequiredError',
      errMessage: 'Internal token required',
    })

    return {
      ok: false,
      code: 'INTERNAL_TOKEN_REQUIRED',
      message: 'Internal token required',
      requestId,
    }
  })
  .onBeforeHandle(context => {
    if (context.request.method === 'OPTIONS') {
      return
    }

    if (!isUnsafeHttpMethod(context.request.method)) {
      return
    }

    if (getInternalAuth(context).hasValidToken) {
      return
    }

    const allowedOrigins = createAllowedBrowserOrigins({
      requestUrl: context.request.url,
      webOrigin: env.WEB_ORIGIN,
      nodeEnv: env.NODE_ENV,
    })

    if (
      isSameOriginMutationRequest({
        request: context.request,
        allowedOrigins,
      })
    ) {
      return
    }

    const route = toPathname(context.request)
    const requestId = getRequestMeta(context).requestId
    context.set.status = 403
    context.set.headers['cache-control'] = 'no-store'
    context.set.headers['x-request-id'] = requestId
    applyApiSecurityHeaders(context.set.headers, { nodeEnv: env.NODE_ENV })

    logApiEvent({
      level: 'warn',
      msg: 'api request denied by csrf origin guard',
      route,
      method: context.request.method,
      status: 403,
      requestId,
      originPresent: Boolean(context.request.headers.get('origin')),
      refererPresent: Boolean(context.request.headers.get('referer')),
      errName: 'CsrfOriginForbidden',
      errMessage: 'Unsafe browser mutation requires a same-origin Origin or Referer header',
    })

    return {
      ok: false,
      code: 'CSRF_ORIGIN_FORBIDDEN',
      message: 'Unsafe browser mutation requires a same-origin Origin or Referer header',
      requestId,
    }
  })
  .onAfterHandle(context => {
    const requestId = getRequestMeta(context).requestId
    const startedAtMs = getRequestMeta(context).startedAtMs
    const durationMs = startedAtMs > 0 ? Date.now() - startedAtMs : null
    const status = resolveStatusCode(context.set.status)
    const userMode = resolveUserMode(context)
    const route = toPathname(context.request)
    const method = context.request.method
    applyApiSecurityHeaders(context.set.headers, { nodeEnv: env.NODE_ENV })
    context.set.headers['x-request-id'] = requestId
    if (shouldSetNoStore(route)) {
      context.set.headers['cache-control'] = 'no-store'
    }

    logApiEvent({
      level: status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info',
      msg: 'api request completed',
      route,
      method,
      status,
      durationMs,
      userMode,
      requestId,
    })
  })
  .use(registerAppRoutes(new Elysia() as unknown as Elysia))
  .use(registerAppRoutes(new Elysia({ prefix: '/api' }) as unknown as Elysia))
  .get('/__routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
      routes,
    }
  })
  .get('/api/__routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
      routes,
    }
  })
  .get('/debug/routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
      routes,
    }
  })
  .get('/api/debug/routes', ({ request, set }) => {
    if (!canAccessRoutesDebug(request)) {
      set.status = 403
      return {
        status: 'error',
        message: 'Route debug endpoint requires x-finance-os-debug-token or internal token',
      }
    }

    set.headers['cache-control'] = 'no-store'
    const routes = listRegisteredRoutes(app)
    return {
      count: routes.length,
      version: getRuntimeVersion(),
      routes,
    }
  })
  .onError(context => {
    const requestId = getRequestMeta(context).requestId ?? resolveRequestId(context.request)
    const startedAtMs = getRequestMeta(context).startedAtMs
    const durationMs = startedAtMs > 0 ? Date.now() - startedAtMs : null
    const userMode = resolveUserMode(context)
    const route = toPathname(context.request)
    context.set.headers['x-request-id'] = requestId
    applyApiSecurityHeaders(context.set.headers, { nodeEnv: env.NODE_ENV })
    if (shouldSetNoStore(route)) {
      context.set.headers['cache-control'] = 'no-store'
    }

    let status = 500
    let responseCode = 'INTERNAL_ERROR'
    let message = 'Internal server error'
    let details: unknown

    if (isDemoModeForbiddenError(context.error)) {
      status = 403
      responseCode = context.error.code
      message = context.error.message
    } else if (isInternalTokenRequiredError(context.error)) {
      status = 401
      responseCode = context.error.code
      message = context.error.message
    } else if (context.code === 'VALIDATION' || context.code === 'PARSE') {
      status = 400
      responseCode = 'INVALID_INPUT'
      message = 'Invalid request payload'
      details = toValidationDetails(context.error)
    } else if (context.code === 'NOT_FOUND') {
      status = 404
      responseCode = 'ROUTE_NOT_FOUND'
      message = 'Route not found'
    }

    const includeStack = status >= 500 || isApiDebugEnabled()
    const errorFields = toErrorLogFields({
      error: context.error,
      includeStack,
    })

    logApiEvent({
      level: status >= 500 ? 'error' : 'warn',
      msg: 'api request failed',
      route,
      method: context.request.method,
      status,
      durationMs,
      userMode,
      requestId,
      ...errorFields,
    })

    return buildApiErrorResponse({
      status,
      code: responseCode,
      message,
      requestId,
      details,
    })
  })

const registeredRoutes = listRegisteredRoutes(app)
if (env.NODE_ENV === 'production') {
  assertRequiredProductionRoutes({
    routes: registeredRoutes,
  })
}

logApiEvent({
  level: 'info',
  msg: 'api routes mounted',
  routeCount: registeredRoutes.length,
  hasAuthMe: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/auth/me',
    },
  }),
  hasApiAuthMe: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/api/auth/me',
    },
  }),
  hasPowensCallback: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'POST',
      path: '/integrations/powens/callback',
    },
  }),
  hasApiPowensCallback: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'POST',
      path: '/api/integrations/powens/callback',
    },
  }),
  hasVersion: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/version',
    },
  }),
  hasApiVersion: hasRouteSignature({
    routes: registeredRoutes,
    signature: {
      method: 'GET',
      path: '/api/version',
    },
  }),
  runtimeVersion: getRuntimeVersion(),
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
})

app.listen({
  hostname: env.API_HOST,
  port: env.API_PORT,
})

logApiEvent({
  level: 'info',
  msg: 'api listening',
  host: env.API_HOST,
  port: env.API_PORT,
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
})

const shutdown = async (signal: string) => {
  logApiEvent({
    level: 'info',
    msg: 'api shutdown signal received',
    signal,
  })
  await Promise.allSettled([close(), redisClient.close()])
  process.exit(0)
}

let shuttingDown = false
const resolveWarningCode = (warning: Error) => {
  const candidate = (warning as unknown as { code?: unknown }).code
  return typeof candidate === 'string' ? candidate : null
}

const shutdownOnce = (signal: string) => {
  if (shuttingDown) {
    return
  }
  shuttingDown = true
  void shutdown(signal)
}

process.on('SIGINT', () => shutdownOnce('SIGINT'))
process.on('SIGTERM', () => shutdownOnce('SIGTERM'))
process.on('warning', warning => {
  logApiEvent({
    level: 'warn',
    msg: 'api runtime warning',
    warningName: warning.name,
    warningCode: resolveWarningCode(warning),
    warningMessage: warning.message,
  })
})
process.on('unhandledRejection', reason => {
  logApiEvent({
    level: 'error',
    msg: 'api unhandled rejection',
    ...toErrorLogFields({
      error: reason,
      includeStack: true,
    }),
  })
  shutdownOnce('UNHANDLED_REJECTION')
})
process.on('uncaughtException', error => {
  logApiEvent({
    level: 'error',
    msg: 'api uncaught exception',
    ...toErrorLogFields({
      error,
      includeStack: true,
    }),
  })
  shutdownOnce('UNCAUGHT_EXCEPTION')
})
