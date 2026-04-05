import type { InferSelectModel } from 'drizzle-orm'
import type { schema } from '@finance-os/db'

export type EnrichmentNoteRow = InferSelectModel<typeof schema.enrichmentNote>

export type EnrichmentOperationInput = {
  itemKey: string
  triageStatus: 'pending' | 'accepted' | 'rejected' | 'needs_review'
  note: string | null
  expectedVersion: number | null
}

export type EnrichmentOperationResult = {
  itemKey: string
  ok: boolean
  state: 'updated' | 'created' | 'conflict' | 'failed'
  note: EnrichmentNoteRow | null
  errorCode: 'ITEM_CHANGED_SINCE_SELECTION' | 'WRITE_FAILED' | null
}

export type EnrichmentBulkSummary = {
  rowsRequested: number
  rowsSucceeded: number
  rowsFailed: number
}
