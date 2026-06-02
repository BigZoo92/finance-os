import { schema } from '@finance-os/db'
import { and, eq, lt } from 'drizzle-orm'
import type { ApiDb, DashboardBackgroundRunRecoveryResponse } from '../dashboard/types'

export type BackgroundStaleRunRecovery = DashboardBackgroundRunRecoveryResponse

export const shouldRecoverStaleRun = ({
  status,
  startedAt,
  now,
  staleAfterMs,
}: {
  status: string
  startedAt: Date
  now: Date
  staleAfterMs: number
}) => status === 'running' && now.getTime() - startedAt.getTime() >= staleAfterMs

const toRecovery = ({
  table,
  id,
  requestId,
  startedAt,
  finishedAt,
  durationMs,
}: {
  table: BackgroundStaleRunRecovery['table']
  id: string
  requestId: string | null
  startedAt: Date
  finishedAt: Date
  durationMs: number
}): BackgroundStaleRunRecovery => ({
  table,
  id,
  requestId,
  previousStatus: 'running',
  status: 'failed_timeout',
  startedAt: startedAt.toISOString(),
  finishedAt: finishedAt.toISOString(),
  durationMs,
  errorCode: 'STALE_TIMED_OUT',
  errorMessage: 'Run exceeded stale recovery threshold and was marked failed_timeout.',
})

export const recoverStaleBackgroundRuns = async ({
  db,
  staleAfterMs,
  now = new Date(),
}: {
  db: ApiDb
  staleAfterMs: number
  now?: Date
}): Promise<{ recovered: BackgroundStaleRunRecovery[]; skipped: BackgroundStaleRunRecovery[] }> => {
  const cutoff = new Date(now.getTime() - staleAfterMs)
  const recovered: BackgroundStaleRunRecovery[] = []

  const freeFirehoseRows = await db
    .select()
    .from(schema.freeFirehoseRun)
    .where(
      and(eq(schema.freeFirehoseRun.status, 'running'), lt(schema.freeFirehoseRun.startedAt, cutoff))
    )

  for (const row of freeFirehoseRows) {
    const durationMs = now.getTime() - row.startedAt.getTime()
    await db
      .update(schema.freeFirehoseRun)
      .set({
        status: 'failed_timeout',
        finishedAt: now,
        durationMs,
        errorSummary: 'STALE_TIMED_OUT: Free Firehose run exceeded stale recovery threshold.',
      })
      .where(eq(schema.freeFirehoseRun.id, row.id))
    recovered.push(
      toRecovery({
        table: 'free_firehose_run',
        id: String(row.id),
        requestId: row.requestId,
        startedAt: row.startedAt,
        finishedAt: now,
        durationMs,
      })
    )
  }

  const signalRows = await db
    .select()
    .from(schema.signalIngestionRun)
    .where(
      and(eq(schema.signalIngestionRun.status, 'running'), lt(schema.signalIngestionRun.startedAt, cutoff))
    )

  for (const row of signalRows) {
    const durationMs = now.getTime() - row.startedAt.getTime()
    await db
      .update(schema.signalIngestionRun)
      .set({
        status: 'failed_timeout',
        finishedAt: now,
        durationMs,
        errorSummary: 'STALE_TIMED_OUT: Signal ingestion run exceeded stale recovery threshold.',
      })
      .where(eq(schema.signalIngestionRun.id, row.id))
    recovered.push(
      toRecovery({
        table: 'signal_ingestion_run',
        id: String(row.id),
        requestId: row.requestId,
        startedAt: row.startedAt,
        finishedAt: now,
        durationMs,
      })
    )
  }

  return { recovered, skipped: [] }
}
