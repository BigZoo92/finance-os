import { Elysia } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensConnectionsStatusMock } from '../../../../mocks/connectionsStatus.mock'
import { getPowensRuntime } from '../context'

export const createStatusRoute = () =>
  new Elysia().get('/status', async context => {
    return demoOrReal({
      context,
      demo: () => ({
        connections: getPowensConnectionsStatusMock(),
      }),
      real: async () => {
        const powens = getPowensRuntime(context)

        if (powens.services.connectUrl.isExternalIntegrationsSafeModeEnabled()) {
          return {
            connections: getPowensConnectionsStatusMock(),
            fallback: 'safe_mode',
          }
        }

        const connections = await powens.useCases.listStatuses()
        return { connections }
      },
    })
  })
