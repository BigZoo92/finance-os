import { describe, expect, it } from 'bun:test'
import { buildApiFeatureFlagsAudit, detectCriticalFeatureFlagWarnings } from './feature-flags-audit'

type FakeEnv = Parameters<typeof buildApiFeatureFlagsAudit>[0]

const makeEnv = (overrides: Partial<FakeEnv> = {}): FakeEnv =>
  ({
    EXTERNAL_INTEGRATIONS_SAFE_MODE: false,
    EXTERNAL_INVESTMENTS_ENABLED: true,
    EXTERNAL_INVESTMENTS_SAFE_MODE: false,
    MARKET_DATA_ENABLED: true,
    MARKET_DATA_REFRESH_ENABLED: true,
    MARKET_DATA_FAILSOFT_ENABLED: true,
    MARKET_DATA_EODHD_ENABLED: true,
    MARKET_DATA_TWELVEDATA_ENABLED: true,
    MARKET_DATA_FRED_ENABLED: true,
    MARKET_DATA_FORCE_FIXTURE_FALLBACK: false,
    MARKET_DATA_STALE_AFTER_MINUTES: 960,
    MARKET_DATA_REFRESH_COOLDOWN_SECONDS: 900,
    EODHD_API_KEY: undefined,
    TWELVEDATA_API_KEY: undefined,
    FRED_API_KEY: undefined,
    SIGNALS_SOCIAL_POLLING_ENABLED: false,
    SIGNALS_MANUAL_IMPORT_ENABLED: true,
    NEWS_PROVIDER_X_TWITTER_ENABLED: true,
    NEWS_PROVIDER_X_TWITTER_QUERY: '(inflation OR rates) lang:en -is:retweet',
    NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: undefined,
    ADVISOR_X_SIGNALS_MODE: 'shadow',
    BLUESKY_ENABLED: false,
    BLUESKY_HANDLE: undefined,
    BLUESKY_APP_PASSWORD: undefined,
    TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED: true,
    TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT: 0,
    TRANSACTIONS_CATEGORIZATION_SHADOW_LATENCY_BUDGET_MS: 150,
    TRANSACTIONS_CATEGORIZATION_ALERT_DISAGREEMENT_RATE: 0.08,
    AI_RELABEL_ENABLED: true,
    ENRICHMENT_BULK_TRIAGE_ENABLED: true,
    AI_ADVISOR_ENABLED: true,
    AI_ADVISOR_ADMIN_ONLY: false,
    AI_ADVISOR_FORCE_LOCAL_ONLY: false,
    AI_CHAT_ENABLED: true,
    AI_CHALLENGER_ENABLED: true,
    AI_POST_MORTEM_ENABLED: false,
    AI_OPENAI_API_KEY: undefined,
    AI_OPENAI_CLASSIFIER_MODEL: 'gpt-5.4-nano',
    AI_OPENAI_DAILY_MODEL: 'gpt-5.4-mini',
    AI_OPENAI_DEEP_MODEL: 'gpt-5.4',
    AI_ANTHROPIC_API_KEY: undefined,
    AI_ANTHROPIC_CHALLENGER_MODEL: 'claude-sonnet-4-6',
    AI_BUDGET_DAILY_USD: 5,
    AI_BUDGET_MONTHLY_USD: 75,
    KNOWLEDGE_SERVICE_ENABLED: true,
    KNOWLEDGE_SERVICE_TIMEOUT_MS: 2500,
    KNOWLEDGE_GRAPH_BACKEND: 'neo4j',
    ADVISOR_GRAPH_INGEST_ENABLED: true,
    AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED: true,
    IBKR_FLEX_ENABLED: true,
    BINANCE_SPOT_ENABLED: true,
    FAILSOFT_POLICY_ENABLED: true,
    FAILSOFT_SOURCE_ORDER: ['live', 'cache', 'demo'],
    FAILSOFT_ALERTS_ENABLED: true,
    FAILSOFT_NEWS_ENABLED: true,
    FAILSOFT_INSIGHTS_ENABLED: true,
    ATTENTION_SYSTEM_ENABLED: true,
    ATTENTION_SIGNAL_MIN_RELEVANCE: 60,
    ATTENTION_SIGNAL_MIN_CONFIDENCE: 50,
    ...overrides,
  }) as FakeEnv

describe('buildApiFeatureFlagsAudit', () => {
  it('reports secret presence + length without leaking the value', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        AI_OPENAI_API_KEY: 'sk-very-secret-1234567890',
        NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'AAAAAAAAAAAAAAAAA',
      })
    )

    expect(audit.ai.openaiKeyConfigured).toEqual({ present: true, length: 25 })
    expect(audit.socialSignals.xTwitter.bearerTokenConfigured).toEqual({
      present: true,
      length: 17,
    })

    const serialized = JSON.stringify(audit)
    expect(serialized).not.toContain('sk-very-secret-1234567890')
    expect(serialized).not.toContain('AAAAAAAAAAAAAAAAA')
  })

  it('marks absent secrets as { present: false, length: null }', () => {
    const audit = buildApiFeatureFlagsAudit(makeEnv())
    expect(audit.ai.openaiKeyConfigured).toEqual({ present: false, length: null })
    expect(audit.marketData.providers.eodhd.keyConfigured).toEqual({
      present: false,
      length: null,
    })
    expect(audit.socialSignals.xTwitter.bearerTokenConfigured).toEqual({
      present: false,
      length: null,
    })
  })

  it('detects misparsed AI keys (newline-collision in .env)', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        AI_ANTHROPIC_API_KEY: 'AI_OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano',
        AI_OPENAI_API_KEY: 'sk-real-1234',
      })
    )
    expect(audit.ai.anthropicKeyMisparsedSuspected).toBe(true)
    expect(audit.ai.openaiKeyMisparsedSuspected).toBe(false)
  })
})

describe('detectCriticalFeatureFlagWarnings', () => {
  it('flags X/Twitter enabled without bearer token', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        NEWS_PROVIDER_X_TWITTER_ENABLED: true,
        NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: undefined,
      })
    )
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(warnings.some(w => w.includes('NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN'))).toBe(true)
  })

  it('flags market data enabled with no provider key configured', () => {
    const audit = buildApiFeatureFlagsAudit(makeEnv())
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(
      warnings.some(w => w.includes('MARKET_PROVIDER_UNAVAILABLE') || w.includes('no provider key'))
    ).toBe(true)
  })

  it('flags categorization rolloutPercent=0 when migration is enabled', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        TRANSACTIONS_CATEGORIZATION_MIGRATION_ENABLED: true,
        TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT: 0,
      })
    )
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(warnings.some(w => w.includes('rolloutPercent=0'))).toBe(true)
  })

  it('flags misparsed AI keys', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        AI_OPENAI_API_KEY: 'AI_OPENAI_CLASSIFIER_MODEL=gpt-5.4-nano',
      })
    )
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(warnings.some(w => w.includes('AI_OPENAI_API_KEY') && w.includes('malformed'))).toBe(
      true
    )
  })

  it('flags safe mode globally', () => {
    const audit = buildApiFeatureFlagsAudit(makeEnv({ EXTERNAL_INTEGRATIONS_SAFE_MODE: true }))
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(warnings.some(w => w.includes('EXTERNAL_INTEGRATIONS_SAFE_MODE=true'))).toBe(true)
  })

  it('produces zero warnings on a fully-configured admin env', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        EODHD_API_KEY: 'eodhd-key',
        TWELVEDATA_API_KEY: 'tw-key',
        FRED_API_KEY: 'fred-key',
        AI_OPENAI_API_KEY: 'sk-real-key',
        AI_ANTHROPIC_API_KEY: 'sk-ant-key',
        NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'real-bearer-token',
        TRANSACTIONS_CATEGORIZATION_ROLLOUT_PERCENT: 100,
      })
    )
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    expect(warnings).toEqual([])
  })

  it('never leaks any secret value in serialized warnings', () => {
    const audit = buildApiFeatureFlagsAudit(
      makeEnv({
        AI_OPENAI_API_KEY: 'sk-shouldnotleak-1234',
        NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'bearer-shouldnotleak',
      })
    )
    const warnings = detectCriticalFeatureFlagWarnings(audit)
    for (const warning of warnings) {
      expect(warning).not.toContain('sk-shouldnotleak-1234')
      expect(warning).not.toContain('bearer-shouldnotleak')
    }
  })
})
