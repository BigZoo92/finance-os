import { Elysia } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensConnectionsStatusMock } from '../../../../mocks/connectionsStatus.mock'
import { getPowensRuntime } from '../context'

export const statusRoute = new Elysia({
  name: 'powens.status.route',
}).get('/status', async context => {
  return demoOrReal({
    context,
    demo: () => ({
      connections: getPowensConnectionsStatusMock(),
    }),
    real: async () => {
      const powens = getPowensRuntime(context)
      const connections = await powens.useCases.listStatuses()
      return { connections }
    },
  })
})
