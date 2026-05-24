/**
 * Env diagnostics — single source of truth for "which service must own which
 * env var, under which feature flag, and how to detect missing/placeholder
 * values".
 *
 * This module is intentionally I/O-free. Inputs are plain objects (env map,
 * compose YAML string). It is consumed by:
 *
 *   - `scripts/check-compose-env-parity.ts` (CI guard)
 *   - `scripts/env-check.ts` (developer/CI CLI)
 *   - `apps/api/src/routes/ops/env-diagnostics.ts` (admin runtime endpoint)
 *
 * The contract: feature flag enabled in production must imply that the
 * service that EXECUTES the feature has the required secret(s). The
 * worker triggers API routes via API_INTERNAL_URL, so most provider
 * secrets live on the API side only — see EXECUTING_SERVICE_BY_FEATURE.
 */

export type ServiceName =
  | 'api'
  | 'worker'
  | 'web'
  | 'knowledge-service'
  | 'quant-service'
  | 'ops-alerts'

/**
 * The service that ACTUALLY performs the provider call when a feature is
 * enabled. Worker schedulers usually just `fetch(API_INTERNAL_URL + path)`,
 * which means the secret needs to live on the api container, not the worker.
 *
 * Keep this list semantically aligned with the route handlers — if a route
 * moves between worker and api, this map must move too.
 */
export const EXECUTING_SERVICE_BY_FEATURE: Record<string, ServiceName> = {
  // News providers — fetched server-side inside the API route handlers.
  NEWS_PROVIDER_X_TWITTER: 'api',
  NEWS_PROVIDER_HN: 'api',
  NEWS_PROVIDER_GDELT: 'api',
  NEWS_PROVIDER_ECB_RSS: 'api',
  NEWS_PROVIDER_ECB_DATA: 'api',
  NEWS_PROVIDER_FED: 'api',
  NEWS_PROVIDER_SEC: 'api',
  NEWS_PROVIDER_FRED: 'api',
  // Market data providers.
  MARKET_DATA_EODHD: 'api',
  MARKET_DATA_TWELVEDATA: 'api',
  MARKET_DATA_FRED: 'api',
  // AI Advisor + LLM clients run on api (worker only triggers the route).
  AI_ADVISOR: 'api',
  AI_POST_MORTEM: 'api',
  AI_CHAT: 'api',
  AI_CHALLENGER: 'api',
  AI_RELABEL: 'api',
  // External investments providers (IBKR Flex / Binance Spot) — read-only,
  // executed by the API. Credentials live in DB (admin /integrations,
  // encrypted with APP_ENCRYPTION_KEY); env flag only gates the runtime path.
  IBKR_FLEX: 'api',
  BINANCE_SPOT: 'api',
  // Free Firehose orchestrator — API-side.
  FREE_FIREHOSE: 'api',
  // Knowledge / quant services are reached from the API.
  KNOWLEDGE_SERVICE: 'api',
  QUANT_SERVICE: 'api',
  // Bluesky social provider — API-side.
  BLUESKY: 'api',
}

/**
 * Coupling: when feature flag X is enabled, the executing service MUST have
 * all listed env vars present and non-empty. Used by env:check and the
 * `/ops/env/diagnostics` endpoint to surface "feature enabled without
 * secret" silent failures.
 *
 * `optionalSecrets` are flagged as soft warnings (e.g. fallback to public
 * tier or unauthenticated access still works but degraded).
 */
export type FeatureRequirement = {
  feature: string
  flagKey: string
  /** If absent, the flag is read as truthy when value === '1'/'true'/'yes'. */
  enabledWhen?: (rawValue: string | undefined) => boolean
  requiredSecrets: readonly string[]
  optionalSecrets?: readonly string[]
  /** Human description for diagnostics output. */
  description: string
}

const truthy = (raw: string | undefined): boolean => {
  if (!raw) return false
  const v = raw.trim().toLowerCase()
  return v === '1' || v === 'true' || v === 'yes'
}

export const FEATURE_REQUIREMENTS: readonly FeatureRequirement[] = [
  {
    feature: 'X / Twitter ingestion',
    flagKey: 'NEWS_PROVIDER_X_TWITTER_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN'],
    optionalSecrets: ['NEWS_PROVIDER_X_TWITTER_QUERY'],
    description: 'X/Twitter ingestion needs a bearer token to call the recent-search endpoint.',
  },
  {
    feature: 'X daily previous-day sync (pay-per-use)',
    flagKey: 'X_DAILY_PREVIOUS_DAY_SYNC_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: [
      'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
      'X_DAILY_BUDGET_USD',
      'X_MONTHLY_BUDGET_USD',
    ],
    description:
      'X daily previous-day sync runs as a paid endpoint — bearer token AND budget caps must be set.',
  },
  {
    feature: 'Market data — EODHD',
    flagKey: 'MARKET_DATA_EODHD_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['EODHD_API_KEY'],
    description: 'EODHD provider needs EODHD_API_KEY.',
  },
  {
    feature: 'Market data — Twelve Data',
    flagKey: 'MARKET_DATA_TWELVEDATA_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['TWELVEDATA_API_KEY'],
    description: 'Twelve Data provider needs TWELVEDATA_API_KEY.',
  },
  {
    feature: 'Market data — FRED macro',
    flagKey: 'MARKET_DATA_FRED_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['FRED_API_KEY'],
    description: 'FRED macro series fetch needs FRED_API_KEY.',
  },
  {
    feature: 'News — FRED economic releases',
    flagKey: 'NEWS_PROVIDER_FRED_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['FRED_API_KEY'],
    description: 'FRED news endpoint shares the same API key.',
  },
  {
    feature: 'News — SEC EDGAR',
    flagKey: 'NEWS_PROVIDER_SEC_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['SEC_USER_AGENT'],
    description:
      'SEC EDGAR requires a User-Agent identifying the caller (SEC_USER_AGENT="finance-os/<contact-email>").',
  },
  {
    feature: 'News scraper metadata fetch',
    flagKey: 'NEWS_METADATA_FETCH_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: [],
    optionalSecrets: ['NEWS_SCRAPER_USER_AGENT'],
    description: 'Custom UA recommended to avoid throttling on outbound article metadata fetches.',
  },
  {
    feature: 'AI Advisor (LLM-backed)',
    flagKey: 'AI_ADVISOR_ENABLED',
    enabledWhen: raw =>
      truthy(raw) && !truthy(process.env.AI_ADVISOR_FORCE_LOCAL_ONLY ?? undefined),
    requiredSecrets: [],
    optionalSecrets: ['AI_OPENAI_API_KEY', 'AI_ANTHROPIC_API_KEY'],
    description:
      'When Advisor is on AND not forced local-only, at least one LLM key (OpenAI or Anthropic) must be set; otherwise daily brief falls back to deterministic mode.',
  },
  {
    feature: 'AI Post-Mortem',
    flagKey: 'AI_POST_MORTEM_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: [],
    optionalSecrets: ['AI_OPENAI_API_KEY', 'AI_ANTHROPIC_API_KEY'],
    description: 'Post-mortem needs at least one LLM key.',
  },
  {
    feature: 'Free Firehose admin bulk fetch',
    flagKey: 'FREE_FIREHOSE_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: [],
    description:
      'Free Firehose itself uses free providers; SEC_USER_AGENT and FRED_API_KEY are recommended if the corresponding sub-providers are activated in the run.',
  },
  {
    feature: 'Knowledge service (Neo4j + Qdrant)',
    flagKey: 'KNOWLEDGE_SERVICE_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['KNOWLEDGE_SERVICE_URL'],
    description:
      'API must know where to reach the knowledge service. Neo4j/Qdrant credentials live on the knowledge service container only.',
  },
  {
    feature: 'Quant service',
    flagKey: 'QUANT_SERVICE_ENABLED',
    enabledWhen: truthy,
    requiredSecrets: ['QUANT_SERVICE_URL'],
    description: 'API must know where to reach the quant service.',
  },
  {
    feature: 'IBKR Flex read-only',
    flagKey: 'IBKR_FLEX_ENABLED',
    enabledWhen: truthy,
    // IBKR Flex credentials (token + query ids) are NOT env vars. They are
    // configured per-account in admin via /integrations and stored encrypted
    // in DB with APP_ENCRYPTION_KEY. See docs/context/ENV-REFERENCE.md §8.bis.
    // The env flag only gates whether the runtime path is enabled.
    requiredSecrets: [],
    description:
      'IBKR Flex runtime path. Credentials (token, query ids) are admin-managed in DB via /integrations, encrypted with APP_ENCRYPTION_KEY — never env vars.',
  },
  {
    feature: 'Binance Spot read-only',
    flagKey: 'BINANCE_SPOT_ENABLED',
    enabledWhen: truthy,
    // Binance Spot credentials are NOT env vars. They are configured per-account
    // in admin via /integrations and stored encrypted in DB with APP_ENCRYPTION_KEY.
    // See docs/context/ENV-REFERENCE.md §8.bis.
    requiredSecrets: [],
    description:
      'Binance Spot read-only runtime path. API key + secret are admin-managed in DB via /integrations, encrypted with APP_ENCRYPTION_KEY — never env vars.',
  },
  {
    feature: 'Powens banking connector',
    flagKey: 'POWENS_CLIENT_ID',
    enabledWhen: raw => Boolean(raw && raw.trim().length > 0),
    requiredSecrets: [
      'POWENS_CLIENT_ID',
      'POWENS_CLIENT_SECRET',
      'POWENS_DOMAIN',
      'APP_ENCRYPTION_KEY',
    ],
    description:
      'Powens requires client_id / client_secret / domain to mint webview URLs and APP_ENCRYPTION_KEY to encrypt user tokens at rest.',
  },
]

/**
 * Common placeholder values that almost certainly mean "operator forgot to
 * set this in Dokploy". Surfaced as warnings, not failures, because some
 * keys legitimately contain "example" in their value (e.g. test strings).
 * The match is case-insensitive and matched against the trimmed full value.
 */
export const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /^todo$/i,
  /^changeme$/i,
  /^change[\s_-]?me$/i,
  /^placeholder$/i,
  /^xxx+$/i,
  /^example$/i,
  /^fake$/i,
  /^secret$/i,
  /^your[_\s-]?(api[_\s-]?)?key([_\s-]?here)?$/i,
  /^ton[_\s-]?/i,
  /^<.*>$/,
  /^\[.*\]$/,
]

export const isPlaceholderValue = (value: string | undefined): boolean => {
  if (!value) return false
  const trimmed = value.trim()
  if (trimmed.length === 0) return false
  return PLACEHOLDER_PATTERNS.some(pattern => pattern.test(trimmed))
}

export type EnvIssueLevel = 'error' | 'warning' | 'info'

export type EnvIssue = {
  level: EnvIssueLevel
  /** Service that should own this env var. */
  service: ServiceName
  /** Stable code for filtering / linking docs. */
  code:
    | 'MISSING_REQUIRED_SECRET'
    | 'MISSING_OPTIONAL_SECRET'
    | 'FEATURE_ENABLED_WITHOUT_SECRET'
    | 'PLACEHOLDER_VALUE'
    | 'FORBIDDEN_KEY_LEAKED_TO_SERVICE'
    | 'COMPOSE_MISSING_KEY'
    | 'COMPOSE_FORBIDDEN_KEY'
  envName: string
  /** Feature/flag this rule comes from, if any. */
  feature?: string
  message: string
  /** Suggested remediation step shown in the diagnostics UI. */
  remediation?: string
}

/**
 * Per-feature evaluation: given the env map of the EXECUTING service, returns
 * a list of issues. The executing service is read from EXECUTING_SERVICE_BY_FEATURE
 * (defaulting to 'api' which is correct for every feature today).
 */
export const evaluateFeatureRequirements = (
  env: Record<string, string | undefined>
): EnvIssue[] => {
  const issues: EnvIssue[] = []

  for (const req of FEATURE_REQUIREMENTS) {
    const enabled = req.enabledWhen ? req.enabledWhen(env[req.flagKey]) : truthy(env[req.flagKey])
    if (!enabled) continue

    const featureKey = req.flagKey.replace(/_ENABLED$/, '')
    const owner = EXECUTING_SERVICE_BY_FEATURE[featureKey] ?? 'api'

    for (const secret of req.requiredSecrets) {
      const value = env[secret]
      if (value === undefined || value.trim().length === 0) {
        issues.push({
          level: 'error',
          service: owner,
          code: 'FEATURE_ENABLED_WITHOUT_SECRET',
          envName: secret,
          feature: req.feature,
          message: `${req.flagKey}=true but ${secret} is missing in the ${owner} container.`,
          remediation: `Set ${secret} on the ${owner} service in Dokploy (or disable ${req.flagKey}).`,
        })
      } else if (isPlaceholderValue(value)) {
        issues.push({
          level: 'error',
          service: owner,
          code: 'PLACEHOLDER_VALUE',
          envName: secret,
          feature: req.feature,
          message: `${secret} looks like a placeholder ("${value.slice(0, 32)}…"). The feature will not actually work.`,
          remediation: `Replace ${secret} with the real value in Dokploy.`,
        })
      }
    }

    for (const secret of req.optionalSecrets ?? []) {
      const value = env[secret]
      if (value === undefined || value.trim().length === 0) {
        issues.push({
          level: 'warning',
          service: owner,
          code: 'MISSING_OPTIONAL_SECRET',
          envName: secret,
          feature: req.feature,
          message: `${req.flagKey}=true but optional ${secret} is unset — feature may run in degraded mode.`,
          remediation: `Set ${secret} on ${owner} to unlock the full feature.`,
        })
      } else if (isPlaceholderValue(value)) {
        issues.push({
          level: 'warning',
          service: owner,
          code: 'PLACEHOLDER_VALUE',
          envName: secret,
          feature: req.feature,
          message: `${secret} looks like a placeholder.`,
        })
      }
    }
  }

  return issues
}

/**
 * Forbidden keys by service — defense-in-depth against secret leaks. Mirrors
 * the existing check in scripts/check-compose-env-parity.ts, expanded to
 * cover knowledge-service / quant-service which must NOT receive other
 * services' secrets.
 */
export const FORBIDDEN_KEYS_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: [],
  worker: [],
  web: [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'EODHD_API_KEY',
    'TWELVEDATA_API_KEY',
    'FRED_API_KEY',
    'ALPHA_VANTAGE_API_KEY',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'APP_ENCRYPTION_KEY',
    'AUTH_ADMIN_PASSWORD_HASH',
    'AUTH_ADMIN_PASSWORD_HASH_B64',
    'NEO4J_PASSWORD',
    'KNOWLEDGE_NEO4J_PASSWORD',
    'QDRANT_API_KEY',
    'KNOWLEDGE_QDRANT_API_KEY',
    'POSTGRES_PASSWORD',
    'BLUESKY_APP_PASSWORD',
    'PUSH_VAPID_PRIVATE_KEY',
    'IBKR_FLEX_TOKEN',
    'BINANCE_SPOT_API_KEY',
    'BINANCE_SPOT_API_SECRET',
  ],
  'knowledge-service': [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'EODHD_API_KEY',
    'TWELVEDATA_API_KEY',
    'FRED_API_KEY',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'IBKR_FLEX_TOKEN',
    'BINANCE_SPOT_API_KEY',
    'BINANCE_SPOT_API_SECRET',
  ],
  'quant-service': [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'IBKR_FLEX_TOKEN',
    'BINANCE_SPOT_API_KEY',
    'BINANCE_SPOT_API_SECRET',
  ],
  'ops-alerts': [
    'AI_OPENAI_API_KEY',
    'AI_ANTHROPIC_API_KEY',
    'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
    'EODHD_API_KEY',
    'TWELVEDATA_API_KEY',
    'FRED_API_KEY',
    'POWENS_CLIENT_SECRET',
    'AUTH_SESSION_SECRET',
    'APP_ENCRYPTION_KEY',
  ],
}

/**
 * Required keys per service. The architectural invariant is: the worker
 * triggers API routes — it does NOT need provider secrets directly, only
 * scheduler config. Keep this list synchronized with check-compose-env-parity.ts.
 *
 * Intentionally exported as plain arrays so the parity script can `import`
 * them without duplicating the source of truth.
 */
export const API_REQUIRED_KEYS: readonly string[] = [
  'EXTERNAL_INTEGRATIONS_SAFE_MODE',
  'EXTERNAL_INVESTMENTS_ENABLED',
  'EXTERNAL_INVESTMENTS_SAFE_MODE',
  'TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED',
  'TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT',
  'TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS',
  'AI_RELABEL_ENABLED',
  'ENRICHMENT_BULK_TRIAGE_ENABLED',
  // Market data
  'MARKET_DATA_ENABLED',
  'MARKET_DATA_REFRESH_ENABLED',
  'MARKET_DATA_EODHD_ENABLED',
  'MARKET_DATA_TWELVEDATA_ENABLED',
  'MARKET_DATA_FRED_ENABLED',
  'MARKET_DATA_FORCE_FIXTURE_FALLBACK',
  'MARKET_DATA_STALE_AFTER_MINUTES',
  'MARKET_DATA_REFRESH_COOLDOWN_SECONDS',
  'EODHD_API_KEY',
  'TWELVEDATA_API_KEY',
  'FRED_API_KEY',
  // X / social
  'NEWS_PROVIDER_X_TWITTER_ENABLED',
  'NEWS_PROVIDER_X_TWITTER_QUERY',
  'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN',
  'SIGNALS_SOCIAL_POLLING_ENABLED',
  'SIGNALS_MANUAL_IMPORT_ENABLED',
  'ADVISOR_X_SIGNALS_MODE',
  'DAILY_INTELLIGENCE_ENABLED',
  'DAILY_INTELLIGENCE_CRON',
  'DAILY_INTELLIGENCE_NIGHT_CRON',
  'DAILY_INTELLIGENCE_MORNING_CRON',
  'DAILY_INTELLIGENCE_TIMEZONE',
  'DAILY_INTELLIGENCE_LOCK_TTL_SECONDS',
  'DAILY_INTELLIGENCE_MAX_DURATION_SECONDS',
  'DAILY_INTELLIGENCE_DRY_RUN_DEFAULT',
  'DAILY_INTELLIGENCE_MANUAL_TRIGGER_ENABLED',
  // X daily previous-day sync — pay-per-use guarded
  'X_DAILY_PREVIOUS_DAY_SYNC_ENABLED',
  'X_DAILY_BUDGET_USD',
  'X_MONTHLY_BUDGET_USD',
  'X_MAX_POST_READS_PER_DAY',
  'X_MAX_USER_READS_PER_DAY',
  'X_MAX_TWEETS_PER_AUTHOR_PER_DAY',
  'X_MAX_PAGES_PER_USER_PER_DAY',
  'X_MAX_FOLLOWED_ACCOUNTS',
  'X_REQUIRE_MANUAL_CONFIRMATION_OVER_ESTIMATE_USD',
  'X_DISABLE_ON_BUDGET_EXCEEDED',
  'X_DISABLE_ON_PAYMENT_REQUIRED',
  'X_ADVISOR_MAX_TWEETS_PER_DAY',
  'X_ADVISOR_MAX_TWEETS_PER_AUTHOR_PER_DAY',
  'X_ADVISOR_RELEVANCE_THRESHOLD',
  // Free Firehose — admin manual ingest
  'FREE_FIREHOSE_ENABLED',
  'FREE_FIREHOSE_MAX_RUNS_PER_WEEK',
  'FREE_FIREHOSE_REQUIRE_CONFIRMATION',
  'FREE_FIREHOSE_LLM_ENRICHMENT_DEFAULT',
  'FREE_FIREHOSE_MAX_GDELT_RECORDS',
  'FREE_FIREHOSE_MAX_HN_RECORDS',
  'FREE_FIREHOSE_MAX_SEC_FILINGS',
  'FREE_FIREHOSE_MAX_FRED_SERIES',
  'FREE_FIREHOSE_MAX_ECB_SERIES',
  // AI
  'AI_ADVISOR_ENABLED',
  'AI_ADVISOR_FORCE_LOCAL_ONLY',
  'AI_POST_MORTEM_ENABLED',
  'AI_CHAT_ENABLED',
  'AI_CHALLENGER_ENABLED',
  'AI_OPENAI_API_KEY',
  'AI_OPENAI_CLASSIFIER_MODEL',
  'AI_OPENAI_DAILY_MODEL',
  'AI_OPENAI_DEEP_MODEL',
  'AI_ANTHROPIC_API_KEY',
  'AI_ANTHROPIC_CHALLENGER_MODEL',
  'AI_BUDGET_DAILY_USD',
  'AI_BUDGET_MONTHLY_USD',
  // Knowledge service
  'KNOWLEDGE_SERVICE_ENABLED',
  'KNOWLEDGE_SERVICE_URL',
  'KNOWLEDGE_SERVICE_TIMEOUT_MS',
  'AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED',
  'ADVISOR_GRAPH_INGEST_ENABLED',
  // External investments providers
  'IBKR_FLEX_ENABLED',
  'IBKR_FLEX_BASE_URL',
  'IBKR_FLEX_TIMEOUT_MS',
  'BINANCE_SPOT_ENABLED',
  'BINANCE_SPOT_BASE_URL',
  'BINANCE_SPOT_TIMEOUT_MS',
  // Failsoft
  'FAILSOFT_POLICY_ENABLED',
  'FAILSOFT_SOURCE_ORDER',
  'FAILSOFT_NEWS_ENABLED',
  'FAILSOFT_INSIGHTS_ENABLED',
  // Attention
  'ATTENTION_SYSTEM_ENABLED',
]

export const WORKER_REQUIRED_KEYS: readonly string[] = [
  'EXTERNAL_INTEGRATIONS_SAFE_MODE',
  'WORKER_AUTO_SYNC_ENABLED',
  'AI_POST_MORTEM_AUTO_RUN_ENABLED',
  'AI_POST_MORTEM_CRON',
  'AI_POST_MORTEM_TIMEZONE',
  'AI_DAILY_AUTO_RUN_ENABLED',
  'AI_DAILY_INTERVAL_MS',
  'DAILY_INTELLIGENCE_ENABLED',
  'DAILY_INTELLIGENCE_CRON',
  'DAILY_INTELLIGENCE_NIGHT_CRON',
  'DAILY_INTELLIGENCE_MORNING_CRON',
  'DAILY_INTELLIGENCE_TIMEZONE',
  'DAILY_INTELLIGENCE_LOCK_TTL_SECONDS',
  'DAILY_INTELLIGENCE_MAX_DURATION_SECONDS',
  'DAILY_INTELLIGENCE_DRY_RUN_DEFAULT',
  'DAILY_INTELLIGENCE_MANUAL_TRIGGER_ENABLED',
  'NEWS_AUTO_INGEST_ENABLED',
  'NEWS_FETCH_INTERVAL_MS',
  'MARKET_DATA_AUTO_REFRESH_ENABLED',
  'MARKET_DATA_REFRESH_INTERVAL_MS',
  'SIGNALS_SOCIAL_POLLING_ENABLED',
  'SIGNALS_SOCIAL_POLLING_INTERVAL_MS',
  'ATTENTION_SYSTEM_ENABLED',
  'ATTENTION_REBUILD_AUTO_ENABLED',
  'ATTENTION_REBUILD_INTERVAL_MS',
  'AI_ADVISOR_ENABLED',
  'AI_ADVISOR_FORCE_LOCAL_ONLY',
  'AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED',
  'ADVISOR_X_SIGNALS_MODE',
  // External investments — Binance valuation enrichment runs in worker.
  'EXTERNAL_INVESTMENTS_VALUATION_TARGET_CURRENCY',
  'EXTERNAL_INVESTMENTS_BINANCE_VALUATION_ENABLED',
  'EXTERNAL_INVESTMENTS_BINANCE_VALUATION_USD_EUR_FALLBACK',
  'IBKR_FLEX_ENABLED',
  'BINANCE_SPOT_ENABLED',
  'BINANCE_SPOT_BASE_URL',
  'BINANCE_SPOT_RECV_WINDOW_MS',
  'BINANCE_SPOT_TIMEOUT_MS',
  'IBKR_FLEX_BASE_URL',
  'IBKR_FLEX_TIMEOUT_MS',
  'IBKR_FLEX_USER_AGENT',
  // X daily previous-day scheduler — worker triggers the API endpoint.
  'X_DAILY_PREVIOUS_DAY_SYNC_ENABLED',
  'X_DAILY_PREVIOUS_DAY_CRON',
  'X_DAILY_PREVIOUS_DAY_TIMEZONE',
  'X_DAILY_PREVIOUS_DAY_TRIGGER_TIMEOUT_MS',
  'X_DAILY_PREVIOUS_DAY_LOCK_TTL_SECONDS',
]

export const WEB_REQUIRED_KEYS: readonly string[] = [
  'VITE_API_BASE_URL',
  'VITE_APP_ORIGIN',
  'VITE_APP_TITLE',
  'VITE_AI_ADVISOR_ENABLED',
  'VITE_AI_ADVISOR_ADMIN_ONLY',
  'VITE_DASHBOARD_HEALTH_SIGNALS_ENABLED',
  'VITE_PWA_NOTIFICATIONS_ENABLED',
  'VITE_PWA_CRITICAL_ENABLED',
]

export const OPS_ALERTS_REQUIRED_KEYS: readonly string[] = [
  'ALERTS_ENABLED',
  'ALERTS_POLL_INTERVAL_MS',
  'ALERTS_HEALTHCHECK_URLS',
  'ALERTS_WORKER_HEARTBEAT_FILE',
  'ALERTS_WORKER_STALE_AFTER_MS',
  'ALERTS_DISK_FREE_PERCENT_THRESHOLD',
  'ALERTS_DISK_PATHS',
]

export const REQUIRED_KEYS_BY_SERVICE: Record<ServiceName, readonly string[]> = {
  api: API_REQUIRED_KEYS,
  worker: WORKER_REQUIRED_KEYS,
  web: WEB_REQUIRED_KEYS,
  'knowledge-service': [],
  'quant-service': [],
  'ops-alerts': OPS_ALERTS_REQUIRED_KEYS,
}

/**
 * Pure runtime evaluation of the current process environment, scoped to one
 * service. Returns issues + a redacted summary suitable for the
 * `/ops/env/diagnostics` JSON response (no secret values, only lengths).
 */
export type ServiceDiagnostics = {
  service: ServiceName
  features: Array<{
    feature: string
    flagKey: string
    enabled: boolean
    configured: boolean
    canRun: boolean
    missingRequiredSecrets: string[]
    missingOptionalSecrets: string[]
    placeholderSecrets: string[]
    reasonIfBlocked: string | null
  }>
  issues: EnvIssue[]
}

/**
 * Per-service runtime evaluation.
 *
 * When called from a runtime context where `env` IS the actual container's
 * env (e.g. `process.env` inside the API service), `checkForbiddenLeaks`
 * should stay true to catch keys that should not live on this container.
 *
 * When called from a CLI context where `env` is the developer's local
 * `.env` (which contains every secret by design), `checkForbiddenLeaks`
 * should be false — the compose-parity script handles the per-service
 * forbidden-key check against the actual container env mapping.
 */
export const diagnoseServiceEnv = (
  service: ServiceName,
  env: Record<string, string | undefined>,
  { checkForbiddenLeaks = true }: { checkForbiddenLeaks?: boolean } = {}
): ServiceDiagnostics => {
  const issues = evaluateFeatureRequirements(env).filter(issue => issue.service === service)

  const features = FEATURE_REQUIREMENTS.filter(req => {
    const featureKey = req.flagKey.replace(/_ENABLED$/, '')
    const owner = EXECUTING_SERVICE_BY_FEATURE[featureKey] ?? 'api'
    return owner === service
  }).map(req => {
    const enabled = req.enabledWhen ? req.enabledWhen(env[req.flagKey]) : truthy(env[req.flagKey])

    const missingRequiredSecrets = req.requiredSecrets.filter(secret => {
      const value = env[secret]
      return value === undefined || value.trim().length === 0
    })
    const missingOptionalSecrets = (req.optionalSecrets ?? []).filter(secret => {
      const value = env[secret]
      return value === undefined || value.trim().length === 0
    })
    const placeholderSecrets = [...req.requiredSecrets, ...(req.optionalSecrets ?? [])].filter(
      secret => isPlaceholderValue(env[secret])
    )

    const configured = missingRequiredSecrets.length === 0 && placeholderSecrets.length === 0
    const canRun = enabled && configured
    const reasonIfBlocked = !enabled
      ? null
      : missingRequiredSecrets.length > 0
        ? `Missing required secret(s): ${missingRequiredSecrets.join(', ')}`
        : placeholderSecrets.length > 0
          ? `Placeholder value(s) detected: ${placeholderSecrets.join(', ')}`
          : null

    return {
      feature: req.feature,
      flagKey: req.flagKey,
      enabled,
      configured,
      canRun,
      missingRequiredSecrets,
      missingOptionalSecrets,
      placeholderSecrets,
      reasonIfBlocked,
    }
  })

  // Also check forbidden leaks (a secret that should not be on this service).
  const forbidden = checkForbiddenLeaks ? (FORBIDDEN_KEYS_BY_SERVICE[service] ?? []) : []
  for (const key of forbidden) {
    const value = env[key]
    if (value !== undefined && value.trim().length > 0) {
      issues.push({
        level: 'error',
        service,
        code: 'FORBIDDEN_KEY_LEAKED_TO_SERVICE',
        envName: key,
        message: `${key} is present on the ${service} container but must never be exposed there.`,
        remediation: `Remove ${key} from the ${service} service environment in docker-compose / Dokploy.`,
      })
    }
  }

  return { service, features, issues }
}
