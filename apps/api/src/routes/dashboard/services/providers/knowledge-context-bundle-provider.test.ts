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
import type { KnowledgeServiceClientConfig } from '../knowledge-service-client'
import { createKnowledgeContextBundleProvider } from './knowledge-context-bundle-provider'

const baseConfig: KnowledgeServiceClientConfig = {
  enabled: true,
  url: 'http://knowledge.local',
  timeoutMs: 1_000,
  maxContextTokens: 1024,
  retrievalMode: 'hybrid',
  maxPathDepth: 3,
  minConfidence: 0.5,
}

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

describe('createKnowledgeContextBundleProvider', () => {
  it('passes the contract harness and exposes a non-forbidden capability', () => {
    const { target } = captureLogs()
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => new Response('{}', { status: 200 }),
    }) as unknown as Provider
    assertProviderContract(provider)
    assertProviderDoesNotExposeForbiddenCapabilities(provider)
    expect(String(provider.id)).toBe('knowledge-service')
    expect(provider.capability).toBe('knowledge.context_bundle.read')
  })

  it('returns disabled_by_flag when config.enabled is false and never calls fetch', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createKnowledgeContextBundleProvider({
      config: { ...baseConfig, enabled: false },
      logTarget: target,
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
    })
    const result = await provider.call({ query: 'q', mode: 'admin' }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('disabled_by_flag')
      expect(result.error.retryable).toBe(false)
    }
    expect(fetchCalls).toBe(0)
    assertProviderLogsSafe(lines)
    expect(provider.getHealth().status).toBe('down')
    expect(provider.getHealth().lastErrorCode).toBe('disabled_by_flag')
  })

  it('refuses demo callers with demo_mode_forbidden', async () => {
    const { target, lines } = captureLogs()
    let fetchCalls = 0
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => {
        fetchCalls += 1
        return new Response('{}', { status: 200 })
      },
    })
    const result = await provider.call({ query: 'q', mode: 'demo' }, ctx({ mode: 'demo' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('demo_mode_forbidden')
    }
    expect(fetchCalls).toBe(0)
    assertProviderLogsSafe(lines)
  })

  it('maps a successful upstream call to providerOk and updates health', async () => {
    const { target, lines } = captureLogs()
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () =>
        new Response(JSON.stringify({ items: [{ id: 'a' }] }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      now: () => new Date('2026-05-09T12:00:00Z'),
    })
    const result = await provider.call(
      { query: 'rebalance', mode: 'admin' },
      ctx({ mode: 'admin' })
    )
    assertProviderResultSafe(result)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.data.bundle).toEqual({ items: [{ id: 'a' }] })
      expect(result.data.retrievedAt).toBe('2026-05-09T12:00:00.000Z')
      expect(String(result.meta.sources[0]?.providerId)).toBe('knowledge-service')
      expect(result.meta.sources[0]?.fromCache).toBe(false)
    }
    expect(provider.getHealth().status).toBe('ok')
    expect(provider.getHealth().lastSuccessAt).toBe('2026-05-09T12:00:00.000Z')
    assertProviderLogsSafe(lines)
  })

  it('maps HTTP 5xx to transient and HTTP 401 to auth_failed', async () => {
    const { target, lines } = captureLogs()
    let nextStatus = 503
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => new Response('{"error":"x"}', { status: nextStatus }),
    })
    const r1 = await provider.call({ query: 'q', mode: 'admin' }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(r1)
    expect(r1.ok).toBe(false)
    if (!r1.ok) expect(r1.error.code).toBe('transient')
    expect(provider.getHealth().status).toBe('degraded')

    nextStatus = 401
    const r2 = await provider.call({ query: 'q', mode: 'admin' }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(r2)
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.code).toBe('auth_failed')
    expect(provider.getHealth().status).toBe('down')

    assertProviderLogsSafe(lines)
  })

  it('does not log raw upstream payload fields', async () => {
    const { target, lines } = captureLogs()
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            access_token: 'leaked',
            authorization: 'Bearer abc',
            items: [{ note: 'free-form note' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        ),
    })
    const result = await provider.call({ query: 'q', mode: 'admin' }, ctx({ mode: 'admin' }))
    expect(result.ok).toBe(true)
    // No log line should ever contain the upstream body, regardless of whether the wrapper
    // returns it inside `data` (which is application-internal). Logs are asserted via the
    // shared invariant harness.
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      expect(stringified).not.toContain('leaked')
      expect(stringified).not.toContain('Bearer')
      expect(stringified).not.toContain('free-form note')
    }
  })

  it('maps thrown network errors to provider_unavailable', async () => {
    const { target, lines } = captureLogs()
    const provider = createKnowledgeContextBundleProvider({
      config: baseConfig,
      logTarget: target,
      fetchImpl: async () => {
        throw new TypeError('fetch failed')
      },
    })
    const result = await provider.call({ query: 'q', mode: 'admin' }, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(['transient', 'provider_unavailable']).toContain(result.error.code)
    }
    expect(provider.getHealth().status).toBe('degraded')
    assertProviderLogsSafe(lines)
  })
})
