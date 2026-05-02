import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { getExternalInvestmentsRuntime } from '../context'
import { externalInvestmentListQuerySchema } from '../schemas'

export const createExternalInvestmentsSyncRunsRoute = () =>
  new Elysia().get(
    '/sync-runs',
    async context => {
      const requestId = getRequestMeta(context).requestId
      const limit = context.query.limit ?? 40

      return demoOrReal({
        context,
        demo: () => ({
          requestId,
          mode: 'demo' as const,
          source: 'demo_fixture' as const,
          items: [
            {
              id: 'demo-external-investments-sync',
              requestId,
              provider: 'ibkr',
              providerConnectionId: 'ibkr:flex',
              triggerSource: 'manual',
              status: 'success',
              startedAt: '2026-04-09T11:59:00.000Z',
              finishedAt: '2026-04-09T12:00:00.000Z',
              durationMs: 60000,
              errorCode: null,
              errorMessage: null,
              rowCounts: { positions: 1, trades: 1, cashFlows: 0, rawImports: 3 },
              degradedReasons: [],
            },
          ],
        }),
        real: async () => {
          const runtime = getExternalInvestmentsRuntime(context)
          return {
            requestId,
            mode: 'admin' as const,
            source: 'db' as const,
            items: await runtime.repository.listSyncRuns(limit),
          }
        },
      })
    },
    {
      query: externalInvestmentListQuerySchema,
    }
  )
