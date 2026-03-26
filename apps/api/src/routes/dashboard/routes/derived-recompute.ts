import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import { getDashboardDerivedRecomputeStatusMock } from '../../../mocks/dashboardDerivedRecompute.mock'
import {
  DashboardDerivedRecomputeAlreadyRunningError,
  DashboardDerivedRecomputeDisabledError,
  DashboardDerivedRecomputeFailedError,
} from '../domain/derived-recompute'
import { getDashboardRuntime } from '../context'
import { Elysia } from 'elysia'

const isDashboardDerivedRecomputeDemoMode = <TContext extends object>(context: TContext) => {
  return getAuth(context).mode !== 'admin' && !getInternalAuth(context).hasValidToken
}

const resolveTriggerSource = <TContext extends object>(context: TContext): 'admin' | 'internal' => {
  return getAuth(context).mode === 'admin' ? 'admin' : 'internal'
}

export const createDerivedRecomputeRoute = () =>
  new Elysia()
    .get('/derived-recompute', async context => {
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        isDemoMode: isDashboardDerivedRecomputeDemoMode,
        demo: () => getDashboardDerivedRecomputeStatusMock(),
        real: async () => {
          requireAdminOrInternalToken(context)
          const dashboard = getDashboardRuntime(context)
          return dashboard.useCases.getDerivedRecomputeStatus()
        },
      })
    })
    .post('/derived-recompute', async context => {
      const requestId = getRequestMeta(context).requestId
      context.set.headers['cache-control'] = 'no-store'

      return demoOrReal({
        context,
        isDemoMode: isDashboardDerivedRecomputeDemoMode,
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

          try {
            return await dashboard.useCases.runDerivedRecompute({
              requestId,
              triggerSource: resolveTriggerSource(context),
            })
          } catch (error) {
            if (error instanceof DashboardDerivedRecomputeDisabledError) {
              context.set.status = 503
              return {
                ok: false,
                code: error.code,
                message: error.message,
                requestId,
              }
            }

            if (error instanceof DashboardDerivedRecomputeAlreadyRunningError) {
              context.set.status = 409
              return {
                ok: false,
                code: error.code,
                message: error.message,
                requestId,
              }
            }

            if (error instanceof DashboardDerivedRecomputeFailedError) {
              context.set.status = 500
              return {
                ok: false,
                code: error.code,
                message: error.message,
                requestId,
              }
            }

            throw error
          }
        },
      })
    })
