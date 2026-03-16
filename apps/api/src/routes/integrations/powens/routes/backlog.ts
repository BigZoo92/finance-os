import { Elysia } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensRuntime } from '../context'

export const createBacklogRoute = () =>
  new Elysia().get('/backlog', async context => {
    return demoOrReal({
      context,
      demo: () => ({
        syncBacklogCount: 0,
      }),
      real: async () => {
        const powens = getPowensRuntime(context)
        const syncBacklogCount = await powens.useCases.getSyncBacklogCount()

        return { syncBacklogCount }
      },
    })
  })
