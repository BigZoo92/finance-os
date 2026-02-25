import { Elysia } from 'elysia'
import { getAuth } from '../../../../auth/context'
import { getPowensConnectionsStatusMock } from '../../../../mocks/connectionsStatus.mock'
import { getPowensRuntime } from '../context'

export const statusRoute = new Elysia({
  name: 'powens.status.route',
}).get('/status', async context => {
  if (getAuth(context).mode !== 'admin') {
    return {
      connections: getPowensConnectionsStatusMock(),
    }
  }

  const powens = getPowensRuntime(context)
  const connections = await powens.useCases.listStatuses()
  return { connections }
})
