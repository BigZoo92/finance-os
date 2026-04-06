import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import { logApiEvent } from '../../../observability/logger'
import { getDashboardRuntime } from '../context'
import { dashboardSummaryQuerySchema } from '../schemas'
import {
  mapSummaryToAnalyticsContract,
  shouldForceAnalyticsDemoAdapter,
  validateAnalyticsContract,
  type DashboardAnalyticsResponse,
} from '../domain/analytics-contract'

export const createAnalyticsRoute = () =>
  new Elysia().get(
    '/analytics',
    async context => {
      const range = context.query.range ?? '30d'
      const auth = getAuth(context)
      const requestMeta = getRequestMeta(context)
      const forceDemoAdapter = shouldForceAnalyticsDemoAdapter()
      const runDemoAdapter = auth.mode === 'demo' || forceDemoAdapter

      logApiEvent({
        level: 'info',
        msg: 'dashboard analytics adapter selected',
        requestId: requestMeta.requestId,
        route: '/dashboard/analytics',
        adapter: runDemoAdapter ? 'demoAdapter' : 'adminAdapter',
        auth_mode: auth.mode,
        force_demo_adapter: forceDemoAdapter,
      })

      const payload: DashboardAnalyticsResponse = runDemoAdapter
        ? mapSummaryToAnalyticsContract({
            summary: getDashboardSummaryMock(range),
            source: 'demoAdapter',
          })
        : mapSummaryToAnalyticsContract({
            summary: await getDashboardRuntime(context).useCases.getSummary(range),
            source: 'adminAdapter',
          })

      if (!validateAnalyticsContract(payload)) {
        logApiEvent({
          level: 'warn',
          msg: 'dashboard analytics contract validation failed',
          requestId: requestMeta.requestId,
          route: '/dashboard/analytics',
          source: payload.source,
          range,
        })

        context.set.status = 503
        return {
          ok: false,
          code: 'DASHBOARD_ANALYTICS_CONTRACT_INVALID',
          message: 'Analytics temporarily unavailable',
          requestId: requestMeta.requestId,
        }
      }

      logApiEvent({
        level: 'info',
        msg: 'dashboard analytics response ready',
        requestId: requestMeta.requestId,
        route: '/dashboard/analytics',
        source: payload.source,
        timeseries_points: payload.timeseries.points.length,
        category_items: payload.categorySplit.items.length,
      })

      return payload
    },
    {
      query: dashboardSummaryQuerySchema,
    }
  )
