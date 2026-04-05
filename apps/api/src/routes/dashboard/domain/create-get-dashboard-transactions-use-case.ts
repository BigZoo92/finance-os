import type { DashboardUseCases } from '../types'
import { decodeDashboardCursor, encodeDashboardCursor } from '../utils/cursor'
import { getRangeStartDate } from '../utils/range'
import { applyTransactionAutoCategorization } from './transaction-auto-categorization'

interface CreateGetDashboardTransactionsUseCaseDependencies {
  listTransactions: (params: {
    fromDate: string
    limit: number
    cursor: { bookingDate: string; id: number } | null
  }) => Promise<
    Array<{
      id: number
      bookingDate: string
      amount: string
      currency: string
      label: string
      merchant: string
      category: string | null
      providerCategory: string | null
      customCategory: string | null
      customSubcategory: string | null
      subcategory: string | null
      incomeType: 'salary' | 'recurring' | 'exceptional' | null
      tags: string[]
      powensConnectionId: string
      powensAccountId: string
      accountName: string | null
    }>
  >
  listTransactionSyncMetadata: (
    connectionIds: string[]
  ) => Promise<
    Array<{
      powensConnectionId: string
      connectionStatus: 'connected' | 'syncing' | 'error' | 'reconnect_required' | null
      lastSyncStatus: 'OK' | 'KO' | null
      lastSyncReasonCode: 'SUCCESS' | 'PARTIAL_IMPORT' | 'SYNC_FAILED' | 'RECONNECT_REQUIRED' | null
      lastSyncAt: Date | null
      lastSyncAttemptAt: Date | null
      lastFailedAt: Date | null
    }>
  >
  now: () => Date
  staleAfterMinutes: number
}

const toMoney = (value: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

export const createGetDashboardTransactionsUseCase = ({
  listTransactions,
  listTransactionSyncMetadata,
  now,
  staleAfterMinutes,
}: CreateGetDashboardTransactionsUseCaseDependencies): DashboardUseCases['getTransactions'] => {
  return async input => {
    const fromDate = getRangeStartDate(input.range)
    const decodedCursor = decodeDashboardCursor(input.cursor)
    const queryLimit = input.limit + 1

    const rows = await listTransactions({
      fromDate,
      limit: queryLimit,
      cursor: decodedCursor,
    })

    const hasNextPage = rows.length > input.limit
    const visibleRows = hasNextPage ? rows.slice(0, input.limit) : rows
    const tail = visibleRows[visibleRows.length - 1]

    const connectionIds = [...new Set(visibleRows.map(row => row.powensConnectionId))]
    const syncMetadata = await listTransactionSyncMetadata(connectionIds)
    const latestSyncedAtMs = syncMetadata.reduce<number | null>((latest, row) => {
      const current = row.lastSyncAt?.getTime()
      if (!Number.isFinite(current)) {
        return latest
      }
      return latest === null ? (current ?? null) : Math.max(latest, current ?? 0)
    }, null)
    const snapshotAgeSeconds =
      latestSyncedAtMs === null ? null : Math.max(0, Math.round((now().getTime() - latestSyncedAtMs) / 1000))
    const staleThresholdSeconds = staleAfterMinutes * 60
    const hasSyncing = syncMetadata.some(row => row.connectionStatus === 'syncing')
    const hasFailures = syncMetadata.some(
      row =>
        row.connectionStatus === 'error' ||
        row.connectionStatus === 'reconnect_required' ||
        row.lastSyncStatus === 'KO'
    )
    const syncStatus =
      visibleRows.length === 0 && latestSyncedAtMs === null
        ? ('no-data-first-connect' as const)
        : hasSyncing
          ? ('syncing' as const)
          : hasFailures
            ? ('sync-failed-with-safe-data' as const)
            : snapshotAgeSeconds !== null && snapshotAgeSeconds > staleThresholdSeconds
              ? ('stale-but-usable' as const)
              : ('fresh' as const)
    const degradedReason =
      syncStatus === 'stale-but-usable'
        ? 'snapshot_stale'
        : syncStatus === 'sync-failed-with-safe-data'
          ? 'powens_refresh_failed'
          : syncStatus === 'no-data-first-connect'
            ? 'powens_first_connect_pending'
            : null

    return {
      schemaVersion: '2026-04-04',
      range: input.range,
      limit: input.limit,
      nextCursor:
        hasNextPage && tail
          ? encodeDashboardCursor({
              bookingDate: tail.bookingDate,
              id: tail.id,
            })
          : null,
      freshness: {
        strategy: 'snapshot-first',
        lastSyncedAt: latestSyncedAtMs === null ? null : new Date(latestSyncedAtMs).toISOString(),
        syncStatus,
        degradedReason,
        snapshotAgeSeconds,
        refreshRequested: false,
      },
      items: visibleRows.map(row => {
        const amount = toMoney(row.amount)
        const normalizedClassification = applyTransactionAutoCategorization({
          label: row.label,
          amount,
          powensAccountId: row.powensAccountId,
          accountName: row.accountName,
          merchant: row.merchant,
          providerCategory: row.providerCategory,
          customCategory: row.customCategory,
          customSubcategory: row.customSubcategory,
          category: row.category,
          subcategory: row.subcategory,
          incomeType: row.incomeType,
        })

        return {
          id: row.id,
          bookingDate: row.bookingDate,
          amount,
          currency: row.currency,
          direction: amount >= 0 ? 'income' : 'expense',
          label: row.label,
          merchant: row.merchant,
          category: normalizedClassification.category,
          subcategory: normalizedClassification.subcategory,
          incomeType: normalizedClassification.incomeType,
          resolvedCategory: normalizedClassification.resolvedCategory,
          resolutionSource: normalizedClassification.resolutionSource,
          resolutionRuleId: normalizedClassification.resolutionRuleId,
          resolutionTrace: normalizedClassification.resolutionTrace,
          tags: row.tags,
          powensConnectionId: row.powensConnectionId,
          powensAccountId: row.powensAccountId,
          accountName: row.accountName,
        }
      }),
    }
  }
}
