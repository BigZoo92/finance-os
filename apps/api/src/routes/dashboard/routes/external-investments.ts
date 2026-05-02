import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import {
  getExternalInvestmentsAccountsMock,
  getExternalInvestmentsBundleMock,
  getExternalInvestmentsCashFlowsMock,
  getExternalInvestmentsPositionsMock,
  getExternalInvestmentsStatusMock,
  getExternalInvestmentsTradesMock,
} from '../../../mocks/externalInvestments.mock'
import { getDashboardRuntime } from '../context'
import { dashboardExternalInvestmentsListQuerySchema } from '../schemas'

const getUseCase = <TValue>(value: TValue | undefined, name: string): TValue => {
  if (!value) {
    throw new Error(`${name} unavailable`)
  }
  return value
}

export const createExternalInvestmentsDashboardRoute = () =>
  new Elysia()
    .get('/external-investments/summary', async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => ({
          requestId,
          source: 'demo_fixture' as const,
          enabled: true,
          safeModeActive: false,
          providerEnabled: { ibkr: true, binance: true },
          generatedAt: getExternalInvestmentsBundleMock().generatedAt,
          dataStatus: {
            status: 'ready' as const,
            message: null,
          },
          status: getExternalInvestmentsStatusMock(requestId),
          bundle: getExternalInvestmentsBundleMock(),
          latestBundleMeta: {
            schemaVersion: getExternalInvestmentsBundleMock().schemaVersion,
            generatedAt: getExternalInvestmentsBundleMock().generatedAt,
            requestId,
            staleAfterMinutes: 1440,
            updatedAt: getExternalInvestmentsBundleMock().generatedAt,
          },
          positionCount: getExternalInvestmentsPositionsMock(requestId).items.length,
        }),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return getUseCase(
            dashboard.useCases.getExternalInvestmentsSummary,
            'External investments summary'
          )({ requestId })
        },
      })
    })
    .get('/external-investments/accounts', async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => getExternalInvestmentsAccountsMock(requestId),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return getUseCase(
            dashboard.useCases.getExternalInvestmentsAccounts,
            'External investments accounts'
          )({ requestId })
        },
      })
    })
    .get('/external-investments/positions', async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => getExternalInvestmentsPositionsMock(requestId),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return getUseCase(
            dashboard.useCases.getExternalInvestmentsPositions,
            'External investments positions'
          )({ requestId })
        },
      })
    })
    .get(
      '/external-investments/trades',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const limit = context.query.limit ?? 50

        return demoOrReal({
          context,
          demo: () => getExternalInvestmentsTradesMock(requestId),
          real: async () => {
            const dashboard = getDashboardRuntime(context)
            return getUseCase(
              dashboard.useCases.getExternalInvestmentsTrades,
              'External investments trades'
            )({ requestId, limit })
          },
        })
      },
      {
        query: dashboardExternalInvestmentsListQuerySchema,
      }
    )
    .get(
      '/external-investments/cash-flows',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const limit = context.query.limit ?? 50

        return demoOrReal({
          context,
          demo: () => getExternalInvestmentsCashFlowsMock(requestId),
          real: async () => {
            const dashboard = getDashboardRuntime(context)
            return getUseCase(
              dashboard.useCases.getExternalInvestmentsCashFlows,
              'External investments cash flows'
            )({ requestId, limit })
          },
        })
      },
      {
        query: dashboardExternalInvestmentsListQuerySchema,
      }
    )
    .get('/external-investments/context-bundle', async context => {
      const requestId = getRequestMeta(context).requestId

      return demoOrReal({
        context,
        demo: () => ({
          requestId,
          source: 'demo_fixture' as const,
          item: {
            schemaVersion: getExternalInvestmentsBundleMock().schemaVersion,
            generatedAt: getExternalInvestmentsBundleMock().generatedAt,
            requestId,
            bundle: getExternalInvestmentsBundleMock(),
            staleAfterMinutes: 1440,
            providerCoverage: getExternalInvestmentsBundleMock().providerCoverage,
            updatedAt: getExternalInvestmentsBundleMock().generatedAt,
          },
        }),
        real: async () => {
          const dashboard = getDashboardRuntime(context)
          return getUseCase(
            dashboard.useCases.getExternalInvestmentsContextBundle,
            'External investments context bundle'
          )({ requestId })
        },
      })
    })
