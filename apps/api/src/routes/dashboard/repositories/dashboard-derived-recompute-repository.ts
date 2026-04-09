import { schema } from '@finance-os/db'
import {
  derivePowensTransactionExternalId,
  derivePowensTransactionFields,
} from '@finance-os/powens'
import { and, desc, eq, sql } from 'drizzle-orm'
import type {
  ApiDb,
  DashboardDerivedRecomputeRepository,
  DashboardDerivedRecomputeRowCounts,
} from '../types'

const RECOMPUTE_LOCK_NAMESPACE = 240326
const RECOMPUTE_LOCK_KEY = 1

const runSelection = {
  id: schema.derivedRecomputeRun.id,
  snapshotVersion: schema.derivedRecomputeRun.snapshotVersion,
  status: schema.derivedRecomputeRun.status,
  triggerSource: schema.derivedRecomputeRun.triggerSource,
  requestId: schema.derivedRecomputeRun.requestId,
  stage: schema.derivedRecomputeRun.stage,
  rowCounts: schema.derivedRecomputeRun.rowCounts,
  safeErrorCode: schema.derivedRecomputeRun.safeErrorCode,
  safeErrorMessage: schema.derivedRecomputeRun.safeErrorMessage,
  isCurrentSnapshot: schema.derivedRecomputeRun.isCurrentSnapshot,
  startedAt: schema.derivedRecomputeRun.startedAt,
  finishedAt: schema.derivedRecomputeRun.finishedAt,
  durationMs: schema.derivedRecomputeRun.durationMs,
} as const

const buildFallbackTransactionKey = (params: {
  connectionId: string
  accountId: string
  bookingDate: string
  amount: string
}) => {
  return `${params.connectionId}::${params.accountId}::${params.bookingDate}::${params.amount}`
}

const sameInstant = (left: Date | null, right: Date | null) => {
  return (left?.getTime() ?? null) === (right?.getTime() ?? null)
}

export const createDashboardDerivedRecomputeRepository = ({
  db,
}: {
  db: ApiDb
}): DashboardDerivedRecomputeRepository => {
  return {
    async getLatestRun() {
      const [row] = await db
        .select(runSelection)
        .from(schema.derivedRecomputeRun)
        .orderBy(desc(schema.derivedRecomputeRun.startedAt), desc(schema.derivedRecomputeRun.id))
        .limit(1)

      return row ?? null
    },

    async getCurrentSnapshotRun() {
      const [row] = await db
        .select(runSelection)
        .from(schema.derivedRecomputeRun)
        .where(eq(schema.derivedRecomputeRun.isCurrentSnapshot, true))
        .orderBy(desc(schema.derivedRecomputeRun.finishedAt), desc(schema.derivedRecomputeRun.id))
        .limit(1)

      return row ?? null
    },

    async createRun(input) {
      const [row] = await db
        .insert(schema.derivedRecomputeRun)
        .values({
          snapshotVersion: input.snapshotVersion,
          triggerSource: input.triggerSource,
          requestId: input.requestId,
          stage: input.stage,
          startedAt: input.startedAt,
        })
        .returning(runSelection)

      if (!row) {
        throw new Error('Failed to create derived recompute run')
      }

      return row
    },

    async updateRunProgress(input) {
      await db
        .update(schema.derivedRecomputeRun)
        .set({
          stage: input.stage,
          ...(input.rowCounts ? { rowCounts: input.rowCounts } : {}),
        })
        .where(eq(schema.derivedRecomputeRun.id, input.runId))
    },

    async markRunFailed(input) {
      await db
        .update(schema.derivedRecomputeRun)
        .set({
          status: 'failed',
          stage: input.stage,
          ...(input.rowCounts ? { rowCounts: input.rowCounts } : {}),
          safeErrorCode: input.safeErrorCode,
          safeErrorMessage: input.safeErrorMessage,
          finishedAt: input.finishedAt,
          durationMs: input.durationMs,
          isCurrentSnapshot: false,
        })
        .where(eq(schema.derivedRecomputeRun.id, input.runId))
    },

    async acquireRunLock() {
      const rows = (await db.execute(
        sql`select pg_try_advisory_lock(${RECOMPUTE_LOCK_NAMESPACE}, ${RECOMPUTE_LOCK_KEY}) as acquired`
      )) as Array<{ acquired: boolean }>

      return rows[0]?.acquired ?? false
    },

    async releaseRunLock() {
      await db.execute(
        sql`select pg_advisory_unlock(${RECOMPUTE_LOCK_NAMESPACE}, ${RECOMPUTE_LOCK_KEY})`
      )
    },

    async recomputeFromSourceOfTruth(input) {
      return db.transaction(async tx => {
        const rawTransactionImports = await tx
          .select({
            id: schema.providerRawImport.id,
            providerConnectionId: schema.providerRawImport.providerConnectionId,
            externalObjectId: schema.providerRawImport.externalObjectId,
            parentExternalObjectId: schema.providerRawImport.parentExternalObjectId,
            providerObjectAt: schema.providerRawImport.providerObjectAt,
            payload: schema.providerRawImport.payload,
          })
          .from(schema.providerRawImport)
          .where(
            and(
              eq(schema.providerRawImport.objectType, 'transaction'),
              eq(schema.providerRawImport.importStatus, 'normalized')
            )
          )

        const transactions = await tx
          .select({
            id: schema.transaction.id,
            powensConnectionId: schema.transaction.powensConnectionId,
            powensTransactionId: schema.transaction.powensTransactionId,
            powensAccountId: schema.transaction.powensAccountId,
            bookingDate: schema.transaction.bookingDate,
            amount: schema.transaction.amount,
            label: schema.transaction.label,
            labelHash: schema.transaction.labelHash,
            category: schema.transaction.category,
            merchant: schema.transaction.merchant,
          })
          .from(schema.transaction)

        const transactionByExternalId = new Map<string, (typeof transactions)[number]>()
        const fallbackTransactionsByKey = new Map<string, Array<(typeof transactions)[number]>>()

        for (const transaction of transactions) {
          if (transaction.powensTransactionId) {
            transactionByExternalId.set(
              `${transaction.powensConnectionId}::${transaction.powensTransactionId}`,
              transaction
            )
            continue
          }

          const fallbackKey = buildFallbackTransactionKey({
            connectionId: transaction.powensConnectionId,
            accountId: transaction.powensAccountId,
            bookingDate: transaction.bookingDate,
            amount: transaction.amount,
          })
          const existing = fallbackTransactionsByKey.get(fallbackKey) ?? []
          existing.push(transaction)
          fallbackTransactionsByKey.set(fallbackKey, existing)
        }

        const transactionUpdates: Array<{
          transactionId: number
          label: string
          labelHash: string
          category: string
          merchant: string
        }> = []
        const rawImportUpdates: Array<{
          rawImportId: number
          providerObjectAt: Date | null
        }> = []
        const snapshotRows: Array<typeof schema.derivedTransactionSnapshot.$inferInsert> = []

        let transactionMatchedCount = 0
        let transactionUpdatedCount = 0
        let transactionSkippedCount = 0
        let rawImportTimestampUpdatedCount = 0

        for (const rawImport of rawTransactionImports) {
          const derived = derivePowensTransactionFields(rawImport.payload)
          if (!derived) {
            transactionSkippedCount += 1
            continue
          }

          const payloadTransactionId = derivePowensTransactionExternalId(rawImport.payload)
          const transactionId =
            payloadTransactionId ??
            (rawImport.externalObjectId.startsWith('sha256:') ? null : rawImport.externalObjectId)

          let matchedTransaction: (typeof transactions)[number] | null = null

          if (transactionId) {
            matchedTransaction =
              transactionByExternalId.get(`${rawImport.providerConnectionId}::${transactionId}`) ??
              null
          } else if (rawImport.parentExternalObjectId) {
            const fallbackMatches =
              fallbackTransactionsByKey.get(
                buildFallbackTransactionKey({
                  connectionId: rawImport.providerConnectionId,
                  accountId: rawImport.parentExternalObjectId,
                  bookingDate: derived.bookingDate,
                  amount: derived.amount,
                })
              ) ?? []

            matchedTransaction = fallbackMatches.length === 1 ? (fallbackMatches[0] ?? null) : null
          }

          if (!matchedTransaction) {
            transactionSkippedCount += 1
            continue
          }

          transactionMatchedCount += 1

          snapshotRows.push({
            runId: input.runId,
            transactionId: matchedTransaction.id,
            providerRawImportId: rawImport.id,
            label: derived.label,
            labelHash: derived.labelHash,
            category: derived.category,
            merchant: derived.merchant,
            providerObjectAt: derived.providerObjectAt,
          })

          const transactionChanged =
            matchedTransaction.label !== derived.label ||
            matchedTransaction.labelHash !== derived.labelHash ||
            (matchedTransaction.category ?? null) !== derived.category ||
            (matchedTransaction.merchant ?? null) !== derived.merchant

          if (transactionChanged) {
            transactionUpdates.push({
              transactionId: matchedTransaction.id,
              label: derived.label,
              labelHash: derived.labelHash,
              category: derived.category,
              merchant: derived.merchant,
            })
            transactionUpdatedCount += 1
          }

          if (!sameInstant(rawImport.providerObjectAt, derived.providerObjectAt)) {
            rawImportUpdates.push({
              rawImportId: rawImport.id,
              providerObjectAt: derived.providerObjectAt,
            })
            rawImportTimestampUpdatedCount += 1
          }
        }

        const rowCounts: DashboardDerivedRecomputeRowCounts = {
          rawTransactionCount: rawTransactionImports.length,
          transactionMatchedCount,
          transactionUpdatedCount,
          transactionUnchangedCount: transactionMatchedCount - transactionUpdatedCount,
          transactionSkippedCount,
          rawImportTimestampUpdatedCount,
          snapshotRowCount: snapshotRows.length,
        }

        if (snapshotRows.length > 0) {
          await tx.insert(schema.derivedTransactionSnapshot).values(snapshotRows)
        }

        if (transactionUpdates.length > 0) {
          await tx.execute(sql`
            with staged as (
              select
                (value->>'transactionId')::int as transaction_id,
                value->>'label' as label,
                value->>'labelHash' as label_hash,
                value->>'category' as category,
                value->>'merchant' as merchant
              from jsonb_array_elements(${JSON.stringify(transactionUpdates)}::jsonb) value
            )
            update "transaction" as transaction_row
            set
              label = staged.label,
              label_hash = staged.label_hash,
              category = staged.category,
              merchant = staged.merchant
            from staged
            where transaction_row.id = staged.transaction_id
          `)
        }

        if (rawImportUpdates.length > 0) {
          await tx.execute(sql`
            with staged as (
              select
                (value->>'rawImportId')::int as raw_import_id,
                case
                  when value->>'providerObjectAt' is null then null
                  else (value->>'providerObjectAt')::timestamptz
                end as provider_object_at
              from jsonb_array_elements(${JSON.stringify(
                rawImportUpdates.map(row => ({
                  rawImportId: row.rawImportId,
                  providerObjectAt: row.providerObjectAt
                    ? row.providerObjectAt.toISOString()
                    : null,
                }))
              )}::jsonb) value
            )
            update provider_raw_import as raw_import
            set provider_object_at = staged.provider_object_at
            from staged
            where raw_import.id = staged.raw_import_id
          `)
        }

        await tx
          .update(schema.derivedRecomputeRun)
          .set({
            isCurrentSnapshot: false,
          })
          .where(eq(schema.derivedRecomputeRun.isCurrentSnapshot, true))

        const finishedAt = new Date()
        const durationMs = finishedAt.getTime() - input.startedAt.getTime()

        await tx
          .update(schema.derivedRecomputeRun)
          .set({
            status: 'completed',
            stage: 'completed',
            rowCounts,
            safeErrorCode: null,
            safeErrorMessage: null,
            isCurrentSnapshot: true,
            finishedAt,
            durationMs,
          })
          .where(eq(schema.derivedRecomputeRun.id, input.runId))

        return {
          rowCounts,
          finishedAt,
          durationMs,
        }
      })
    },
  }
}
