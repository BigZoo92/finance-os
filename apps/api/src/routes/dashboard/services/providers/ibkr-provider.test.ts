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
import type { ExternalInvestmentsProviderSnapshot } from './external-investments-provider-shared'
import { createIbkrProvider } from './ibkr-provider'

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

const SECRET_FLEX_TOKEN = 'IBKR-FLEX-TOKEN-SENTINEL'
const SECRET_QUERY_ID = 'IBKR-QUERY-ID-9999'
const SECRET_XML_BODY = '<RAW_FLEX_XML token="IBKR-FLEX-TOKEN-SENTINEL"/>'

const healthySnapshot: ExternalInvestmentsProviderSnapshot = {
  enabled: true,
  status: 'healthy',
  lastSuccessAt: '2026-05-09T11:30:00.000Z',
  lastFailureAt: null,
  credentialConfigured: true,
  successCount: 12,
  failureCount: 0,
}

describe('createIbkrProvider', () => {
  it('passes the contract harness and exposes only external_investments.positions.read', () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => null,
      logTarget: target,
    })
    assertProviderContract(handle.provider as unknown as Provider)
    assertProviderDoesNotExposeForbiddenCapabilities(handle.provider as unknown as Provider)
    expect(String(handle.provider.id)).toBe('ibkr')
    expect(handle.provider.capability).toBe('external_investments.positions.read')
  })

  it('initial health (before refresh) is degraded with unconfigured caveat', () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => null,
      logTarget: target,
    })
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
  })

  it('null snapshot maps to degraded + unconfigured (NOT down)', async () => {
    const { target, lines } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => null,
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
    assertProviderLogsSafe(lines)
  })

  it('healthy snapshot maps to ok with lastSuccessAt', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => healthySnapshot,
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('ok')
    expect(health.lastErrorCode).toBeNull()
    expect(health.lastSuccessAt).toBe('2026-05-09T11:30:00.000Z')
  })

  it('credential not configured maps to degraded + unconfigured (NOT down)', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => ({
        ...healthySnapshot,
        credentialConfigured: false,
      }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
  })

  it('disabled provider maps to degraded + disabled_by_flag (NOT down)', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => ({ ...healthySnapshot, enabled: false }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('disabled_by_flag')
  })

  it('idle (configured + never synced) maps to degraded + unconfigured (NOT down)', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => ({
        ...healthySnapshot,
        status: 'idle',
        lastSuccessAt: null,
        successCount: 0,
      }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
  })

  it('failing snapshot (configured + enabled + repeatedly failing) maps to down', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => ({
        ...healthySnapshot,
        status: 'failing',
        lastFailureAt: '2026-05-09T11:00:00.000Z',
        failureCount: 5,
      }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('down')
    expect(health.lastErrorCode).toBe('provider_unavailable')
  })

  it('degraded snapshot maps to degraded + transient', async () => {
    const { target } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => ({ ...healthySnapshot, status: 'degraded' }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('transient')
  })

  it('refreshHealth swallows repository exceptions and downgrades to degraded', async () => {
    const { target, lines } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => {
        throw new Error(`db boom flexToken=${SECRET_FLEX_TOKEN} body=${SECRET_XML_BODY}`)
      },
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('transient')
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      expect(stringified).not.toContain(SECRET_FLEX_TOKEN)
      expect(stringified).not.toContain(SECRET_XML_BODY)
      expect(stringified).not.toContain(SECRET_QUERY_ID)
    }
  })

  it('call() returns unsupported_capability with deferred_read_routing reason', async () => {
    const { target, lines } = captureLogs()
    let snapshotCalls = 0
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => {
        snapshotCalls += 1
        return null
      },
      logTarget: target,
    })
    const result = await handle.provider.call({}, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported_capability')
      expect(result.error.retryable).toBe(false)
      expect(JSON.stringify(result.error)).toContain('deferred_read_routing')
    }
    expect(snapshotCalls).toBe(0)
    assertProviderLogsSafe(lines)
  })

  it('output and logs never echo simulated Flex tokens, query ids, or raw XML bodies', async () => {
    const { target, lines } = captureLogs()
    const handle = createIbkrProvider({
      getProviderSnapshot: async () => healthySnapshot,
      logTarget: target,
    })
    await handle.refreshHealth()
    const result = await handle.provider.call({}, ctx({ mode: 'admin' }))
    const allText = JSON.stringify({ result, lines, health: handle.provider.getHealth() })
    expect(allText).not.toContain(SECRET_FLEX_TOKEN)
    expect(allText).not.toContain(SECRET_QUERY_ID)
    expect(allText).not.toContain(SECRET_XML_BODY)
    expect(allText).not.toContain('apiKey')
    expect(allText).not.toContain('flexToken')
  })
})
