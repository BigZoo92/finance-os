import { Elysia } from 'elysia'
import { getAuth, getInternalAuth, getRequestMeta } from '../../../auth/context'
import { requireAdminOrInternalToken } from '../../../auth/guard'
import { getDashboardRuntime } from '../context'
import { selectDashboardNewsDataset } from '../domain/dashboard-dataset-selector'
import {
  dashboardNewsContextQuerySchema,
  dashboardNewsIngestBodySchema,
  dashboardNewsQuerySchema,
} from '../schemas'

const toSafeNewsIngestionError = ({
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

  if (errorCode === 'FEATURE_DISABLED') {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'NEWS_INGESTION_DISABLED',
        message: 'Live news ingestion is disabled.',
        requestId,
      },
    }
  }

  if (errorCode === 'NEWS_PROVIDER_UNAVAILABLE') {
    return {
      status: 503,
      body: {
        ok: false,
        code: 'NEWS_PROVIDER_UNAVAILABLE',
        message: 'All enabled news providers failed. Using cached data.',
        requestId,
      },
    }
  }

  return {
    status: 503,
    body: {
      ok: false,
      code: 'NEWS_INGESTION_FAILED',
      message: 'News ingestion failed before completion. Check API logs with the requestId.',
      requestId,
    },
  }
}

export const createNewsRoute = () =>
  new Elysia()
    .get(
      '/news',
      async context => {
        const auth = getAuth(context)
        const requestMeta = getRequestMeta(context)

        return selectDashboardNewsDataset({
          mode: auth.mode,
          requestId: requestMeta.requestId,
          live: async () => {
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.getNews) {
              throw new Error('NEWS_RUNTIME_UNAVAILABLE')
            }

            return dashboard.useCases.getNews({
              ...(context.query.topic ? { topic: context.query.topic } : {}),
              ...(context.query.source ? { sourceName: context.query.source } : {}),
              ...(context.query.sourceType ? { sourceType: context.query.sourceType } : {}),
              ...(context.query.domain ? { domain: context.query.domain } : {}),
              ...(context.query.eventType ? { eventType: context.query.eventType } : {}),
              ...(context.query.minSeverity !== undefined
                ? { minSeverity: context.query.minSeverity }
                : {}),
              ...(context.query.region ? { region: context.query.region } : {}),
              ...(context.query.ticker ? { ticker: context.query.ticker } : {}),
              ...(context.query.sector ? { sector: context.query.sector } : {}),
              ...(context.query.direction ? { direction: context.query.direction } : {}),
              ...(context.query.from ? { from: context.query.from } : {}),
              ...(context.query.to ? { to: context.query.to } : {}),
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
    .get(
      '/news/context',
      async context => {
        const auth = getAuth(context)
        const internalAuth = getInternalAuth(context)
        const requestMeta = getRequestMeta(context)

        if (auth.mode !== 'admin' && !internalAuth.hasValidToken) {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Admin session or internal token required.',
            requestId: requestMeta.requestId,
          }
        }

        const dashboard = getDashboardRuntime(context)
        if (!dashboard.useCases.getNewsContextBundle) {
          context.set.status = 503
          return {
            ok: false,
            code: 'NEWS_CONTEXT_UNAVAILABLE',
            message: 'News context bundle runtime is unavailable.',
            requestId: requestMeta.requestId,
          }
        }

        return dashboard.useCases.getNewsContextBundle({
          requestId: requestMeta.requestId,
          range: context.query.range ?? '7d',
        })
      },
      {
        query: dashboardNewsContextQuerySchema,
      }
    )
    .post(
      '/news/ingest',
      async context => {
        const requestMeta = getRequestMeta(context)

        try {
          requireAdminOrInternalToken(context)
        } catch {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Admin session or internal token required for live ingestion.',
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
        } catch (error) {
          const safeError = toSafeNewsIngestionError({
            error,
            requestId: requestMeta.requestId,
          })
          context.set.status = safeError.status
          return safeError.body
        }
      },
      {
        body: dashboardNewsIngestBodySchema,
      }
    )
