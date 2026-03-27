import { Elysia } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensConnectionsStatusMock } from '../../../../mocks/connectionsStatus.mock'
import { getPowensRuntime } from '../context'
import type { PowensConnectionStatusView } from '../types'

const withPersistenceFlag = ({
  connections,
  enabled,
}: {
  connections: PowensConnectionStatusView[]
  enabled: boolean
}) => {
  if (enabled) {
    return connections
  }

  return connections.map(connection => ({
    ...connection,
    lastSyncStatus: null,
    lastSyncReasonCode: null,
  }))
}

export const createStatusRoute = ({
  syncStatusPersistenceEnabled,
}: {
  syncStatusPersistenceEnabled: boolean
}) =>
  new Elysia().get('/status', async context => {
    const powens = getPowensRuntime(context)
    const safeModeActive = powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()

    return demoOrReal({
      context,
      demo: () => ({
        connections: withPersistenceFlag({
          connections: getPowensConnectionsStatusMock(),
          enabled: syncStatusPersistenceEnabled,
        }),
        safeModeActive,
        syncStatusPersistenceEnabled,
        lastCallback: {
          receivedAt: '2026-03-23T08:42:00.000Z',
          status: 'allowed' as const,
          actorMode: 'state' as const,
          requestId: 'demo-powens-callback',
          connectionId: 'demo-fortuneo',
        },
      }),
      real: async () => {
        const lastCallback = await powens.services.adminAudit.getLatestCallback()

        if (safeModeActive) {
          return {
            connections: withPersistenceFlag({
              connections: getPowensConnectionsStatusMock(),
              enabled: syncStatusPersistenceEnabled,
            }),
            safeModeActive: true,
            syncStatusPersistenceEnabled,
            fallback: 'safe_mode',
            lastCallback,
          }
        }

        const connections = await powens.useCases.listStatuses()
        return {
          connections: withPersistenceFlag({
            connections,
            enabled: syncStatusPersistenceEnabled,
          }),
          safeModeActive: false,
          syncStatusPersistenceEnabled,
          lastCallback,
        }
      },
    })
  })
