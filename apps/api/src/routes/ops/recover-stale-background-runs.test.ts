import { describe, expect, it } from 'bun:test'
import { schema } from '@finance-os/db'
import type { ApiDb } from '../dashboard/types'
import { recoverStaleBackgroundRuns, shouldRecoverStaleRun } from './recover-stale-background-runs'

type FakeRunRow = {
  id: number
  runId?: string
  requestId: string | null
  status: string
  startedAt: Date
  finishedAt: Date | null
  durationMs: number | null
  errorSummary: string | null
}

const createFakeDb = ({
  freeFirehoseRows,
  signalRows,
  now,
  staleAfterMs,
}: {
  freeFirehoseRows: FakeRunRow[]
  signalRows: FakeRunRow[]
  now: Date
  staleAfterMs: number
}): ApiDb => {
  const rowsFor = (table: unknown) =>
    table === schema.freeFirehoseRun ? freeFirehoseRows : signalRows

  return {
    select: () => ({
      from: (table: unknown) => ({
        where: async () => rowsFor(table).map(row => ({ ...row })),
      }),
    }),
    update: (table: unknown) => ({
      set: (values: Partial<FakeRunRow>) => ({
        where: async () => {
          const cutoff = new Date(now.getTime() - staleAfterMs)
          for (const row of rowsFor(table)) {
            if (row.status === 'running' && row.startedAt < cutoff) {
              Object.assign(row, values)
            }
          }
        },
      }),
    }),
  } as unknown as ApiDb
}

describe('recover stale background runs', () => {
  it('only recovers running rows older than the stale threshold', () => {
    const now = new Date('2026-05-03T01:00:00.000Z')
    const staleStartedAt = new Date('2026-05-03T00:00:00.000Z')
    const freshStartedAt = new Date('2026-05-03T00:55:00.000Z')

    expect(
      shouldRecoverStaleRun({
        status: 'running',
        startedAt: staleStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(true)
    expect(
      shouldRecoverStaleRun({
        status: 'running',
        startedAt: freshStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(false)
    expect(
      shouldRecoverStaleRun({
        status: 'success',
        startedAt: staleStartedAt,
        now,
        staleAfterMs: 30 * 60 * 1000,
      })
    ).toBe(false)
  })

  it('recovers old running background rows, leaves fresh rows alone, and is idempotent', async () => {
    const now = new Date('2026-05-20T12:00:00.000Z')
    const staleAfterMs = 30 * 60 * 1000
    const staleStartedAt = new Date('2026-05-20T10:00:00.000Z')
    const freshStartedAt = new Date('2026-05-20T11:45:00.000Z')
    const freeFirehoseRows: FakeRunRow[] = [
      {
        id: 2,
        requestId: 'req-firehose-stale',
        status: 'running',
        startedAt: staleStartedAt,
        finishedAt: null,
        durationMs: null,
        errorSummary: null,
      },
      {
        id: 3,
        requestId: 'req-firehose-fresh',
        status: 'running',
        startedAt: freshStartedAt,
        finishedAt: null,
        durationMs: null,
        errorSummary: null,
      },
    ]
    const signalRows: FakeRunRow[] = [
      {
        id: 9,
        requestId: 'req-signal-stale',
        status: 'running',
        startedAt: staleStartedAt,
        finishedAt: null,
        durationMs: null,
        errorSummary: null,
      },
      {
        id: 10,
        requestId: 'req-signal-done',
        status: 'success',
        startedAt: staleStartedAt,
        finishedAt: now,
        durationMs: 1000,
        errorSummary: null,
      },
    ]
    const db = createFakeDb({ freeFirehoseRows, signalRows, now, staleAfterMs })

    const first = await recoverStaleBackgroundRuns({ db, now, staleAfterMs })
    const second = await recoverStaleBackgroundRuns({ db, now, staleAfterMs })

    expect(first.recovered.map(row => `${row.table}:${row.id}`).sort()).toEqual([
      'free_firehose_run:2',
      'signal_ingestion_run:9',
    ])
    expect(freeFirehoseRows[0]?.status).toBe('failed_timeout')
    expect(freeFirehoseRows[1]?.status).toBe('running')
    expect(signalRows[0]?.status).toBe('failed_timeout')
    expect(signalRows[1]?.status).toBe('success')
    expect(second.recovered).toHaveLength(0)
  })
})
