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
import { createBinanceProvider } from './binance-provider'
import type { ExternalInvestmentsProviderSnapshot } from './external-investments-provider-shared'

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

const SECRET_API_KEY = 'BINANCE-API-KEY-SENTINEL'
const SECRET_API_SECRET = 'BINANCE-API-SECRET-SENTINEL'
const SECRET_SIGNATURE = 'sig=BINANCE-HMAC-SIGNATURE-SENTINEL'
const SECRET_RAW_JSON = '{"balances":[{"asset":"BTC","free":"1.0"}],"raw":"BINANCE-RAW-JSON"}'

const healthySnapshot: ExternalInvestmentsProviderSnapshot = {
  enabled: true,
  status: 'healthy',
  lastSuccessAt: '2026-05-09T11:30:00.000Z',
  lastFailureAt: null,
  credentialConfigured: true,
  successCount: 12,
  failureCount: 0,
}

describe('createBinanceProvider', () => {
  it('passes the contract harness and exposes only crypto.wallet.read', () => {
    const { target } = captureLogs()
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => null,
      logTarget: target,
    })
    assertProviderContract(handle.provider as unknown as Provider)
    assertProviderDoesNotExposeForbiddenCapabilities(handle.provider as unknown as Provider)
    expect(String(handle.provider.id)).toBe('binance')
    expect(handle.provider.capability).toBe('crypto.wallet.read')
  })

  it('initial health (before refresh) is degraded with unconfigured caveat', () => {
    const { target } = captureLogs()
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => null,
      logTarget: target,
    })
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
  })

  it('null snapshot maps to degraded + unconfigured (NOT down)', async () => {
    const { target, lines } = captureLogs()
    const handle = createBinanceProvider({
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
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => healthySnapshot,
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('ok')
    expect(health.lastErrorCode).toBeNull()
  })

  it('failing snapshot (configured + enabled + failing) maps to down', async () => {
    const { target } = captureLogs()
    const handle = createBinanceProvider({
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

  it('disabled provider maps to degraded + disabled_by_flag', async () => {
    const { target } = captureLogs()
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => ({ ...healthySnapshot, enabled: false }),
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('disabled_by_flag')
  })

  it('refreshHealth swallows repository exceptions and downgrades to degraded', async () => {
    const { target, lines } = captureLogs()
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => {
        throw new Error(
          `db boom apiKey=${SECRET_API_KEY} secret=${SECRET_API_SECRET} ${SECRET_SIGNATURE} body=${SECRET_RAW_JSON}`
        )
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
      expect(stringified).not.toContain(SECRET_API_KEY)
      expect(stringified).not.toContain(SECRET_API_SECRET)
      expect(stringified).not.toContain(SECRET_SIGNATURE)
      expect(stringified).not.toContain(SECRET_RAW_JSON)
    }
  })

  it('call() returns unsupported_capability with deferred_read_routing reason', async () => {
    const { target, lines } = captureLogs()
    let snapshotCalls = 0
    const handle = createBinanceProvider({
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

  it('output and logs never echo simulated API keys, secrets, signatures, or raw JSON', async () => {
    const { target, lines } = captureLogs()
    const handle = createBinanceProvider({
      getProviderSnapshot: async () => healthySnapshot,
      logTarget: target,
    })
    await handle.refreshHealth()
    const result = await handle.provider.call({}, ctx({ mode: 'admin' }))
    const allText = JSON.stringify({ result, lines, health: handle.provider.getHealth() })
    expect(allText).not.toContain(SECRET_API_KEY)
    expect(allText).not.toContain(SECRET_API_SECRET)
    expect(allText).not.toContain(SECRET_SIGNATURE)
    expect(allText).not.toContain(SECRET_RAW_JSON)
    expect(allText).not.toContain('apiKey')
    expect(allText).not.toContain('apiSecret')
  })
})
