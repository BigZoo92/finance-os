import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from '../plugin'
import type { PowensAdminAuditEvent, PowensRouteRuntime } from '../types'
import { createConnectionsRoute } from './connections'

const createRuntime = ({
  auditEvents,
  disconnectConnection,
}: {
  auditEvents: PowensAdminAuditEvent[]
  disconnectConnection?: (connectionId: string) => Promise<{
    disconnected: boolean
    connectionId: string
  }>
}): PowensRouteRuntime => ({
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
      recordEvent: async event => {
        auditEvents.push(event)
      },
      listRecentEvents: async () => auditEvents,
      getLatestCallback: async () => null,
    },
    diagnostics: {
      run: async () => ({
        enabled: true,
        mode: 'admin',
        provider: 'powens',
        outcome: 'ok',
        guidance: 'unused',
        retryable: true,
        lastCheckedAt: '2026-04-29T00:00:00.000Z',
      }),
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
    disconnectConnection:
      disconnectConnection ??
      (async connectionId => ({
        disconnected: true,
        connectionId,
      })),
  },
})

const createApp = ({
  mode,
  auditEvents,
  disconnectConnection,
}: {
  mode: 'demo' | 'admin'
  auditEvents: PowensAdminAuditEvent[]
  disconnectConnection?: (connectionId: string) => Promise<{
    disconnected: boolean
    connectionId: string
  }>
}) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-disconnect-test',
        startedAtMs: 0,
      },
    }))
    .use(
      createPowensRuntimePlugin(
        createRuntime({
          auditEvents,
          ...(disconnectConnection ? { disconnectConnection } : {}),
        })
      )
    )
    .use(createConnectionsRoute())

describe('createConnectionsRoute', () => {
  it('rejects disconnect in demo mode without mutating', async () => {
    const auditEvents: PowensAdminAuditEvent[] = []
    let calls = 0
    const app = createApp({
      mode: 'demo',
      auditEvents,
      disconnectConnection: async connectionId => {
        calls += 1
        return {
          disconnected: true,
          connectionId,
        }
      },
    })

    const response = await app.handle(
      new Request('http://finance-os.local/connections/conn-1', {
        method: 'DELETE',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(403)
    expect(payload).toEqual({
      ok: false,
      code: 'DEMO_MODE_FORBIDDEN',
      message: 'Admin session required',
      requestId: 'req-disconnect-test',
    })
    expect(calls).toBe(0)
    expect(auditEvents).toHaveLength(0)
  })

  it('soft-disconnects a connection for admin mode and records an audit event', async () => {
    const auditEvents: PowensAdminAuditEvent[] = []
    const app = createApp({
      mode: 'admin',
      auditEvents,
      disconnectConnection: async connectionId => ({
        disconnected: true,
        connectionId,
      }),
    })

    const response = await app.handle(
      new Request('http://finance-os.local/connections/conn-1', {
        method: 'DELETE',
      })
    )
    const payload = await response.json()

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      ok: true,
      requestId: 'req-disconnect-test',
      connectionId: 'conn-1',
      disconnected: true,
    })
    expect(auditEvents[0]).toEqual(
      expect.objectContaining({
        action: 'disconnect_connection',
        result: 'allowed',
        actorMode: 'admin',
        requestId: 'req-disconnect-test',
        connectionId: 'conn-1',
      })
    )
  })
})
