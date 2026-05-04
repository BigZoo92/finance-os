import { Elysia, t } from 'elysia'
import { getAuth, getRequestMeta } from '../../auth/context'
import { requireAdminOrInternalToken } from '../../auth/guard'
import type { DashboardRouteRuntime } from '../dashboard/types'
import { createRefreshJobRegistry } from './refresh-registry'

const jobParamsSchema = t.Object({
  jobId: t.String({ minLength: 1 }),
})

const runBodySchema = t.Optional(
  t.Object({
    trigger: t.Optional(t.Union([t.Literal('manual'), t.Literal('scheduled'), t.Literal('internal')])),
  })
)

const toTriggerSource = (trigger: string | undefined, fallback: 'manual-global' | 'manual-individual') => {
  if (trigger === 'scheduled') {
    return 'cron' as const
  }
  if (trigger === 'internal') {
    return 'internal' as const
  }
  return fallback
}

const demoResponse = (requestId: string, registry: ReturnType<typeof createRefreshJobRegistry>) => ({
  requestId,
  mode: 'demo' as const,
  jobs: registry.getJobs(),
  latestRun: null,
  history: [],
})

export const createOpsRefreshRoute = ({
  runtime,
  config,
}: {
  runtime: DashboardRouteRuntime
  config: {
    externalInvestmentsEnabled: boolean
    ibkrFlexEnabled: boolean
    binanceSpotEnabled: boolean
    newsEnabled: boolean
    marketsEnabled: boolean
    advisorEnabled: boolean
    socialEnabled: boolean
  }
}) => {
  const registry = createRefreshJobRegistry({ runtime, config })

  return new Elysia({ prefix: '/ops/refresh' })
    .get('/jobs', context => {
      const requestId = getRequestMeta(context).requestId
      return {
        requestId,
        mode: getAuth(context).mode,
        jobs: registry.getJobs(),
      }
    })
    .get('/runs', async context => {
      const requestId = getRequestMeta(context).requestId
      const auth = getAuth(context)
      if (auth.mode !== 'admin') {
        return demoResponse(requestId, registry)
      }
      requireAdminOrInternalToken(context)
      return registry.getStatus({ requestId, mode: 'admin' })
    })
    .get(
      '/runs/:runId',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const auth = getAuth(context)
        if (auth.mode !== 'admin') {
          context.set.status = 404
          return {
            ok: false,
            code: 'REFRESH_RUN_NOT_FOUND',
            message: 'Refresh run not found in demo mode.',
            requestId,
          }
        }
        requireAdminOrInternalToken(context)
        const run = runtime.useCases.getAdvisorManualOperationById
          ? await runtime.useCases.getAdvisorManualOperationById({
              mode: 'admin',
              requestId,
              operationId: context.params.runId,
            })
          : null
        if (!run) {
          context.set.status = 404
          return {
            ok: false,
            code: 'REFRESH_RUN_NOT_FOUND',
            message: 'Refresh run not found.',
            requestId,
          }
        }
        return run
      },
      {
        params: t.Object({ runId: t.String({ minLength: 1 }) }),
      }
    )
    .get('/status', async context => {
      const requestId = getRequestMeta(context).requestId
      const auth = getAuth(context)
      if (auth.mode !== 'admin') {
        return demoResponse(requestId, registry)
      }
      requireAdminOrInternalToken(context)
      return registry.getStatus({ requestId, mode: 'admin' })
    })
    .post(
      '/all',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const auth = getAuth(context)
        if (auth.mode !== 'admin') {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Admin session or internal token required.',
            requestId,
          }
        }
        requireAdminOrInternalToken(context)
        return registry.runAll({
          requestId,
          triggerSource: toTriggerSource(context.body?.trigger, 'manual-global'),
        })
      },
      { body: runBodySchema }
    )
    .post(
      '/jobs/:jobId/run',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const auth = getAuth(context)
        if (auth.mode !== 'admin') {
          context.set.status = 403
          return {
            ok: false,
            code: 'DEMO_MODE_FORBIDDEN',
            message: 'Admin session or internal token required.',
            requestId,
          }
        }
        requireAdminOrInternalToken(context)
        return registry.runJob({
          jobId: context.params.jobId,
          requestId,
          triggerSource: toTriggerSource(context.body?.trigger, 'manual-individual'),
        })
      },
      {
        params: jobParamsSchema,
        body: runBodySchema,
      }
    )
}
