import { describe, expect, it } from 'bun:test'
import type { Provider, ProviderCallContext } from '@finance-os/provider-contract'
import {
  assertProviderContract,
  assertProviderDoesNotExposeForbiddenCapabilities,
  assertProviderLogsSafe,
  assertProviderResultSafe,
  type CapturedLogLine,
  type ProviderLogTarget,
} from '@finance-os/provider-runtime'
import type { NewsProviderRawItem } from '../../domain/news-types'
import type { NewsProviderAdapter } from '../news-provider-types'
import { createNewsServiceProvider } from './news-service-provider'

const captureLogs = (): { target: ProviderLogTarget; lines: CapturedLogLine[] } => {
  const lines: CapturedLogLine[] = []
  return {
    lines,
    target: {
      logEvent: ({ level, msg, ...rest }) => {
        lines.push({ level: String(level), msg: String(msg), ...rest })
      },
    },
  }
}

const ctx = (overrides: Partial<ProviderCallContext> = {}): ProviderCallContext => ({
  mode: 'admin',
  requestId: 'req-test',
  now: new Date('2026-05-09T12:00:00Z'),
  reason: 'unit-test',
  ...overrides,
})

const SECRET_URL = 'https://api.example/v1/news?token=SECRET-TOKEN-7&id=42'
const SECRET_BODY = 'RAW ARTICLE BODY WITH SECRET TOKEN-7'

const makeRawItem = (
  provider: NewsProviderRawItem['provider'],
  offset = 0
): NewsProviderRawItem => ({
  provider,
  providerArticleId: `ext-${offset}`,
  providerUrl: SECRET_URL,
  canonicalUrl: SECRET_URL,
  sourceName: 'unit-test',
  sourceDomain: 'example.test',
  sourceType: 'media',
  title: SECRET_BODY,
  summary: SECRET_BODY,
  contentSnippet: SECRET_BODY,
  language: 'en',
  country: null,
  region: null,
  geoScope: 'global',
  publishedAt: new Date('2026-05-09T11:00:00Z'),
  metadata: null,
  rawPayload: null,
})

const makeAdapter = (
  provider: NewsProviderRawItem['provider'],
  overrides: Partial<NewsProviderAdapter> = {}
): NewsProviderAdapter => ({
  provider,
  enabled: true,
  cooldownMs: 0,
  fetchItems: async () => [makeRawItem(provider)],
  ...overrides,
})

describe('createNewsServiceProvider', () => {
  it('passes the contract harness and exposes a non-forbidden capability', () => {
    const { target } = captureLogs()
    const provider = createNewsServiceProvider({
      adapters: [makeAdapter('hn_algolia')],
      logTarget: target,
    }) as unknown as Provider
    assertProviderContract(provider)
    assertProviderDoesNotExposeForbiddenCapabilities(provider)
    expect(String(provider.id)).toBe('news-service')
    expect(provider.capability).toBe('news.items.read')
  })

  it('demo mode returns deterministic snapshot without calling any adapter', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createNewsServiceProvider({
      adapters: [
        makeAdapter('hn_algolia', {
          fetchItems: async () => {
            fetchCalls += 1
            return []
          },
        }),
      ],
      logTarget: target,
      now: () => new Date('2026-05-09T12:00:00Z'),
    })
    const result = await provider.call({}, ctx({ mode: 'demo' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.meta.sources[0]?.fromCache).toBe(true)
      expect(result.data.fetchedCount).toBe(0)
      expect(result.data.providers).toHaveLength(1)
      expect(result.data.providers[0]?.status).toBe('skipped')
      expect(result.data.retrievedAt).toBe('2026-05-09T12:00:00.000Z')
    }
    expect(fetchCalls).toBe(0)
    assertProviderLogsSafe(lines)
  })

  it('returns disabled_by_flag when no adapter is enabled and never calls fetchItems', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createNewsServiceProvider({
      adapters: [
        makeAdapter('hn_algolia', {
          enabled: false,
          fetchItems: async () => {
            fetchCalls += 1
            return []
          },
        }),
        makeAdapter('gdelt_doc', { enabled: false }),
      ],
      logTarget: target,
    })
    const result = await provider.call({}, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('disabled_by_flag')
      expect(result.error.retryable).toBe(false)
    }
    expect(fetchCalls).toBe(0)
    expect(provider.getHealth().status).toBe('down')
    assertProviderLogsSafe(lines)
  })

  it('admin success aggregates per-source counts and never echoes raw item content', async () => {
    const { target, lines } = captureLogs()
    const provider = createNewsServiceProvider({
      adapters: [
        makeAdapter('hn_algolia', {
          fetchItems: async () => [makeRawItem('hn_algolia', 0), makeRawItem('hn_algolia', 1)],
        }),
        makeAdapter('gdelt_doc', { enabled: false }),
        makeAdapter('ecb_rss', { fetchItems: async () => [makeRawItem('ecb_rss', 2)] }),
      ],
      logTarget: target,
      now: () => new Date('2026-05-09T12:00:00Z'),
    })
    const result = await provider.call({ maxItemsPerProvider: 5 }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fetchedCount).toBe(3)
      expect(result.data.providers).toHaveLength(3)
      const hn = result.data.providers.find(p => p.provider === 'hn_algolia')
      expect(hn?.status).toBe('success')
      expect(hn?.fetchedCount).toBe(2)
      const gdelt = result.data.providers.find(p => p.provider === 'gdelt_doc')
      expect(gdelt?.status).toBe('skipped')
      expect(gdelt?.enabled).toBe(false)
      // Raw article content / URL must never appear in the output DTO.
      const stringified = JSON.stringify(result.data)
      expect(stringified).not.toContain(SECRET_BODY)
      expect(stringified).not.toContain('SECRET-TOKEN-7')
    }
    expect(provider.getHealth().status).toBe('ok')
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      expect(stringified).not.toContain(SECRET_BODY)
      expect(stringified).not.toContain('SECRET-TOKEN-7')
    }
  })

  it('returns provider_unavailable when every enabled adapter throws', async () => {
    const { target, lines } = captureLogs()
    const provider = createNewsServiceProvider({
      adapters: [
        makeAdapter('hn_algolia', {
          fetchItems: async () => {
            throw new Error(`upstream blew up at ${SECRET_URL} body=${SECRET_BODY}`)
          },
        }),
        makeAdapter('gdelt_doc', {
          fetchItems: async () => {
            throw new Error('GDELT 502 body=raw payload echo')
          },
        }),
      ],
      logTarget: target,
    })
    const result = await provider.call({}, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('provider_unavailable')
      expect(result.error.retryable).toBe(true)
    }
    expect(provider.getHealth().status).toBe('down')
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      expect(stringified).not.toContain('SECRET-TOKEN-7')
      expect(stringified).not.toContain(SECRET_BODY)
      expect(stringified).not.toContain('raw payload echo')
    }
  })

  it('marks health as degraded when some adapters succeed and some fail', async () => {
    const { target, lines } = captureLogs()
    const provider = createNewsServiceProvider({
      adapters: [
        makeAdapter('hn_algolia', { fetchItems: async () => [makeRawItem('hn_algolia')] }),
        makeAdapter('gdelt_doc', {
          fetchItems: async () => {
            throw new Error('boom')
          },
        }),
      ],
      logTarget: target,
    })
    const result = await provider.call({}, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.fetchedCount).toBe(1)
      const failed = result.data.providers.find(p => p.provider === 'gdelt_doc')
      expect(failed?.status).toBe('failed')
      expect(failed?.errorCode).toBe('provider_unavailable')
    }
    expect(provider.getHealth().status).toBe('degraded')
    assertProviderLogsSafe(lines)
  })
})
