import { describe, expect, it } from 'bun:test'
import { assertProductionApiEnv, describeResolvedAuthPasswordHash } from './index'

describe('describeResolvedAuthPasswordHash', () => {
  it('exposes only the source variable and algorithm family, never hash material', () => {
    const hash = '$argon2id$v=19$m=65536,t=3,p=4$c2FsdHNhbHRzYWx0$aGFzaGhhc2hoYXNoaGFzaA'
    const described = describeResolvedAuthPasswordHash({
      hash,
      source: 'AUTH_ADMIN_PASSWORD_HASH_B64',
    })

    expect(described).toEqual({ source: 'AUTH_ADMIN_PASSWORD_HASH_B64', algorithm: 'argon2' })
    const serialized = JSON.stringify(described)
    expect(serialized).not.toContain('argon2id')
    expect(serialized).not.toContain('c2FsdHNhbHQ')
    expect(serialized).not.toContain(String(hash.length))
  })

  it('classifies pbkdf2 hashes without leaking them', () => {
    expect(
      describeResolvedAuthPasswordHash({
        hash: 'pbkdf2$sha256$100000$c2FsdA$aGFzaA',
        source: 'AUTH_PASSWORD_HASH',
      })
    ).toEqual({ source: 'AUTH_PASSWORD_HASH', algorithm: 'pbkdf2' })
  })
})

describe('assertProductionApiEnv', () => {
  const base = {
    NODE_ENV: 'production' as const,
    POWENS_REDIRECT_URI_PROD: 'https://finance-os.example/integrations/powens/callback',
    API_ALLOW_IN_MEMORY_REDIS: false,
    KNOWLEDGE_SERVICE_ENABLED: false,
    QUANT_SERVICE_ENABLED: false,
  }

  it('requires INTERNAL_SERVICE_TOKEN in production when a Python service is enabled', () => {
    expect(() =>
      assertProductionApiEnv({ ...base, KNOWLEDGE_SERVICE_ENABLED: true })
    ).toThrow(/INTERNAL_SERVICE_TOKEN is required/)
    expect(() =>
      assertProductionApiEnv({ ...base, QUANT_SERVICE_ENABLED: true })
    ).toThrow(/INTERNAL_SERVICE_TOKEN is required/)
    expect(() =>
      assertProductionApiEnv({
        ...base,
        QUANT_SERVICE_ENABLED: true,
        INTERNAL_SERVICE_TOKEN: 'a-token-with-enough-entropy',
      })
    ).not.toThrow()
  })

  it('does not require the token when no Python service is enabled or outside production', () => {
    expect(() => assertProductionApiEnv(base)).not.toThrow()
    expect(() =>
      assertProductionApiEnv({ ...base, NODE_ENV: 'development', KNOWLEDGE_SERVICE_ENABLED: true })
    ).not.toThrow()
  })
})
