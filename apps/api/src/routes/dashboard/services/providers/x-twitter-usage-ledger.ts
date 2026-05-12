/**
 * Thin DB writer for the X pay-per-use ledger. Pure side-effect: no business
 * logic, no provider call. Aggregations are read from the DB by health/diagnostic
 * endpoints, never by the orchestrator (which must see no DB latency).
 */

import { schema } from '@finance-os/db'
import { and, gte, sql } from 'drizzle-orm'
import type { ApiDb } from '../../types'

const POST_READ_COST_USD = 0.005
const USER_READ_COST_USD = 0.01

export type XLedgerWriteInput = {
  runId: string | null
  endpoint: string
  postReads?: number
  userReads?: number
  estimatedCostUsd?: number
  actualCostUsd?: number | null
  requestCount?: number
  statusCode?: number | null
  errorCode?: string | null
}

export const writeXUsageLedger = async (db: ApiDb, input: XLedgerWriteInput): Promise<void> => {
  const postReads = input.postReads ?? 0
  const userReads = input.userReads ?? 0
  const estimatedCostUsd =
    input.estimatedCostUsd ?? postReads * POST_READ_COST_USD + userReads * USER_READ_COST_USD
  await db.insert(schema.xTwitterUsageLedger).values({
    runId: input.runId ?? null,
    endpoint: input.endpoint,
    postReads,
    userReads,
    estimatedCostUsd,
    actualCostUsd: input.actualCostUsd ?? null,
    requestCount: input.requestCount ?? 1,
    statusCode: input.statusCode ?? null,
    errorCode: input.errorCode ?? null,
  })
}

export type XLedgerUsageSnapshot = {
  postReadsToday: number
  userReadsToday: number
  estimatedCostToday: number
  postReadsThisMonth: number
  userReadsThisMonth: number
  estimatedCostThisMonth: number
  lastStatusCode: number | null
  lastErrorCode: string | null
  lastErrorAt: string | null
}

export const readXUsageSnapshot = async (
  db: ApiDb,
  now: Date = new Date()
): Promise<XLedgerUsageSnapshot> => {
  const startOfDay = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  )
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))

  const [dayAgg] = await db
    .select({
      postReads: sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.postReads}), 0)`.as(
        'post_reads'
      ),
      userReads: sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.userReads}), 0)`.as(
        'user_reads'
      ),
      estimatedCost:
        sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.estimatedCostUsd}), 0)`.as(
          'estimated_cost'
        ),
    })
    .from(schema.xTwitterUsageLedger)
    .where(gte(schema.xTwitterUsageLedger.occurredAt, startOfDay))

  const [monthAgg] = await db
    .select({
      postReads: sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.postReads}), 0)`.as(
        'post_reads'
      ),
      userReads: sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.userReads}), 0)`.as(
        'user_reads'
      ),
      estimatedCost:
        sql<number>`coalesce(sum(${schema.xTwitterUsageLedger.estimatedCostUsd}), 0)`.as(
          'estimated_cost'
        ),
    })
    .from(schema.xTwitterUsageLedger)
    .where(gte(schema.xTwitterUsageLedger.occurredAt, startOfMonth))

  const [lastError] = await db
    .select({
      statusCode: schema.xTwitterUsageLedger.statusCode,
      errorCode: schema.xTwitterUsageLedger.errorCode,
      occurredAt: schema.xTwitterUsageLedger.occurredAt,
    })
    .from(schema.xTwitterUsageLedger)
    .where(
      and(
        gte(schema.xTwitterUsageLedger.occurredAt, startOfMonth),
        sql`${schema.xTwitterUsageLedger.errorCode} is not null`
      )
    )
    .orderBy(sql`${schema.xTwitterUsageLedger.occurredAt} desc`)
    .limit(1)

  return {
    postReadsToday: Number(dayAgg?.postReads ?? 0),
    userReadsToday: Number(dayAgg?.userReads ?? 0),
    estimatedCostToday: Number(dayAgg?.estimatedCost ?? 0),
    postReadsThisMonth: Number(monthAgg?.postReads ?? 0),
    userReadsThisMonth: Number(monthAgg?.userReads ?? 0),
    estimatedCostThisMonth: Number(monthAgg?.estimatedCost ?? 0),
    lastStatusCode: lastError?.statusCode ?? null,
    lastErrorCode: lastError?.errorCode ?? null,
    lastErrorAt:
      lastError?.occurredAt instanceof Date ? lastError.occurredAt.toISOString() : null,
  }
}
