import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createPowensRuntimePlugin } from '../plugin'
import type {
  PowensConnectionStatusView,
  PowensLatestCallbackView,
  PowensRouteRuntime,
} from '../types'
import { createStatusRoute } from './status'

type PowensStatusRouteResponse = {
  connections: Array<Record<string, unknown>>
  safeModeActive: boolean
  syncStatusPersistenceEnabled: boolean
  fallback?: 'safe_mode'
}

const createConnectionStatus = (): PowensConnectionStatusView => ({
  id: 1,
  source: 'banking',
  provider: 'powens',
  powensConnectionId: 'conn-1',
  providerConnectionId: 'conn-1',
  providerInstitutionId: 'fortuneo',
  providerInstitutionName: 'Fortuneo',
  status: 'connected',
  lastSyncStatus: 'OK',
  lastSyncReasonCode: 'SUCCESS',
  lastSyncAttemptAt: new Date('2026-03-27T08:00:00.000Z'),
  lastSyncAt: new Date('2026-03-27T08:02:00.000Z'),
  lastSuccessAt: new Date('2026-03-27T08:02:00.000Z'),
  lastFailedAt: null,
  lastError: null,
  syncMetadata: {
    accountCount: 2,
  },
  createdAt: new Date('2026-03-01T08:00:00.000Z'),
  updatedAt: new Date('2026-03-27T08:02:00.000Z'),
})

const createLatestCallback = (): PowensLatestCallbackView => ({
  receivedAt: '2026-03-27T08:03:00.000Z',
  status: 'allowed',
  actorMode: 'admin',
  requestId: 'req-status-test',
  connectionId: 'conn-1',
})

const createPowensRuntime = ({
  safeModeActive = false,
  listStatuses,
}: {
  safeModeActive?: boolean
  listStatuses?: () => Promise<PowensConnectionStatusView[]>
} = {}): PowensRouteRuntime => ({
  services: {
    client: {
      exchangeCodeForToken: async () => {
        throw new Error('not used in status tests')
      },
      listConnectionAccounts: async () => {
        throw new Error('not used in status tests')
      },
      listAccountTransactions: async () => {
        throw new Error('not used in status tests')
      },
    },
    connectUrl: {
      getConnectUrl: () => 'https://example.test/connect',
      isCallbackStateValid: () => true,
      isExternalIntegrationsSafeModeEnabled: () => safeModeActive,
    },
    adminAudit: {
      recordEvent: async () => {},
      listRecentEvents: async () => [],
      getLatestCallback: async () => createLatestCallback(),
    },
    diagnostics: {
      run: async () => ({
        enabled: true,
        mode: 'admin',
        provider: 'powens',
        outcome: 'ok',
        guidance: 'unused in status tests',
        retryable: true,
        lastCheckedAt: '2026-03-27T08:03:00.000Z',
      }),
    },
  },
  repositories: {
    connection: {
      upsertConnectedConnection: async () => {},
      listConnectionStatuses: async () => [createConnectionStatus()],
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
    listStatuses: listStatuses ?? (async () => [createConnectionStatus()]),
    listSyncRuns: async () => [],
    getSyncBacklogCount: async () => 0,
  },
})

const createStatusTestApp = ({
  mode,
  safeModeActive = false,
  syncStatusPersistenceEnabled,
  runtime,
}: {
  mode: 'admin' | 'demo'
  safeModeActive?: boolean
  syncStatusPersistenceEnabled: boolean
  runtime?: PowensRouteRuntime
}) => {
  return new Elysia()
    .derive(() => ({
      auth: {
        mode,
      } as const,
      requestMeta: {
        requestId: 'req-status-test',
        startedAtMs: 0,
      },
    }))
    .use(createPowensRuntimePlugin(runtime ?? createPowensRuntime({ safeModeActive })))
    .use(
      createStatusRoute({
        syncStatusPersistenceEnabled,
      })
    )
}

describe('createStatusRoute', () => {
  it('returns deterministic demo status without calling the real use case', async () => {
    let listStatusesCalls = 0
    const app = createStatusTestApp({
      mode: 'demo',
      syncStatusPersistenceEnabled: true,
      runtime: createPowensRuntime({
        listStatuses: async () => {
          listStatusesCalls += 1
          return [createConnectionStatus()]
        },
      }),
    })

    const response = await app.handle(new Request('http://finance-os.local/status'))
    const payload = (await response.json()) as Record<string, unknown>

    expect(response.status).toBe(200)
    expect(payload.syncStatusPersistenceEnabled).toBe(true)
    expect(listStatusesCalls).toBe(0)
    expect(payload.connections).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          powensConnectionId: 'demo-fortuneo',
          lastSyncStatus: 'OK',
          lastSyncReasonCode: 'SUCCESS',
        }),
      ])
    )
  })

  it('passes through persisted snapshot fields when the feature flag is enabled', async () => {
    const app = createStatusTestApp({
      mode: 'admin',
      syncStatusPersistenceEnabled: true,
    })

    const response = await app.handle(new Request('http://finance-os.local/status'))
    const payload = (await response.json()) as PowensStatusRouteResponse

    expect(response.status).toBe(200)
    expect(payload.syncStatusPersistenceEnabled).toBe(true)
    expect(payload.connections[0]).toEqual(
      expect.objectContaining({
        powensConnectionId: 'conn-1',
        lastSyncStatus: 'OK',
        lastSyncReasonCode: 'SUCCESS',
      })
    )
  })

  it('blanks persisted snapshot fields when the kill-switch is disabled', async () => {
    const app = createStatusTestApp({
      mode: 'admin',
      syncStatusPersistenceEnabled: false,
    })

    const response = await app.handle(new Request('http://finance-os.local/status'))
    const payload = (await response.json()) as PowensStatusRouteResponse

    expect(response.status).toBe(200)
    expect(payload.syncStatusPersistenceEnabled).toBe(false)
    expect(payload.connections[0]).toEqual(
      expect.objectContaining({
        powensConnectionId: 'conn-1',
        lastSyncStatus: null,
        lastSyncReasonCode: null,
      })
    )
  })

  it('keeps the safe-mode fallback but still exposes the kill-switch state', async () => {
    const app = createStatusTestApp({
      mode: 'admin',
      safeModeActive: true,
      syncStatusPersistenceEnabled: false,
    })

    const response = await app.handle(new Request('http://finance-os.local/status'))
    const payload = (await response.json()) as PowensStatusRouteResponse

    expect(response.status).toBe(200)
    expect(payload.fallback).toBe('safe_mode')
    expect(payload.safeModeActive).toBe(true)
    expect(payload.syncStatusPersistenceEnabled).toBe(false)
  })
})
