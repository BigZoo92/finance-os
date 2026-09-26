import { Elysia, t } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import {
  getDashboardValuationStatusMock,
  getDashboardValuationUnresolvedMock,
} from '../../../mocks/dashboardValuation.mock'
import { getDashboardRuntime } from '../context'
import {
  AssetValuationAlreadyRunningError,
  AssetValuationDisabledError,
  AssetValuationFailedError,
} from '../domain/valuation'

const isValuationDemoMode = <TContext extends object>(context: TContext) => {
  return getAuth(context).mode !== 'admin' && !getInternalAuth(context).hasValidToken
}

const resolveTriggerSource = <TContext extends object>(context: TContext): 'admin' | 'internal' => {
  return getAuth(context).mode === 'admin' ? 'admin' : 'internal'
}

export const createValuationRoute = () =>
  new Elysia()
    .get('/valuation/status', async context => {
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        isDemoMode: isValuationDemoMode,
        demo: () => getDashboardValuationStatusMock(),
        real: async () => {
          requireAdminOrInternalToken(context)
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getAssetValuationStatus) {
            context.set.status = 503
            return {
              ok: false,
              code: 'ASSET_VALUATION_UNAVAILABLE' as const,
              message: 'Asset valuation runtime unavailable',
            }
          }
          return dashboard.useCases.getAssetValuationStatus()
        },
      })
    })
    .get('/valuation/unresolved', async context => {
      const requestId = getRequestMeta(context).requestId
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        isDemoMode: isValuationDemoMode,
        demo: () => getDashboardValuationUnresolvedMock(),
        real: async () => {
          requireAdminOrInternalToken(context)
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.listAssetValuationUnresolved) {
            context.set.status = 503
            return {
              ok: false,
              code: 'ASSET_VALUATION_UNAVAILABLE' as const,
              message: 'Asset valuation runtime unavailable',
              requestId,
            }
          }
          return dashboard.useCases.listAssetValuationUnresolved({ requestId })
        },
      })
    })
    .post(
      '/valuation/refresh',
      async context => {
        const requestId = getRequestMeta(context).requestId
        context.set.headers['cache-control'] = 'no-store'

        return demoOrReal({
          context,
          isDemoMode: isValuationDemoMode,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session required',
              requestId,
            }
          },
          real: async () => {
            requireAdminOrInternalToken(context)
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.runAssetValuationRefresh) {
              context.set.status = 503
              return {
                ok: false,
                code: 'ASSET_VALUATION_UNAVAILABLE' as const,
                message: 'Asset valuation runtime unavailable',
                requestId,
              }
            }

            try {
              return await dashboard.useCases.runAssetValuationRefresh({
                requestId,
                triggerSource: resolveTriggerSource(context),
                dryRun: context.body?.dryRun === true,
              })
            } catch (error) {
              if (error instanceof AssetValuationDisabledError) {
                context.set.status = 503
                return { ok: false, code: error.code, message: error.message, requestId }
              }
              if (error instanceof AssetValuationAlreadyRunningError) {
                context.set.status = 409
                return { ok: false, code: error.code, message: error.message, requestId }
              }
              if (error instanceof AssetValuationFailedError) {
                context.set.status = 500
                return { ok: false, code: error.code, message: error.message, requestId }
              }
              throw error
            }
          },
        })
      },
      {
        body: t.Optional(
          t.Object({
            dryRun: t.Optional(t.Boolean()),
          })
        ),
      }
    )
