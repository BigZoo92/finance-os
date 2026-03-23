import { Elysia } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensConnectionsStatusMock } from '../../../../mocks/connectionsStatus.mock'
import { getPowensRuntime } from '../context'

export const createStatusRoute = () =>
  new Elysia().get('/status', async context => {
    const powens = getPowensRuntime(context)
    const safeModeActive = powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()

    return demoOrReal({
      context,
      demo: () => ({
        connections: getPowensConnectionsStatusMock(),
        safeModeActive,
      }),
      real: async () => {
        if (safeModeActive) {
          return {
            connections: getPowensConnectionsStatusMock(),
            safeModeActive: true,
            fallback: 'safe_mode',
          }
        }

        const connections = await powens.useCases.listStatuses()
        return {
          connections,
          safeModeActive: false,
        }
      },
    })
  })
