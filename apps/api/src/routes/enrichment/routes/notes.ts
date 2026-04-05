import { Elysia } from 'elysia'
import { getRequestMeta } from '../../../auth/context'
import { demoOrReal } from '../../../auth/demo-mode'
import { requireAdmin } from '../../../auth/guard'
import { logApiEvent } from '../../../observability/logger'
import { applyDemoEnrichmentOperation, listDemoEnrichmentNotes } from '../mocks/demo-enrichment-store'
import { enrichmentNoteUpsertBodySchema, enrichmentNotesQuerySchema } from '../schemas'
import { getEnrichmentRuntime } from '../runtime'

const normalizeItemKeys = (input: string) =>
  input
    .split(',')
    .map(value => value.trim())
    .filter(value => value.length > 0)

export const createEnrichmentNotesRoute = () =>
  new Elysia()
    .get(
      '/notes',
      async context => {
        const startedAt = Date.now()
        const requestMeta = getRequestMeta(context)
        const itemKeys = normalizeItemKeys(context.query.itemKeys)

        const notes = await demoOrReal({
          context,
          demo: () => listDemoEnrichmentNotes(itemKeys),
          real: async () => {
            requireAdmin(context)
            const runtime = getEnrichmentRuntime(context)
            return runtime.repository.listByItemKeys(itemKeys)
          },
        })

        logApiEvent({
          level: 'info',
          msg: 'enrichment notes listed',
          endpoint: '/enrichment/notes',
          operation: 'list_notes',
          requestId: requestMeta.requestId,
          rows_requested: itemKeys.length,
          rows_succeeded: notes.length,
          rows_failed: Math.max(0, itemKeys.length - notes.length),
          latencyMs: Date.now() - startedAt,
        })

        return {
          items: notes,
        }
      },
      {
        query: enrichmentNotesQuerySchema,
      }
    )
    .post(
      '/notes',
      async context => {
        const startedAt = Date.now()
        const requestMeta = getRequestMeta(context)

        const result = await demoOrReal({
          context,
          demo: () =>
            applyDemoEnrichmentOperation({
              itemKey: context.body.itemKey,
              triageStatus: context.body.triageStatus,
              note: context.body.note,
              expectedVersion: context.body.expectedVersion ?? null,
            }),
          real: async () => {
            requireAdmin(context)
            const runtime = getEnrichmentRuntime(context)
            return runtime.repository.upsertOne({
              itemKey: context.body.itemKey,
              triageStatus: context.body.triageStatus,
              note: context.body.note,
              expectedVersion: context.body.expectedVersion ?? null,
            })
          },
        })

        if (result.state === 'conflict') {
          context.set.status = 409
        } else if (!result.ok) {
          context.set.status = 500
        }

        logApiEvent({
          level: result.ok ? 'info' : 'warn',
          msg: 'enrichment note upserted',
          endpoint: '/enrichment/notes',
          operation: 'upsert_note',
          requestId: requestMeta.requestId,
          rows_requested: 1,
          rows_succeeded: result.ok ? 1 : 0,
          rows_failed: result.ok ? 0 : 1,
          state: result.state,
          latencyMs: Date.now() - startedAt,
        })

        return result
      },
      {
        body: enrichmentNoteUpsertBodySchema,
      }
    )
