import { Elysia } from 'elysia'
import { demoOrReal } from '../../../auth/demo-mode'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { getDashboardNewsMock } from '../../../mocks/dashboardNews.mock'
import { getDashboardRuntime } from '../context'
import { dashboardNewsIngestBodySchema, dashboardNewsQuerySchema } from '../schemas'

export const createNewsRoute = () =>
  new Elysia()
    .get(
      '/news',
      async context => {
        const requestMeta = getRequestMeta(context)
        const demoBase = getDashboardNewsMock()
        const demoPayload = {
          ...demoBase,
          resilience: {
            ...demoBase.resilience,
            requestId: requestMeta.requestId,
          },
        }
        return demoOrReal({
          context,
          demo: () => demoPayload,
          real: () => {
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.getNews) {
              return demoPayload
            }
            return dashboard.useCases.getNews({
              ...(context.query.topic ? { topic: context.query.topic } : {}),
              ...(context.query.source ? { sourceName: context.query.source } : {}),
              limit: context.query.limit ?? 20,
              requestId: requestMeta.requestId,
            })
          },
        })
      },
      {
        query: dashboardNewsQuerySchema,
      }
    )
    .post(
      '/news/ingest',
      async context => {
        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)

        if (auth.mode !== 'admin') {
          context.set.status = 403
          return {
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Admin session required for live ingestion.',
            requestId: requestMeta.requestId,
          }
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.ingestNews) {
          context.set.status = 503
          return {
            ok: false,
            code: 'NEWS_INGESTION_UNAVAILABLE',
            message: 'News ingestion runtime is unavailable.',
            requestId: requestMeta.requestId,
          }
        }

        try {
          const result = await dashboard.useCases.ingestNews({ requestId: requestMeta.requestId })
          return {
            ok: true,
            requestId: requestMeta.requestId,
            ...result,
          }
        } catch {
          context.set.status = 503
          return {
            ok: false,
            code: 'NEWS_PROVIDER_UNAVAILABLE',
            message: 'Live provider unavailable. Using cached data.',
            requestId: requestMeta.requestId,
          }
        }
      },
      {
        body: dashboardNewsIngestBodySchema,
      }
    )
