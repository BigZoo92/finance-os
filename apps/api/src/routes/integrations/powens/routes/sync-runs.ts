import { Elysia, t } from 'elysia'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getPowensSyncRunsMock } from '../../../../mocks/syncRuns.mock'
import { getPowensRuntime } from '../context'

const querySchema = t.Object({
  limit: t.Optional(t.Numeric({ minimum: 1, maximum: 100 })),
})

export const createSyncRunsRoute = () =>
  new Elysia().get(
    '/sync-runs',
    async context => {
      return demoOrReal({
        context,
        demo: () => ({
          runs: getPowensSyncRunsMock(),
        }),
        real: async () => {
          const powens = getPowensRuntime(context)
          const limit = context.query.limit === undefined ? undefined : Number(context.query.limit)
          const runs = await powens.useCases.listSyncRuns(limit)
          return { runs }
        },
      })
    },
    {
      query: querySchema,
    }
  )
