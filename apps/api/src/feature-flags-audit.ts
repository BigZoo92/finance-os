import type { env as ApiEnv } from './env'

type ApiEnvShape = typeof ApiEnv

type SecretPresence = { present: boolean; length: number | null }

const secretPresence = (value: string | undefined | null): SecretPresence => {
  if (value === undefined || value === null || value === '') {
    return { present: false, length: null }
  }
  return { present: true, length: value.length }
}

const looksLikeMisparsedSecret = (value: string | undefined): boolean => {
  if (!value) return false
  // detects ".env line collision" bugs such as
  //   AI_ANTHROPIC_API_KEY=AI_OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano
  // where a newline was lost: the parsed value contains another KEY=VALUE token.
  // Match the strict shape /[A-Z][A-Z0-9_]+=/ to avoid false positives on
  // base64 strings, URLs or hashed credentials that may legitimately contain "=".
  return /\b[A-Z][A-Z0-9_]{2,}=/.test(value)
}

export type ApiFeatureFlagsAudit = {
  // Master safe-mode toggles
  externalIntegrationsSafeMode: boolean
  externalInvestmentsSafeMode: boolean
  // Market data
  marketData: {
    enabled: boolean
    refreshEnabled: boolean
    failsoftEnabled: boolean
    forceFixtureFallback: boolean
    staleAfterMinutes: number
    refreshCooldownSeconds: number
    providers: {
      eodhd: { enabled: boolean; keyConfigured: SecretPresence }
      twelvedata: { enabled: boolean; keyConfigured: SecretPresence }
      fred: { enabled: boolean; keyConfigured: SecretPresence }
    }
  }
  // Social signals / X Twitter
  socialSignals: {
    pollingEnabled: boolean
    manualImportEnabled: boolean
    xTwitter: {
      enabled: boolean
      queryConfigured: boolean
      bearerTokenConfigured: SecretPresence
      mode: 'off' | 'shadow' | 'enforced'
    }
    bluesky: {
      enabled: boolean
      handleConfigured: boolean
      passwordConfigured: SecretPresence
    }
  }
  // Transactions categorization
  transactionsCategorization: {
    migrationEnabled: boolean
    rolloutPercent: number
    shadowLatencyBudgetMs: number
    alertDisagreementRate: number
    aiRelabelEnabled: boolean
    enrichmentBulkTriageEnabled: boolean
  }
  // AI advisor / chat / classifier
  ai: {
    advisorEnabled: boolean
    advisorAdminOnly: boolean
    advisorForceLocalOnly: boolean
    chatEnabled: boolean
    challengerEnabled: boolean
    postMortemEnabled: boolean
    openaiKeyConfigured: SecretPresence
    openaiKeyMisparsedSuspected: boolean
    openaiClassifierModel: string
    openaiDailyModel: string
    openaiDeepModel: string
    anthropicKeyConfigured: SecretPresence
    anthropicKeyMisparsedSuspected: boolean
    anthropicChallengerModel: string
    budgetDailyUsd: number
    budgetMonthlyUsd: number
  }
  // Knowledge / graph
  knowledge: {
    serviceEnabled: boolean
    serviceTimeoutMs: number
    graphBackend: string
    advisorIngestEnabled: boolean
    knowledgeQaRetrievalEnabled: boolean
  }
  // External investments providers
  externalInvestments: {
    enabled: boolean
    safeMode: boolean
    ibkr: { enabled: boolean }
    binance: { enabled: boolean }
  }
  // Failsoft policy
  failsoft: {
    policyEnabled: boolean
    sourceOrder: readonly string[]
    alertsEnabled: boolean
    newsEnabled: boolean
    insightsEnabled: boolean
  }
  // Attention system
  attention: {
    enabled: boolean
    signalMinRelevance: number
    signalMinConfidence: number
  }
}

export const buildApiFeatureFlagsAudit = (env: ApiEnvShape): ApiFeatureFlagsAudit => ({
  externalIntegrationsSafeMode: env.EXTERNAL_INTEGRATIONS_SAFE_MODE,
  externalInvestmentsSafeMode: env.EXTERNAL_INVESTMENTS_SAFE_MODE,
  marketData: {
    enabled: env.MARKET_DATA_ENABLED,
    refreshEnabled: env.MARKET_DATA_REFRESH_ENABLED,
    failsoftEnabled: env.MARKET_DATA_FAILSOFT_ENABLED,
    forceFixtureFallback: env.MARKET_DATA_FORCE_FIXTURE_FALLBACK,
    staleAfterMinutes: env.MARKET_DATA_STALE_AFTER_MINUTES,
    refreshCooldownSeconds: env.MARKET_DATA_REFRESH_COOLDOWN_SECONDS,
    providers: {
      eodhd: {
        enabled: env.MARKET_DATA_EODHD_ENABLED,
        keyConfigured: secretPresence(env.EODHD_API_KEY),
      },
      twelvedata: {
        enabled: env.MARKET_DATA_TWELVEDATA_ENABLED,
        keyConfigured: secretPresence(env.TWELVEDATA_API_KEY),
      },
      fred: {
        enabled: env.MARKET_DATA_FRED_ENABLED,
        keyConfigured: secretPresence(env.FRED_API_KEY),
      },
    },
  },
  socialSignals: {
    pollingEnabled: env.SIGNALS_SOCIAL_POLLING_ENABLED,
    manualImportEnabled: env.SIGNALS_MANUAL_IMPORT_ENABLED,
    xTwitter: {
      enabled: env.NEWS_PROVIDER_X_TWITTER_ENABLED,
      queryConfigured: env.NEWS_PROVIDER_X_TWITTER_QUERY.length > 0,
      bearerTokenConfigured: secretPresence(env.NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN),
      mode: env.ADVISOR_X_SIGNALS_MODE,
    },
    bluesky: {
      enabled: env.BLUESKY_ENABLED,
      handleConfigured: !!env.BLUESKY_HANDLE,
      passwordConfigured: secretPresence(env.BLUESKY_APP_PASSWORD),
    },
  },
  transactionsCategorization: {
    migrationEnabled: env.TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED,
    rolloutPercent: env.TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT,
    shadowLatencyBudgetMs: env.TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS,
    alertDisagreementRate: env.TRANSACTIONS_CATEGORIZATION_ALERT_DISAGREEMENT_RATE,
    aiRelabelEnabled: env.AI_RELABEL_ENABLED,
    enrichmentBulkTriageEnabled: env.ENRICHMENT_BULK_TRIAGE_ENABLED,
  },
  ai: {
    advisorEnabled: env.AI_ADVISOR_ENABLED,
    advisorAdminOnly: env.AI_ADVISOR_ADMIN_ONLY,
    advisorForceLocalOnly: env.AI_ADVISOR_FORCE_LOCAL_ONLY,
    chatEnabled: env.AI_CHAT_ENABLED,
    challengerEnabled: env.AI_CHALLENGER_ENABLED,
    postMortemEnabled: env.AI_POST_MORTEM_ENABLED,
    openaiKeyConfigured: secretPresence(env.AI_OPENAI_API_KEY),
    openaiKeyMisparsedSuspected: looksLikeMisparsedSecret(env.AI_OPENAI_API_KEY),
    openaiClassifierModel: env.AI_OPENAI_CLASSIFIER_MODEL,
    openaiDailyModel: env.AI_OPENAI_DAILY_MODEL,
    openaiDeepModel: env.AI_OPENAI_DEEP_MODEL,
    anthropicKeyConfigured: secretPresence(env.AI_ANTHROPIC_API_KEY),
    anthropicKeyMisparsedSuspected: looksLikeMisparsedSecret(env.AI_ANTHROPIC_API_KEY),
    anthropicChallengerModel: env.AI_ANTHROPIC_CHALLENGER_MODEL,
    budgetDailyUsd: env.AI_BUDGET_DAILY_USD,
    budgetMonthlyUsd: env.AI_BUDGET_MONTHLY_USD,
  },
  knowledge: {
    serviceEnabled: env.KNOWLEDGE_SERVICE_ENABLED,
    serviceTimeoutMs: env.KNOWLEDGE_SERVICE_TIMEOUT_MS,
    graphBackend: env.KNOWLEDGE_GRAPH_BACKEND,
    advisorIngestEnabled: env.ADVISOR_GRAPH_INGEST_ENABLED,
    knowledgeQaRetrievalEnabled: env.AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED,
  },
  externalInvestments: {
    enabled: env.EXTERNAL_INVESTMENTS_ENABLED,
    safeMode: env.EXTERNAL_INVESTMENTS_SAFE_MODE,
    ibkr: { enabled: env.IBKR_FLEX_ENABLED },
    binance: { enabled: env.BINANCE_SPOT_ENABLED },
  },
  failsoft: {
    policyEnabled: env.FAILSOFT_POLICY_ENABLED,
    sourceOrder: env.FAILSOFT_SOURCE_ORDER,
    alertsEnabled: env.FAILSOFT_ALERTS_ENABLED,
    newsEnabled: env.FAILSOFT_NEWS_ENABLED,
    insightsEnabled: env.FAILSOFT_INSIGHTS_ENABLED,
  },
  attention: {
    enabled: env.ATTENTION_SYSTEM_ENABLED,
    signalMinRelevance: env.ATTENTION_SIGNAL_MIN_RELEVANCE,
    signalMinConfidence: env.ATTENTION_SIGNAL_MIN_CONFIDENCE,
  },
})

export const detectCriticalFeatureFlagWarnings = (
  audit: ApiFeatureFlagsAudit
): readonly string[] => {
  const warnings: string[] = []

  if (audit.ai.openaiKeyMisparsedSuspected) {
    warnings.push(
      'AI_OPENAI_API_KEY value looks malformed (contains "KEY=" pattern). Check for missing newline in .env.'
    )
  }
  if (audit.ai.anthropicKeyMisparsedSuspected) {
    warnings.push(
      'AI_ANTHROPIC_API_KEY value looks malformed (contains "KEY=" pattern). Check for missing newline in .env.'
    )
  }
  if (
    audit.socialSignals.xTwitter.enabled &&
    !audit.socialSignals.xTwitter.bearerTokenConfigured.present
  ) {
    warnings.push(
      'NEWS_PROVIDER_X_TWITTER_ENABLED=true but NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN is missing — provider will return empty results.'
    )
  }
  if (audit.marketData.enabled) {
    const noProviderConfigured =
      (!audit.marketData.providers.eodhd.enabled ||
        !audit.marketData.providers.eodhd.keyConfigured.present) &&
      (!audit.marketData.providers.twelvedata.enabled ||
        !audit.marketData.providers.twelvedata.keyConfigured.present) &&
      (!audit.marketData.providers.fred.enabled ||
        !audit.marketData.providers.fred.keyConfigured.present)
    if (noProviderConfigured) {
      warnings.push(
        'MARKET_DATA_ENABLED=true but no provider key is configured (EODHD/TwelveData/FRED). Market data will fail with MARKET_PROVIDER_UNAVAILABLE.'
      )
    }
  }
  if (audit.ai.advisorEnabled && !audit.ai.advisorForceLocalOnly) {
    if (!audit.ai.openaiKeyConfigured.present && !audit.ai.anthropicKeyConfigured.present) {
      warnings.push(
        'AI_ADVISOR_ENABLED=true and AI_ADVISOR_FORCE_LOCAL_ONLY=false, but neither OpenAI nor Anthropic API key is configured.'
      )
    }
  }
  if (
    audit.transactionsCategorization.migrationEnabled &&
    audit.transactionsCategorization.rolloutPercent === 0
  ) {
    warnings.push(
      'TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED=true but rolloutPercent=0 → deterministic rules will never apply.'
    )
  }
  if (audit.externalIntegrationsSafeMode) {
    warnings.push(
      'EXTERNAL_INTEGRATIONS_SAFE_MODE=true → most schedulers and provider syncs are disabled at the worker layer.'
    )
  }

  return warnings
}
