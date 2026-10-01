import { afterEach, describe, expect, it } from 'bun:test'
import { getApiEnv, getWorkerEnv } from './index'

/*
 * Parsing behaviour of the API and worker environments on Zod 4. Every case
 * replaces the process environment with a synthetic one; the root .env is
 * never loaded (FINANCE_OS_SKIP_ROOT_ENV).
 */

const savedEnv = process.env

const withEnv = <T>(env: Record<string, string>, fn: () => T): T => {
  process.env = { ...env, FINANCE_OS_SKIP_ROOT_ENV: '1' }
  return fn()
}

afterEach(() => {
  process.env = savedEnv
})

const powens = {
  APP_ENCRYPTION_KEY: '0123456789abcdef0123456789abcdef',
  POWENS_CLIENT_ID: 'test-client',
  POWENS_CLIENT_SECRET: 'test-secret',
  POWENS_BASE_URL: 'https://powens.example.test',
  POWENS_DOMAIN: 'demo.powens.test',
  POWENS_REDIRECT_URI_DEV: 'http://127.0.0.1:3000/integrations/powens/callback',
}

const workerBase = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgres://user:pass@127.0.0.1:1/db',
  REDIS_URL: 'redis://127.0.0.1:1',
  API_INTERNAL_URL: 'http://127.0.0.1:3001',
  ...powens,
}

const apiBase = {
  NODE_ENV: 'test',
  APP_URL: 'http://127.0.0.1:3000/',
  DATABASE_URL: workerBase.DATABASE_URL,
  REDIS_URL: workerBase.REDIS_URL,
  AUTH_ADMIN_EMAIL: 'admin@example.test',
  AUTH_ADMIN_PASSWORD_HASH: 'pbkdf2$sha256$100000$c2FsdA$aGFzaA',
  AUTH_SESSION_SECRET: 'test-session-secret-123456789012345678',
  ...powens,
}

const errorOf = (fn: () => unknown): string => {
  try {
    fn()
  } catch (error) {
    return error instanceof Error ? error.message : String(error)
  }
  throw new Error('expected the environment to be rejected')
}

describe('getWorkerEnv', () => {
  it('applies the documented defaults to a minimal environment', () => {
    const env = withEnv(workerBase, getWorkerEnv)
    expect(env.WORKER_HEARTBEAT_MS).toBe(30_000)
    expect(env.NEWS_AUTO_INGEST_ENABLED).toBe(true)
    expect(env.WORKER_AUTO_SYNC_ENABLED).toBe(false)
    expect(env.POWENS_SYNC_DISABLED_PROVIDERS).toEqual([])
    expect(env.IBKR_FLEX_QUERY_IDS).toEqual([])
    expect(env.EXTERNAL_INVESTMENTS_VALUATION_TARGET_CURRENCY).toBe('EUR')
    expect(env.POWENS_WEBVIEW_BASE_URL).toBe('https://webview.powens.com/connect')
    expect(env.ADVISOR_X_SIGNALS_MODE).toBe('shadow')
  })

  it('treats an empty value as unset and normalizes flags, lists and currencies', () => {
    const env = withEnv(
      {
        ...workerBase,
        WORKER_HEARTBEAT_MS: '',
        WORKER_AUTO_SYNC_ENABLED: 'yes',
        NEWS_AUTO_INGEST_ENABLED: 'false',
        POWENS_SYNC_DISABLED_PROVIDERS: ' a, b ,,c ',
        IBKR_FLEX_QUERY_IDS: '101, 102',
        EXTERNAL_INVESTMENTS_VALUATION_TARGET_CURRENCY: 'usd',
      },
      getWorkerEnv
    )
    expect(env.WORKER_HEARTBEAT_MS).toBe(30_000)
    expect(env.WORKER_AUTO_SYNC_ENABLED).toBe(true)
    expect(env.NEWS_AUTO_INGEST_ENABLED).toBe(false)
    expect(env.POWENS_SYNC_DISABLED_PROVIDERS).toEqual(['a', 'b', 'c'])
    expect(env.IBKR_FLEX_QUERY_IDS).toEqual(['101', '102'])
    expect(env.EXTERNAL_INVESTMENTS_VALUATION_TARGET_CURRENCY).toBe('USD')
  })

  it('trims padded URLs', () => {
    const env = withEnv(
      { ...workerBase, API_INTERNAL_URL: ' http://127.0.0.1:3001 ' },
      getWorkerEnv
    )
    expect(env.API_INTERNAL_URL).toBe('http://127.0.0.1:3001')
  })

  it('tells a missing required URL from an invalid one', () => {
    const { API_INTERNAL_URL: _unused, ...withoutUrl } = workerBase
    expect(errorOf(() => withEnv(withoutUrl, getWorkerEnv))).toContain(
      'API_INTERNAL_URL is required'
    )
    expect(
      errorOf(() => withEnv({ ...workerBase, API_INTERNAL_URL: 'not a url' }, getWorkerEnv))
    ).toContain('API_INTERNAL_URL must be a valid URL')
  })

  it('rejects integers beyond the safe range and non-numeric values', () => {
    expect(
      errorOf(() =>
        withEnv({ ...workerBase, WORKER_HEARTBEAT_MS: '9007199254740993' }, getWorkerEnv)
      )
    ).toContain('WORKER_HEARTBEAT_MS')
    expect(
      errorOf(() => withEnv({ ...workerBase, WORKER_HEARTBEAT_MS: 'abc' }, getWorkerEnv))
    ).toContain('WORKER_HEARTBEAT_MS')
  })
})

describe('getApiEnv', () => {
  it('derives the public URLs from APP_URL', () => {
    const env = withEnv(apiBase, getApiEnv)
    expect(env.APP_URL).toBe('http://127.0.0.1:3000')
    expect(env.WEB_URL).toBe('http://127.0.0.1:3000')
    expect(env.API_URL).toBe('http://127.0.0.1:3000/api')
    expect(env.NEWS_SCRAPER_USER_AGENT).toBe('finance-os-news/1.0 (+http://127.0.0.1:3000)')
    expect(env.AUTH_PASSWORD_HASH_SOURCE).toBe('AUTH_ADMIN_PASSWORD_HASH')
  })

  it('rejects an infinite budget instead of silently removing the cap', () => {
    expect(
      errorOf(() => withEnv({ ...apiBase, X_MONTHLY_BUDGET_USD: 'Infinity' }, getApiEnv))
    ).toContain('X_MONTHLY_BUDGET_USD')
  })

  it('prefers the base64 admin hash and decodes it', () => {
    const env = withEnv(
      {
        ...apiBase,
        AUTH_ADMIN_PASSWORD_HASH_B64: Buffer.from('$argon2id$v=19$encoded').toString('base64'),
      },
      getApiEnv
    )
    expect(env.AUTH_PASSWORD_HASH).toBe('$argon2id$v=19$encoded')
    expect(env.AUTH_PASSWORD_HASH_SOURCE).toBe('AUTH_ADMIN_PASSWORD_HASH_B64')
  })

  it('names the variable of an invalid hash without echoing any part of its value', () => {
    const message = errorOf(() =>
      withEnv({ ...apiBase, AUTH_ADMIN_PASSWORD_HASH: 'plaintext-password-1234' }, getApiEnv)
    )
    expect(message).toContain('AUTH_ADMIN_PASSWORD_HASH must start with $argon2 or pbkdf2$')
    expect(message).not.toContain('plaintext')
  })

  it('reports a missing hash and an undecodable base64 hash', () => {
    const { AUTH_ADMIN_PASSWORD_HASH: _unused, ...withoutHash } = apiBase
    expect(errorOf(() => withEnv(withoutHash, getApiEnv))).toContain('is required')
    expect(
      errorOf(() => withEnv({ ...withoutHash, AUTH_PASSWORD_HASH_B64: 'not-base64!' }, getApiEnv))
    ).toContain('AUTH_PASSWORD_HASH_B64 is not valid base64')
  })
})
