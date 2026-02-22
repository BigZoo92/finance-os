import { Elysia } from 'elysia'
import { getPowensRuntime } from '../context'

export const statusRoute = new Elysia({
  name: 'powens.status.route',
}).get('/status', async context => {
  const powens = getPowensRuntime(context)
  const connections = await powens.useCases.listStatuses()
  return { connections }
})
