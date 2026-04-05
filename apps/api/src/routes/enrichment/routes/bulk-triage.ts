import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { logApiEvent } from '../../../observability/logger'
import { applyDemoEnrichmentOperation } from '../mocks/demo-enrichment-store'
import { enrichmentBulkTriageBodySchema } from '../schemas'
import { getEnrichmentRuntime } from '../runtime'
import { recordBulkTriageMetrics } from '../services/bulk-metrics'

export const createEnrichmentBulkTriageRoute = () =>
  new Elysia().post(
    '/bulk-triage',
    async context => {
      const startedAt = Date.now()
      const requestMeta = getRequestMeta(context)
      const runtime = getEnrichmentRuntime(context)

      if (!runtime.bulkEnabled) {
        context.set.status = 503
        return {
          ok: false,
          code: 'FEATURE_DISABLED' as const,
          message: 'Bulk triage is temporarily disabled; fallback to single-item edit.',
          requestId: requestMeta.requestId,
        }
      }

      const results = await demoOrReal({
        context,
        demo: async () =>
          context.body.operations.map(operation =>
            applyDemoEnrichmentOperation({
              itemKey: operation.itemKey,
              triageStatus: operation.triageStatus,
              note: operation.note ?? null,
              expectedVersion: operation.expectedVersion ?? null,
            })
          ),
        real: async () => {
          requireAdmin(context)
          return Promise.all(
            context.body.operations.map(operation =>
              runtime.repository.upsertOne({
                itemKey: operation.itemKey,
                triageStatus: operation.triageStatus,
                note: operation.note ?? null,
                expectedVersion: operation.expectedVersion ?? null,
              })
            )
          )
        },
      })

      const rowsRequested = context.body.operations.length
      const rowsSucceeded = results.filter(result => result.ok).length
      const rowsFailed = rowsRequested - rowsSucceeded

      const metrics = recordBulkTriageMetrics({
        latencyMs: Date.now() - startedAt,
        successRate: rowsRequested > 0 ? rowsSucceeded / rowsRequested : 0,
      })

      if (rowsSucceeded === 0) {
        context.set.status = 500
      } else if (rowsFailed > 0) {
        context.set.status = 207
      }

      logApiEvent({
        level: rowsFailed > 0 ? 'warn' : 'info',
        msg: 'enrichment bulk triage processed',
        endpoint: '/enrichment/bulk-triage',
        operation: 'bulk_triage',
        requestId: requestMeta.requestId,
        rows_requested: rowsRequested,
        rows_succeeded: rowsSucceeded,
        rows_failed: rowsFailed,
        bulk_success_rate: metrics.successRate,
        bulk_success_rate_rolling: Number(metrics.rollingSuccessRate.toFixed(4)),
        bulk_latency_p95_ms: Math.round(metrics.latencyP95Ms),
        latencyMs: Date.now() - startedAt,
      })

      return {
        summary: {
          rowsRequested,
          rowsSucceeded,
          rowsFailed,
        },
        results,
        metrics: {
          bulkSuccessRate: metrics.successRate,
          latencyP95Ms: metrics.latencyP95Ms,
        },
      }
    },
    {
      body: enrichmentBulkTriageBodySchema,
    }
  )
