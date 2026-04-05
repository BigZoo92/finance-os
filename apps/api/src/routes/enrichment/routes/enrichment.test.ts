import { describe, expect, it } from 'bun:test'
import { Elysia } from 'elysia'
import { createEnrichmentBulkTriageRoute } from './bulk-triage'
import { createEnrichmentNotesRoute } from './notes'
import { createEnrichmentRuntimePlugin, type EnrichmentRuntime } from '../runtime'

const createRuntime = (): EnrichmentRuntime => ({
  bulkEnabled: true,
  repository: {
    listByItemKeys: async itemKeys =>
      itemKeys.map((itemKey, index) => ({
        id: index + 1,
        itemKey,
        note: 'Persisted',
        triageStatus: 'accepted',
        version: 1,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      })),
    upsertOne: async input => ({
      itemKey: input.itemKey,
      ok: true,
      state: 'updated',
      note: {
        id: 1,
        itemKey: input.itemKey,
        note: input.note,
        triageStatus: input.triageStatus,
        version: 2,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
        updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      errorCode: null,
    }),
  },
})

const createApp = ({ mode, runtime }: { mode: 'admin' | 'demo'; runtime?: EnrichmentRuntime }) =>
  new Elysia()
    .derive(() => ({
      auth: { mode } as const,
      requestMeta: {
        requestId: 'req-enrichment-test',
        startedAtMs: 0,
      },
    }))
    .use(createEnrichmentRuntimePlugin(runtime ?? createRuntime()))
    .use(createEnrichmentNotesRoute())
    .use(createEnrichmentBulkTriageRoute())

describe('enrichment routes', () => {
  it('returns deterministic demo notes from in-memory store', async () => {
    const app = createApp({ mode: 'demo' })

    const response = await app.handle(
      new Request('http://finance-os.local/notes?itemKeys=demo:txn:groceries')
    )
    const payload = (await response.json()) as {
      items: Array<{ itemKey: string; triageStatus: string }>
    }

    expect(response.status).toBe(200)
    expect(payload).toEqual({
      items: [
        expect.objectContaining({
          itemKey: 'demo:txn:groceries',
          triageStatus: 'accepted',
        }),
      ],
    })
  })

  it('blocks notes list in non-demo non-admin modes', async () => {
    const app = createApp({ mode: 'demo' })
    const response = await app.handle(new Request('http://finance-os.local/notes?itemKeys=real:1'))

    expect(response.status).toBe(200)
    const payload = (await response.json()) as { items: unknown[] }
    expect(payload).toEqual({ items: [] })
  })

  it('returns partial summary for bulk triage conflicts', async () => {
    const runtime = createRuntime()
    runtime.repository.upsertOne = async input => ({
      itemKey: input.itemKey,
      ok: false,
      state: 'conflict',
      note: null,
      errorCode: 'ITEM_CHANGED_SINCE_SELECTION',
    })

    const app = createApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/bulk-triage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operations: [
            {
              itemKey: 'txn:1',
              triageStatus: 'accepted',
              expectedVersion: 1,
            },
          ],
        }),
      })
    )

    expect(response.status).toBe(500)
    const payload = (await response.json()) as {
      summary: { rowsRequested: number; rowsSucceeded: number; rowsFailed: number }
    }
    expect(payload.summary).toEqual({ rowsRequested: 1, rowsSucceeded: 0, rowsFailed: 1 })
  })

  it('returns feature-disabled response when kill switch is off', async () => {
    const runtime = createRuntime()
    runtime.bulkEnabled = false
    const app = createApp({ mode: 'admin', runtime })

    const response = await app.handle(
      new Request('http://finance-os.local/bulk-triage', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          operations: [{ itemKey: 'txn:2', triageStatus: 'pending' }],
        }),
      })
    )

    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({
      ok: false,
      code: 'FEATURE_DISABLED',
      message: 'Bulk triage is temporarily disabled; fallback to single-item edit.',
      requestId: 'req-enrichment-test',
    })
  })
})
