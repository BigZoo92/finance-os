import { Elysia } from 'elysia'
import { getAuth, getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { getDashboardSummaryMock } from '../../../mocks/dashboardSummary.mock'
import { getDashboardRuntime } from '../context'
import {
  dashboardManualAssetBodySchema,
  dashboardManualAssetParamsSchema,
} from '../schemas'
import type { DashboardManualAssetResponse } from '../types'

const toDemoManualAssets = () => {
  const summary = getDashboardSummaryMock('30d')
  return {
    items: summary.assets
      .filter(asset => asset.origin === 'manual')
      .map(
        asset =>
          ({
            assetId: asset.assetId,
            type: asset.type,
            origin: asset.origin,
            source: asset.source,
            name: asset.name,
            currency: asset.currency,
            valuation: asset.valuation,
            valuationAsOf: asset.valuationAsOf,
            enabled: asset.enabled,
            note:
              asset.metadata && typeof asset.metadata.note === 'string' ? asset.metadata.note : null,
            category:
              asset.metadata && typeof asset.metadata.category === 'string'
                ? asset.metadata.category
                : null,
            metadata: asset.metadata,
            createdAt: '2026-04-14T08:00:00.000Z',
            updatedAt: '2026-04-14T08:00:00.000Z',
          }) satisfies DashboardManualAssetResponse
      ),
  }
}

export const createManualAssetsRoute = () =>
  new Elysia()
    .get('/manual-assets', async context => {
      return demoOrReal({
        context,
        demo: () => toDemoManualAssets(),
        real: async () => {
          requireAdmin(context)
          const dashboard = getDashboardRuntime(context)
          if (!dashboard.useCases.getManualAssets) {
            context.set.status = 503
            return {
              ok: false,
              code: 'MANUAL_ASSETS_UNAVAILABLE',
              message: 'Manual assets runtime is unavailable.',
              requestId: getRequestMeta(context).requestId,
            }
          }

          return dashboard.useCases.getManualAssets({
            mode: getAuth(context).mode,
          })
        },
      })
    })
    .post(
      '/manual-assets',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN',
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.createManualAsset) {
              context.set.status = 503
              return {
                ok: false,
                code: 'MANUAL_ASSETS_UNAVAILABLE',
                message: 'Manual assets runtime is unavailable.',
                requestId,
              }
            }

            return dashboard.useCases.createManualAsset({
              mode: getAuth(context).mode,
              ...context.body,
            })
          },
        })
      },
      {
        body: dashboardManualAssetBodySchema,
      }
    )
    .patch(
      '/manual-assets/:assetId',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN',
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.updateManualAsset) {
              context.set.status = 503
              return {
                ok: false,
                code: 'MANUAL_ASSETS_UNAVAILABLE',
                message: 'Manual assets runtime is unavailable.',
                requestId,
              }
            }

            const updated = await dashboard.useCases.updateManualAsset(context.params.assetId, {
              mode: getAuth(context).mode,
              ...context.body,
            })
            if (!updated) {
              context.set.status = 404
              return {
                ok: false,
                code: 'MANUAL_ASSET_NOT_FOUND',
                message: 'Manual asset not found.',
                requestId,
              }
            }

            return updated
          },
        })
      },
      {
        params: dashboardManualAssetParamsSchema,
        body: dashboardManualAssetBodySchema,
      }
    )
    .delete(
      '/manual-assets/:assetId',
      async context => {
        const requestId = getRequestMeta(context).requestId

        return demoOrReal({
          context,
          demo: () => {
            context.set.status = 403
            return {
              ok: false,
              code: 'DEMO_MODE_FORBIDDEN',
              message: 'Admin session required.',
              requestId,
            }
          },
          real: async () => {
            requireAdmin(context)
            const dashboard = getDashboardRuntime(context)
            if (!dashboard.useCases.deleteManualAsset) {
              context.set.status = 503
              return {
                ok: false,
                code: 'MANUAL_ASSETS_UNAVAILABLE',
                message: 'Manual assets runtime is unavailable.',
                requestId,
              }
            }

            const deleted = await dashboard.useCases.deleteManualAsset(context.params.assetId, {
              mode: getAuth(context).mode,
            })
            if (!deleted.ok) {
              context.set.status = 404
              return {
                ok: false,
                code: 'MANUAL_ASSET_NOT_FOUND',
                message: 'Manual asset not found.',
                requestId,
              }
            }

            return {
              ok: true,
              requestId,
              assetId: context.params.assetId,
            }
          },
        })
      },
      {
        params: dashboardManualAssetParamsSchema,
      }
    )
