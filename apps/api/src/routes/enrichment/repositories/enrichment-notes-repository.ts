import { schema } from '@finance-os/db'
import { and, eq, inArray, sql } from 'drizzle-orm'
import type { ApiDb } from '../../dashboard/types'
import type { EnrichmentOperationInput, EnrichmentOperationResult } from '../types'

const selection = {
  id: schema.enrichmentNote.id,
  itemKey: schema.enrichmentNote.itemKey,
  note: schema.enrichmentNote.note,
  triageStatus: schema.enrichmentNote.triageStatus,
  version: schema.enrichmentNote.version,
  createdAt: schema.enrichmentNote.createdAt,
  updatedAt: schema.enrichmentNote.updatedAt,
} as const

export const createEnrichmentNotesRepository = ({ db }: { db: ApiDb }) => ({
  async listByItemKeys(itemKeys: string[]) {
    if (itemKeys.length === 0) {
      return []
    }

    return db.select(selection).from(schema.enrichmentNote).where(inArray(schema.enrichmentNote.itemKey, itemKeys))
  },

  async upsertOne(input: EnrichmentOperationInput): Promise<EnrichmentOperationResult> {
    const now = new Date()

    const [existing] = await db
      .select(selection)
      .from(schema.enrichmentNote)
      .where(eq(schema.enrichmentNote.itemKey, input.itemKey))
      .limit(1)

    if (existing) {
      if (input.expectedVersion !== null && input.expectedVersion !== existing.version) {
        return {
          itemKey: input.itemKey,
          ok: false,
          state: 'conflict',
          note: existing,
          errorCode: 'ITEM_CHANGED_SINCE_SELECTION',
        }
      }

      const [updated] = await db
        .update(schema.enrichmentNote)
        .set({
          triageStatus: input.triageStatus,
          note: input.note,
          version: existing.version + 1,
          updatedAt: now,
        })
        .where(and(eq(schema.enrichmentNote.id, existing.id), eq(schema.enrichmentNote.version, existing.version)))
        .returning(selection)

      if (!updated) {
        return {
          itemKey: input.itemKey,
          ok: false,
          state: 'failed',
          note: null,
          errorCode: 'WRITE_FAILED',
        }
      }

      return {
        itemKey: input.itemKey,
        ok: true,
        state: 'updated',
        note: updated,
        errorCode: null,
      }
    }

    if (input.expectedVersion !== null && input.expectedVersion !== 1) {
      return {
        itemKey: input.itemKey,
        ok: false,
        state: 'conflict',
        note: null,
        errorCode: 'ITEM_CHANGED_SINCE_SELECTION',
      }
    }

    const [created] = await db
      .insert(schema.enrichmentNote)
      .values({
        itemKey: input.itemKey,
        triageStatus: input.triageStatus,
        note: input.note,
        version: 1,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: schema.enrichmentNote.itemKey,
        set: {
          triageStatus: input.triageStatus,
          note: input.note,
          version: sql`${schema.enrichmentNote.version} + 1`,
          updatedAt: now,
        },
      })
      .returning(selection)

    if (!created) {
      return {
        itemKey: input.itemKey,
        ok: false,
        state: 'failed',
        note: null,
        errorCode: 'WRITE_FAILED',
      }
    }

    return {
      itemKey: input.itemKey,
      ok: true,
      state: 'created',
      note: created,
      errorCode: null,
    }
  },
})
