import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from '../plugin'
import type { PowensRouteRuntime } from '../types'
import { createDiagnosticsRoute } from './diagnostics'

type DiagnosticsResponse = {
  enabled: boolean
  mode: 'demo' | 'admin'
  provider: 'mock' | 'powens'
  outcome: 'ok' | 'degraded' | 'timeout' | 'auth_error' | 'provider_error'
  guidance: string
  issueType?: 'timeout' | 'auth' | 'provider'
  retryable: boolean
  lastCheckedAt: string
}

const createRuntime = (response: DiagnosticsResponse): PowensRouteRuntime => ({
  services: {
    client: {
      exchangeCodeForToken: async () => {
        throw new Error('unused')
      },
      listConnectionAccounts: async () => {
        throw new Error('unused')
      },
      listAccountTransactions: async () => {
        throw new Error('unused')
      },
    },
    connectUrl: {
      getConnectUrl: () => 'https://example.test/connect',
      isCallbackStateValid: () => true,
      isExternalIntegrationsSafeModeEnabled: () => false,
    },
    adminAudit: {
      recordEvent: async () => {},
      listRecentEvents: async () => [],
      getLatestCallback: async () => null,
    },
    diagnostics: {
      run: async () => response,
    },
  },
  repositories: {
    connection: {
      upsertConnectedConnection: async () => {},
      disconnectConnection: async ({ connectionId }) => ({
        disconnected: true,
        connectionId,
      }),
      listConnectionStatuses: async () => [],
      listSyncRuns: async () => [],
    },
    jobs: {
      enqueueConnectionSync: async () => {},
      enqueueAllConnectionsSync: async () => {},
      getSyncBacklogCount: async () => 0,
    },
    syncGuard: {
      acquireManualSyncSlot: async () => ({
        allowed: true,
        retryAfterSeconds: 0,
      }),
    },
  },
  useCases: {
    handleCallback: async () => {},
    requestSync: async () => {},
    listStatuses: async () => [],
    listSyncRuns: async () => [],
    getSyncBacklogCount: async () => 0,
    disconnectConnection: async connectionId => ({
      disconnected: true,
      connectionId,
    }),
  },
})

const createApp = ({
  mode,
  response,
}: {
  mode: 'demo' | 'admin'
  response: DiagnosticsResponse
}) => {
  return new Elysia()
    .derive(() => ({
      auth: {
        mode,
      } as const,
      requestMeta: {
        requestId: 'req-diagnostics-test',
        startedAtMs: 0,
      },
    }))
    .use(createPowensRuntimePlugin(createRuntime(response)))
    .use(createDiagnosticsRoute())
}

describe('createDiagnosticsRoute', () => {
  it('keeps demo deterministic and returns strict contract keys', async () => {
    const app = createApp({
      mode: 'demo',
      response: {
        enabled: true,
        mode: 'demo',
        provider: 'mock',
        outcome: 'ok',
        guidance: 'Demo diagnostics are deterministic and fully local.',
        retryable: true,
        lastCheckedAt: '2026-04-04T08:00:00.000Z',
      },
    })

    const response = await app.handle(new Request('http://finance-os.local/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse

    expect(response.status).toBe(200)
    expect(Object.keys(payload).sort()).toEqual([
      'enabled',
      'guidance',
      'lastCheckedAt',
      'mode',
      'outcome',
      'provider',
      'retryable',
    ])
    expect(payload.mode).toBe('demo')
    expect(payload.provider).toBe('mock')
    expect(payload.outcome).toBe('ok')
  })

  it('surfaces admin auth_error diagnostics details for credential issues', async () => {
    const app = createApp({
      mode: 'admin',
      response: {
        enabled: true,
        mode: 'admin',
        provider: 'powens',
        outcome: 'auth_error',
        issueType: 'auth',
        guidance: 'Provider credentials need admin attention. Reconnect the institution.',
        retryable: false,
        lastCheckedAt: '2026-04-04T08:00:00.000Z',
      },
    })

    const response = await app.handle(new Request('http://finance-os.local/diagnostics'))
    const payload = (await response.json()) as DiagnosticsResponse

    expect(response.status).toBe(200)
    expect(payload.mode).toBe('admin')
    expect(payload.provider).toBe('powens')
    expect(payload.issueType).toBe('auth')
    expect(payload.outcome).toBe('auth_error')
    expect(payload.retryable).toBe(false)
  })
})
