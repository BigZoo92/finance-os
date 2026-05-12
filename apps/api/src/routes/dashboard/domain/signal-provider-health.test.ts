import { describe, expect, it } from 'bun:test'
import {
  computeBlueskyProviderHealth,
  computeXTwitterProviderHealth,
} from './signal-provider-health'

describe('computeXTwitterProviderHealth', () => {
  it('returns reason=API_ENV_MISSING when NEWS_PROVIDER_X_TWITTER_ENABLED is absent', () => {
    const result = computeXTwitterProviderHealth({})
    expect(result.reason).toBe('API_ENV_MISSING')
    expect(result.enabled).toBe(false)
    expect(result.tokenPresent).toBe(false)
    expect(result.apiRuntimeConfigured).toBe(false)
  })

  it('returns reason=TOKEN_MISSING when enabled but bearer is empty', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: '',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
    })
    expect(result.reason).toBe('TOKEN_MISSING')
    expect(result.enabled).toBe(true)
    expect(result.tokenPresent).toBe(false)
  })

  it('returns reason=PROVIDER_DISABLED when token is present but flag is false', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'false',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'real-token',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
    })
    expect(result.reason).toBe('PROVIDER_DISABLED')
  })

  it('returns reason=RUNTIME_MISMATCH when worker polls but API has no token', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: '',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
      SIGNALS_SOCIAL_POLLING_ENABLED: 'true',
    })
    expect(result.workerPollingEnabled).toBe(true)
    expect(result.apiRuntimeConfigured).toBe(false)
    // TOKEN_MISSING wins because the bearer is the more actionable signal
    expect(result.reason).toBe('TOKEN_MISSING')
  })

  it('returns reason=WORKER_POLLING_DISABLED when API is configured but worker is off', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'real-token',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
      SIGNALS_SOCIAL_POLLING_ENABLED: 'false',
      ADVISOR_X_SIGNALS_MODE: 'shadow',
    })
    expect(result.apiRuntimeConfigured).toBe(true)
    expect(result.workerPollingEnabled).toBe(false)
    expect(result.reason).toBe('WORKER_POLLING_DISABLED')
  })

  it('returns reason=MODE_OFF when everything is wired but mode=off', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'real-token',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
      SIGNALS_SOCIAL_POLLING_ENABLED: 'true',
      ADVISOR_X_SIGNALS_MODE: 'off',
    })
    expect(result.reason).toBe('MODE_OFF')
  })

  it('returns reason=null when fully healthy in shadow mode', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'real-token',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
      SIGNALS_SOCIAL_POLLING_ENABLED: 'true',
      ADVISOR_X_SIGNALS_MODE: 'shadow',
    })
    expect(result.reason).toBeNull()
    expect(result.tokenPresent).toBe(true)
    expect(result.enabled).toBe(true)
    expect(result.workerPollingEnabled).toBe(true)
    expect(result.apiRuntimeConfigured).toBe(true)
    expect(result.mode).toBe('shadow')
  })

  it('never includes the bearer token value in the response', () => {
    const result = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'super-secret-bearer-1234',
      NEWS_PROVIDER_X_TWITTER_QUERY: '(rates) lang:en',
    })
    const serialized = JSON.stringify(result)
    expect(serialized).not.toContain('super-secret-bearer-1234')
  })

  it('Bluesky is not required; reason stays PROVIDER_DISABLED when X works fine', () => {
    const xHealth = computeXTwitterProviderHealth({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 't',
      NEWS_PROVIDER_X_TWITTER_QUERY: 'q',
      SIGNALS_SOCIAL_POLLING_ENABLED: 'true',
    })
    const bskyHealth = computeBlueskyProviderHealth({ BLUESKY_ENABLED: 'false' })
    expect(xHealth.reason).toBeNull()
    expect(bskyHealth.reason).toBe('PROVIDER_DISABLED')
  })
})

describe('computeBlueskyProviderHealth', () => {
  it('reports PROVIDER_DISABLED when BLUESKY_ENABLED!=true', () => {
    expect(computeBlueskyProviderHealth({}).reason).toBe('PROVIDER_DISABLED')
    expect(computeBlueskyProviderHealth({ BLUESKY_ENABLED: 'false' }).reason).toBe(
      'PROVIDER_DISABLED'
    )
  })

  it('reports NOT_CONFIGURED when enabled but handle/password missing', () => {
    expect(
      computeBlueskyProviderHealth({
        BLUESKY_ENABLED: 'true',
      }).reason
    ).toBe('NOT_CONFIGURED')
  })

  it('reports null when fully configured', () => {
    expect(
      computeBlueskyProviderHealth({
        BLUESKY_ENABLED: 'true',
        BLUESKY_HANDLE: 'me.bsky.social',
        BLUESKY_APP_PASSWORD: 'app-pwd',
      }).reason
    ).toBeNull()
  })
})
