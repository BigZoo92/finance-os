import type { EnrichmentOperationInput, EnrichmentOperationResult } from '../types'

type DemoRow = {
  id: number
  itemKey: string
  note: string | null
  triageStatus: 'pending' | 'accepted' | 'rejected' | 'needs_review'
  version: number
  createdAt: Date
  updatedAt: Date
}

const seedRows: DemoRow[] = [
  {
    id: 1,
    itemKey: 'demo:txn:groceries',
    note: 'Weekly groceries recurring spend.',
    triageStatus: 'accepted',
    version: 1,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  },
]

let rowId = 10
const store = new Map<string, DemoRow>(seedRows.map(row => [row.itemKey, row]))

export const listDemoEnrichmentNotes = (itemKeys: string[]) => {
  return itemKeys.map(itemKey => store.get(itemKey)).filter((row): row is DemoRow => row !== undefined)
}

export const applyDemoEnrichmentOperation = (input: EnrichmentOperationInput): EnrichmentOperationResult => {
  const existing = store.get(input.itemKey)
  const now = new Date('2026-01-01T00:00:00.000Z')

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

    const updated: DemoRow = {
      ...existing,
      note: input.note,
      triageStatus: input.triageStatus,
      version: existing.version + 1,
      updatedAt: now,
    }
    store.set(updated.itemKey, updated)

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

  const created: DemoRow = {
    id: rowId,
    itemKey: input.itemKey,
    note: input.note,
    triageStatus: input.triageStatus,
    version: 1,
    createdAt: now,
    updatedAt: now,
  }
  rowId += 1
  store.set(created.itemKey, created)

  return {
    itemKey: input.itemKey,
    ok: true,
    state: 'created',
    note: created,
    errorCode: null,
  }
}
