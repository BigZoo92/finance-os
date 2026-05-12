import { describe, expect, it } from 'bun:test'
import { buildWorkerFeatureFlagsAudit } from './feature-flags-audit'

type FakeEnv = Parameters<typeof buildWorkerFeatureFlagsAudit>[0]

const makeEnv = (overrides: Partial<FakeEnv> = {}): FakeEnv =>
  ({
    EXTERNAL_INTEGRATIONS_SAFE_MODE: false,
    WORKER_AUTO_SYNC_ENABLED: false,
    AI_ADVISOR_ENABLED: true,
    AI_ADVISOR_FORCE_LOCAL_ONLY: false,
    AI_KNOWLEDGE_QA_RETRIEVAL_ENABLED: true,
    AI_DAILY_AUTO_RUN_ENABLED: false,
    AI_DAILY_INTERVAL_MS: 900000,
    AI_POST_MORTEM_AUTO_RUN_ENABLED: false,
    AI_POST_MORTEM_CRON: '0 7 * * *',
    AI_POST_MORTEM_TIMEZONE: 'Europe/Paris',
    DAILY_INTELLIGENCE_ENABLED: false,
    DAILY_INTELLIGENCE_CRON: '0 9 * * 1-5',
    DAILY_INTELLIGENCE_TIMEZONE: 'Europe/Paris',
    NEWS_AUTO_INGEST_ENABLED: true,
    NEWS_FETCH_INTERVAL_MS: 14_400_000,
    SIGNALS_SOCIAL_POLLING_ENABLED: false,
    SIGNALS_SOCIAL_POLLING_INTERVAL_MS: 3_600_000,
    ADVISOR_X_SIGNALS_MODE: 'shadow',
    MARKET_DATA_AUTO_REFRESH_ENABLED: false,
    MARKET_DATA_REFRESH_INTERVAL_MS: 21_600_000,
    ATTENTION_SYSTEM_ENABLED: true,
    ATTENTION_REBUILD_AUTO_ENABLED: false,
    ATTENTION_REBUILD_INTERVAL_MS: 600_000,
    ...overrides,
  }) as FakeEnv

describe('buildWorkerFeatureFlagsAudit', () => {
  it('reflects the parsed worker env values verbatim', () => {
    const audit = buildWorkerFeatureFlagsAudit(
      makeEnv({
        AI_POST_MORTEM_AUTO_RUN_ENABLED: true,
        DAILY_INTELLIGENCE_ENABLED: true,
        NEWS_AUTO_INGEST_ENABLED: true,
        ADVISOR_X_SIGNALS_MODE: 'enforced',
      }),
      {}
    )

    expect(audit.aiPostMortemAutoRunEnabled).toBe(true)
    expect(audit.dailyIntelligenceEnabled).toBe(true)
    expect(audit.newsAutoIngestEnabled).toBe(true)
    expect(audit.advisorXSignalsMode).toBe('enforced')
  })

  it('exposes the post-mortem scheduler gate the way the scheduler reads it', () => {
    const audit = buildWorkerFeatureFlagsAudit(
      makeEnv({
        EXTERNAL_INTEGRATIONS_SAFE_MODE: false,
        AI_POST_MORTEM_AUTO_RUN_ENABLED: false,
      }),
      {}
    )

    expect(audit.externalIntegrationsSafeMode).toBe(false)
    expect(audit.aiPostMortemAutoRunEnabled).toBe(false)
  })

  it('marks propagated-only flags as present when raw env carries a value', () => {
    const audit = buildWorkerFeatureFlagsAudit(makeEnv(), {
      ADVISOR_GRAPH_INGEST_ENABLED: 'true',
      TRADING_LAB_GRAPH_INGEST_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(inflation OR rates) lang:en',
      AI_POST_MORTEM_ENABLED: 'true',
      MARKET_DATA_REFRESH_COOLDOWN_SECONDS: '900',
    })

    expect(audit.propagatedOnly.advisorGraphIngestEnabled).toEqual({
      present: true,
      raw: 'true',
    })
    expect(audit.propagatedOnly.tradingLabGraphIngestEnabled.present).toBe(true)
    expect(audit.propagatedOnly.newsProviderXTwitterEnabled).toEqual({
      present: true,
      raw: 'true',
    })
    expect(audit.propagatedOnly.newsProviderXTwitterQuery).toEqual({
      present: true,
      raw: '(inflation OR rates) lang:en',
    })
    expect(audit.propagatedOnly.aiPostMortemEnabled).toEqual({
      present: true,
      raw: 'true',
    })
    expect(audit.propagatedOnly.marketDataRefreshCooldownSeconds).toEqual({
      present: true,
      raw: '900',
    })
  })

  it('marks propagated-only flags as absent when env is empty or missing', () => {
    const audit = buildWorkerFeatureFlagsAudit(makeEnv(), {
      ADVISOR_GRAPH_INGEST_ENABLED: '',
      // TRADING_LAB_GRAPH_INGEST_ENABLED intentionally not set
    })

    expect(audit.propagatedOnly.advisorGraphIngestEnabled).toEqual({
      present: false,
      raw: null,
    })
    expect(audit.propagatedOnly.tradingLabGraphIngestEnabled).toEqual({
      present: false,
      raw: null,
    })
  })

  it('never includes any secret-bearing field', () => {
    const audit = buildWorkerFeatureFlagsAudit(makeEnv(), {
      DATABASE_URL: 'postgres://user:password@db/finance_os',
      REDIS_URL: 'redis://:secret@redis:6379',
      AUTH_SESSION_SECRET: 'super-secret',
      APP_ENCRYPTION_KEY: 'super-secret-key',
      AI_OPENAI_API_KEY: 'sk-xxx',
      POWENS_CLIENT_SECRET: 'powens-secret',
    })

    const serialized = JSON.stringify(audit)
    expect(serialized).not.toContain('password')
    expect(serialized).not.toContain('super-secret')
    expect(serialized).not.toContain('sk-xxx')
    expect(serialized).not.toContain('powens-secret')
  })
})
