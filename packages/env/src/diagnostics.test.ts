import { describe, expect, it } from 'bun:test'
import {
  diagnoseServiceEnv,
  evaluateFeatureRequirements,
  FEATURE_REQUIREMENTS,
  isPlaceholderValue,
} from './diagnostics'

describe('isPlaceholderValue', () => {
  it('flags common placeholder shapes', () => {
    expect(isPlaceholderValue('TODO')).toBe(true)
    expect(isPlaceholderValue('changeme')).toBe(true)
    expect(isPlaceholderValue('CHANGE_ME')).toBe(true)
    expect(isPlaceholderValue('xxxxxxxx')).toBe(true)
    expect(isPlaceholderValue('your-api-key-here')).toBe(true)
    expect(isPlaceholderValue('<token>')).toBe(true)
    expect(isPlaceholderValue('[example]')).toBe(true)
    expect(isPlaceholderValue('TON_TOKEN')).toBe(true)
  })

  it('does not flag real-looking values', () => {
    expect(isPlaceholderValue('sk-1A2b3C4d5E6f7G8h9I0j')).toBe(false)
    expect(isPlaceholderValue('https://api.example.com')).toBe(false)
    expect(isPlaceholderValue('')).toBe(false)
    expect(isPlaceholderValue(undefined)).toBe(false)
  })
})

describe('evaluateFeatureRequirements', () => {
  it('flags X/Twitter enabled without bearer token', () => {
    const issues = evaluateFeatureRequirements({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
    })
    const xIssue = issues.find(
      i => i.envName === 'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN' && i.level === 'error'
    )
    expect(xIssue).toBeDefined()
    expect(xIssue?.code).toBe('FEATURE_ENABLED_WITHOUT_SECRET')
    expect(xIssue?.service).toBe('api')
  })

  it('does not flag X/Twitter when disabled', () => {
    const issues = evaluateFeatureRequirements({
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'false',
    })
    expect(issues.some(i => i.envName === 'NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN')).toBe(false)
  })

  it('flags X daily previous-day sync enabled without budget caps', () => {
    const issues = evaluateFeatureRequirements({
      X_DAILY_PREVIOUS_DAY_SYNC_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'AAAAAA',
    })
    expect(
      issues.some(i => i.envName === 'X_DAILY_BUDGET_USD' && i.level === 'error')
    ).toBe(true)
    expect(
      issues.some(i => i.envName === 'X_MONTHLY_BUDGET_USD' && i.level === 'error')
    ).toBe(true)
  })

  it('flags placeholder values on required secrets', () => {
    const issues = evaluateFeatureRequirements({
      MARKET_DATA_EODHD_ENABLED: 'true',
      EODHD_API_KEY: 'changeme',
    })
    expect(
      issues.some(i => i.envName === 'EODHD_API_KEY' && i.code === 'PLACEHOLDER_VALUE')
    ).toBe(true)
  })

  it('passes when feature enabled and required secret looks real', () => {
    const issues = evaluateFeatureRequirements({
      MARKET_DATA_EODHD_ENABLED: 'true',
      EODHD_API_KEY: 'real-looking-key-1234567890',
    })
    expect(
      issues.some(
        i =>
          i.envName === 'EODHD_API_KEY' &&
          (i.code === 'FEATURE_ENABLED_WITHOUT_SECRET' || i.code === 'PLACEHOLDER_VALUE')
      )
    ).toBe(false)
  })

  it('SEC provider requires a User-Agent', () => {
    const issues = evaluateFeatureRequirements({ NEWS_PROVIDER_SEC_ENABLED: 'true' })
    expect(issues.some(i => i.envName === 'SEC_USER_AGENT' && i.level === 'error')).toBe(true)
  })

  it('KNOWLEDGE_SERVICE_ENABLED without URL is an error on api', () => {
    const issues = evaluateFeatureRequirements({ KNOWLEDGE_SERVICE_ENABLED: 'true' })
    const issue = issues.find(i => i.envName === 'KNOWLEDGE_SERVICE_URL' && i.level === 'error')
    expect(issue).toBeDefined()
    expect(issue?.service).toBe('api')
  })

  it('every feature requirement maps to a known executing service', () => {
    for (const req of FEATURE_REQUIREMENTS) {
      const issues = evaluateFeatureRequirements({ [req.flagKey]: 'true' })
      for (const issue of issues) {
        expect(['api', 'worker', 'web', 'knowledge-service', 'quant-service']).toContain(
          issue.service
        )
      }
    }
  })
})

describe('diagnoseServiceEnv', () => {
  it('returns features owned by the queried service only', () => {
    const report = diagnoseServiceEnv('api', {
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      MARKET_DATA_EODHD_ENABLED: 'true',
    })
    expect(report.service).toBe('api')
    expect(report.features.some(f => f.flagKey === 'NEWS_PROVIDER_X_TWITTER_ENABLED')).toBe(true)
    expect(report.features.some(f => f.flagKey === 'MARKET_DATA_EODHD_ENABLED')).toBe(true)
  })

  it('canRun=false when secret is missing, with a clear blocked reason', () => {
    const report = diagnoseServiceEnv('api', {
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
    })
    const feature = report.features.find(f => f.flagKey === 'NEWS_PROVIDER_X_TWITTER_ENABLED')
    expect(feature).toBeDefined()
    expect(feature?.enabled).toBe(true)
    expect(feature?.canRun).toBe(false)
    expect(feature?.reasonIfBlocked).toMatch(/NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN/)
  })

  it('canRun=true when feature enabled and secret present', () => {
    const report = diagnoseServiceEnv('api', {
      NEWS_PROVIDER_X_TWITTER_ENABLED: 'true',
      NEWS_PROVIDER_X_TWITTER_BEARER_TOKEN: 'AAAAA-real-token',
    })
    const feature = report.features.find(f => f.flagKey === 'NEWS_PROVIDER_X_TWITTER_ENABLED')
    expect(feature).toBeDefined()
    expect(feature?.canRun).toBe(true)
    expect(feature?.reasonIfBlocked).toBeNull()
  })

  it('flags forbidden leak of provider secret onto web container', () => {
    const report = diagnoseServiceEnv('web', {
      EODHD_API_KEY: 'leaked-secret',
    })
    expect(
      report.issues.some(
        i => i.envName === 'EODHD_API_KEY' && i.code === 'FORBIDDEN_KEY_LEAKED_TO_SERVICE'
      )
    ).toBe(true)
  })
})
