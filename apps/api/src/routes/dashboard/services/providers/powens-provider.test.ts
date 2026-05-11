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
import { createPowensProvider, type PowensProviderConnectionSnapshot } from './powens-provider'

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

// Sentinel strings — these MUST never appear in the wrapper's output, logs, or
// diagnostics surface. They stand in for the kinds of fields the wrapper might
// accidentally echo (tokens, account ids, raw error bodies).
const SECRET_TOKEN = 'POWENS-TOKEN-SENTINEL-7'
const SECRET_ACCOUNT = '5678-9012-3456'
const SECRET_ERROR_BODY = 'RAW POWENS ERROR PAYLOAD WITH TOKEN'

describe('createPowensProvider', () => {
  it('passes the contract harness and exposes only banking.accounts.read', () => {
    const { target } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [],
      logTarget: target,
    })
    assertProviderContract(handle.provider as unknown as Provider)
    assertProviderDoesNotExposeForbiddenCapabilities(handle.provider as unknown as Provider)
    expect(String(handle.provider.id)).toBe('powens')
    expect(handle.provider.capability).toBe('banking.accounts.read')
  })

  it('initial health (before refresh) is degraded with unconfigured caveat', () => {
    const { target } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [],
      logTarget: target,
    })
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
    expect(health.lastSuccessAt).toBeNull()
    expect(health.note).toBeDefined()
  })

  it('refreshHealth maps zero connections to degraded + unconfigured (NOT down)', async () => {
    const { target, lines } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [],
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('unconfigured')
    assertProviderLogsSafe(lines)
  })

  it('refreshHealth maps healthy connections to ok with lastSuccessAt', async () => {
    const { target } = captureLogs()
    const lastSuccess = new Date('2026-05-09T11:30:00Z')
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [
        {
          status: 'connected',
          lastSyncStatus: 'OK',
          lastSuccessAt: lastSuccess,
          lastFailedAt: null,
        },
      ],
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('ok')
    expect(health.lastErrorCode).toBeNull()
    expect(health.lastSuccessAt).toBe(lastSuccess.toISOString())
  })

  it('refreshHealth maps reconnect_required to degraded + auth_failed', async () => {
    const { target } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [
        {
          status: 'reconnect_required',
          lastSyncStatus: null,
          lastSuccessAt: new Date('2026-05-01T00:00:00Z'),
          lastFailedAt: new Date('2026-05-09T10:00:00Z'),
        },
      ],
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('auth_failed')
  })

  it('refreshHealth maps mixed errors with at least one success to degraded + transient', async () => {
    const { target } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [
        {
          status: 'connected',
          lastSyncStatus: 'OK',
          lastSuccessAt: new Date('2026-05-09T10:00:00Z'),
          lastFailedAt: null,
        },
        {
          status: 'error',
          lastSyncStatus: 'KO',
          lastSuccessAt: null,
          lastFailedAt: new Date('2026-05-09T11:00:00Z'),
        },
      ],
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('transient')
  })

  it('refreshHealth flips to down only when all connections are in error and never succeeded', async () => {
    const { target } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => [
        {
          status: 'error',
          lastSyncStatus: 'KO',
          lastSuccessAt: null,
          lastFailedAt: new Date('2026-05-09T11:00:00Z'),
        },
        {
          status: 'error',
          lastSyncStatus: 'KO',
          lastSuccessAt: null,
          lastFailedAt: new Date('2026-05-09T11:30:00Z'),
        },
      ],
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('down')
    expect(health.lastErrorCode).toBe('provider_unavailable')
  })

  it('refreshHealth swallows repository exceptions and downgrades to degraded', async () => {
    const { target, lines } = captureLogs()
    const handle = createPowensProvider({
      listConnectionStatuses: async () => {
        throw new Error(`db unavailable account=${SECRET_ACCOUNT} body=${SECRET_ERROR_BODY}`)
      },
      logTarget: target,
    })
    await handle.refreshHealth()
    const health = handle.provider.getHealth()
    expect(health.status).toBe('degraded')
    expect(health.lastErrorCode).toBe('transient')
    // The thrown error message MUST NOT escape into log lines.
    assertProviderLogsSafe(lines)
    for (const line of lines) {
      const stringified = JSON.stringify(line)
      expect(stringified).not.toContain(SECRET_ACCOUNT)
      expect(stringified).not.toContain(SECRET_ERROR_BODY)
    }
  })

  it('call() returns unsupported_capability with deferred_read_routing reason and never reads from upstream', async () => {
    const { target, lines } = captureLogs()
    let listCalls = 0
    const handle = createPowensProvider({
      listConnectionStatuses: async () => {
        listCalls += 1
        return []
      },
      logTarget: target,
    })
    const result = await handle.provider.call({}, ctx({ mode: 'admin' }))
    assertProviderResultSafe(result)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error.code).toBe('unsupported_capability')
      expect(result.error.retryable).toBe(false)
      const stringified = JSON.stringify(result.error)
      expect(stringified).toContain('deferred_read_routing')
    }
    // call() must not invoke the local repository — it is a pure deferred stub.
    expect(listCalls).toBe(0)
    assertProviderLogsSafe(lines)
  })

  it('output and logs never echo simulated tokens, account numbers, or raw error bodies', async () => {
    const { target, lines } = captureLogs()
    const handle = createPowensProvider({
      // The wrapper never sees credentials directly — the closure only returns the
      // closed-vocab snapshot — but we confirm that the wrapper does not spuriously
      // serialize anything beyond the declared snapshot fields.
      listConnectionStatuses: async () => [
        {
          status: 'connected',
          lastSyncStatus: 'OK',
          lastSuccessAt: new Date('2026-05-09T10:00:00Z'),
          lastFailedAt: null,
        } satisfies PowensProviderConnectionSnapshot,
      ],
      logTarget: target,
    })
    await handle.refreshHealth()
    const result = await handle.provider.call({}, ctx({ mode: 'admin' }))
    const allText = JSON.stringify({ result, lines, health: handle.provider.getHealth() })
    expect(allText).not.toContain(SECRET_TOKEN)
    expect(allText).not.toContain(SECRET_ACCOUNT)
    expect(allText).not.toContain(SECRET_ERROR_BODY)
    expect(allText).not.toContain('accessToken')
    expect(allText).not.toContain('refresh_token')
  })
})
