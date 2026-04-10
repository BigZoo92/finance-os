import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import { getDashboardRuntime } from '../context'
import { selectDashboardMarketsDataset } from '../domain/dashboard-market-dataset-selector'
import { dashboardMarketsRefreshBodySchema } from '../schemas'

const toSafeMarketRefreshError = ({
  error,
  requestId,
}: {
  error: unknown
  requestId: string
}) => {
  const errorCode =
    error &&
    typeof error === 'object' &&
    'code' in error &&
    typeof error.code === 'string'
      ? error.code
      : error instanceof Error
        ? error.message
        : null

  if (errorCode === 'FEATURE_DISABLED' || errorCode === 'REFRESH_DISABLED') {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'MARKET_REFRESH_DISABLED',
        message: 'Le rafraîchissement marché est désactivé.',
        requestId,
      },
    }
  }

  if (errorCode === 'MARKET_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'MARKET_PROVIDER_UNAVAILABLE',
        message: 'Les providers marché n’ont pas pu fournir de snapshot exploitable.',
        requestId,
      },
    }
  }

  return {
    status: 503,
    body: {
      ok: false,
      code: 'MARKET_REFRESH_FAILED',
      message: 'Le refresh marché a échoué. Consultez les logs API avec le requestId.',
      requestId,
    },
  }
}

export const createMarketsRoute = ({
  marketDataForceFixtureFallback,
}: {
  marketDataForceFixtureFallback: boolean
}) =>
  new Elysia()
    .get('/markets/overview', async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)

      return selectDashboardMarketsDataset({
        mode: auth.mode,
        requestId: requestMeta.requestId,
        forceFixtureFallback: marketDataForceFixtureFallback,
        live: async () => {
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getMarketsOverview) {
            throw new Error('MARKETS_RUNTIME_UNAVAILABLE')
          }

          return dashboard.useCases.getMarketsOverview({
            requestId: requestMeta.requestId,
          })
        },
      })
    })
    .get('/markets/watchlist', async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)

      const overview = await selectDashboardMarketsDataset({
        mode: auth.mode,
        requestId: requestMeta.requestId,
        forceFixtureFallback: marketDataForceFixtureFallback,
        live: async () => {
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getMarketsOverview) {
            throw new Error('MARKETS_RUNTIME_UNAVAILABLE')
          }

          return dashboard.useCases.getMarketsOverview({
            requestId: requestMeta.requestId,
          })
        },
      })

      return {
        requestId: overview.requestId,
        generatedAt: overview.generatedAt,
        freshness: overview.freshness,
        items: overview.watchlist.items,
        groups: overview.watchlist.groups,
        providers: overview.providers,
      }
    })
    .get('/markets/macro', async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)

      const overview = await selectDashboardMarketsDataset({
        mode: auth.mode,
        requestId: requestMeta.requestId,
        forceFixtureFallback: marketDataForceFixtureFallback,
        live: async () => {
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getMarketsOverview) {
            throw new Error('MARKETS_RUNTIME_UNAVAILABLE')
          }

          return dashboard.useCases.getMarketsOverview({
            requestId: requestMeta.requestId,
          })
        },
      })

      return {
        requestId: overview.requestId,
        generatedAt: overview.generatedAt,
        freshness: overview.freshness,
        items: overview.macro.items,
        providers: overview.providers,
      }
    })
    .get('/markets/context-bundle', async context => {
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)

      const overview = await selectDashboardMarketsDataset({
        mode: auth.mode,
        requestId: requestMeta.requestId,
        forceFixtureFallback: marketDataForceFixtureFallback,
        live: async () => {
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getMarketsOverview) {
            throw new Error('MARKETS_RUNTIME_UNAVAILABLE')
          }

          return dashboard.useCases.getMarketsOverview({
            requestId: requestMeta.requestId,
          })
        },
      })

      return {
        requestId: overview.requestId,
        generatedAt: overview.generatedAt,
        freshness: overview.freshness,
        bundle: overview.contextBundle,
      }
    })
    .post(
      '/markets/refresh',
      async context => {
        const requestMeta = getRequestMeta(context)

        try {
          requireAdminOrInternalToken(context)
        } catch {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Session admin ou token interne requis.',
            requestId: requestMeta.requestId,
          }
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.refreshMarkets) {
          context.set.status = 503
          return {
            ok: false,
            code: 'MARKETS_REFRESH_UNAVAILABLE',
            message: 'Le runtime de refresh marché est indisponible.',
            requestId: requestMeta.requestId,
          }
        }

        try {
          const result = await dashboard.useCases.refreshMarkets({
            requestId: requestMeta.requestId,
          })
          return {
            ok: true,
            ...result,
          }
        } catch (error) {
          const safeError = toSafeMarketRefreshError({
            error,
            requestId: requestMeta.requestId,
          })
          context.set.status = safeError.status
          return safeError.body
        }
      },
      {
        body: dashboardMarketsRefreshBodySchema,
      }
    )
