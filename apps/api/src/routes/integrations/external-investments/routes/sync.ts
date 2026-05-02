import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../../auth/context'
import { demoOrReal } from '../../../../auth/demo-mode'
import { requireAdminOrInternalToken } from '../../../../auth/guard'
import { getExternalInvestmentsRuntime } from '../context'
import {
  externalInvestmentProviderParamSchema,
  externalInvestmentProviderSyncBodySchema,
  externalInvestmentSyncBodySchema,
} from '../schemas'

const toSyncDisabledResponse = (requestId: string) => ({
  ok: false,
  code: 'EXTERNAL_INVESTMENTS_DISABLED' as const,
  message: 'External investment sync is disabled.',
  requestId,
})

const toSafeModeResponse = (requestId: string) => ({
  ok: false,
  code: 'INTEGRATIONS_SAFE_MODE_ENABLED' as const,
  message: 'External integrations are temporarily disabled by safe mode.',
  requestId,
})

export const createExternalInvestmentsSyncRoute = () =>
  new Elysia()
    .post(
      '/sync',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session or internal token required.',
              requestId,
            }
          },
          real: async () => {
            requireAdminOrInternalToken(context)
            const runtime = getExternalInvestmentsRuntime(context)

            if (!runtime.config.enabled) {
              context.set.status = 503
              return toSyncDisabledResponse(requestId)
            }
            if (runtime.config.safeModeActive) {
              context.set.status = 503
              return toSafeModeResponse(requestId)
            }

            await runtime.jobs.enqueueAllProvidersSync({ requestId })
            return {
              ok: true,
              requestId,
              enqueued: ['ibkr', 'binance'],
            }
          },
        })
      },
      {
        body: externalInvestmentSyncBodySchema,
      }
    )
    .post(
      '/:provider/sync',
      async context => {
        const requestId = getRequestMeta(context).requestId
        const provider = context.params.provider

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN' as const,
              message: 'Admin session or internal token required.',
              requestId,
            }
          },
          real: async () => {
            requireAdminOrInternalToken(context)
            const runtime = getExternalInvestmentsRuntime(context)

            if (!runtime.config.enabled || !runtime.config.providerEnabled[provider]) {
              context.set.status = 503
              return toSyncDisabledResponse(requestId)
            }
            if (runtime.config.safeModeActive) {
              context.set.status = 503
              return toSafeModeResponse(requestId)
            }

            await runtime.jobs.enqueueProviderSync({ provider, requestId })
            return {
              ok: true,
              requestId,
              enqueued: [provider],
            }
          },
        })
      },
      {
        params: externalInvestmentProviderParamSchema,
        body: externalInvestmentProviderSyncBodySchema,
      }
    )
