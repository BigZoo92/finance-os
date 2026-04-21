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
  categorizationMigration: {
    enabled: boolean
    rolloutPercent: number
    alertDisagreementRate: number
    shadowLatencyBudgetMs: number
  }
  onCategorizationMigrationEvaluated?: (snapshot: {
    mode: 'admin'
    evaluatedAt: string
    total: number
    rolloutPercent: number
    disagreements: number
    disagreementRate: number
    overAlertThreshold: boolean
    byMerchant: Array<{ key: string; total: number; disagreements: number }>
    byCategory: Array<{ key: string; total: number; disagreements: number }>
    byAccount: Array<{ key: string; total: number; disagreements: number }>
    shadowDisabledReason: 'disabled' | 'latency_budget_exceeded' | null
    shadowLatencyMs: number
  }) => void
}

const toMoney = (value: string) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return Math.round(parsed * 100) / 100
}

const toStableBucket = (value: string) => {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) % 100
  }
  return Math.abs(hash)
}

const summarizeDisagreement = (
  counters: Map<string, { total: number; disagreements: number }>
) => {
  return [...counters.entries()]
    .map(([key, entry]) => ({ key, total: entry.total, disagreements: entry.disagreements }))
    .sort((left, right) => {
      if (left.disagreements !== right.disagreements) {
        return right.disagreements - left.disagreements
      }
      if (left.total !== right.total) {
        return right.total - left.total
      }
      return left.key.localeCompare(right.key)
    })
    .slice(0, 8)
}

export const createGetDashboardTransactionsUseCase = ({
  listTransactions,
  listTransactionSyncMetadata,
  now,
  staleAfterMinutes,
  categorizationMigration,
  onCategorizationMigrationEvaluated,
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
    let syncMetadataFailed = false
    let syncMetadata: Awaited<ReturnType<typeof listTransactionSyncMetadata>> = []

    if (connectionIds.length > 0) {
      try {
        syncMetadata = await listTransactionSyncMetadata(connectionIds)
      } catch {
        syncMetadataFailed = true
      }
    }

    const metadataCoverage = new Set(syncMetadata.map(row => row.powensConnectionId))
    const hasMissingSyncMetadata = connectionIds.some(connectionId => !metadataCoverage.has(connectionId))
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
    const degradedByEnrichment = syncMetadataFailed || hasMissingSyncMetadata
    const syncStatus =
      visibleRows.length === 0 && latestSyncedAtMs === null
        ? ('no-data-first-connect' as const)
        : hasSyncing
          ? ('syncing' as const)
          : hasFailures || degradedByEnrichment
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

    const categorizationStartedAt = now().getTime()
    const merchantDisagreements = new Map<string, { total: number; disagreements: number }>()
    const categoryDisagreements = new Map<string, { total: number; disagreements: number }>()
    const accountDisagreements = new Map<string, { total: number; disagreements: number }>()
    let disagreementCount = 0

    const items = visibleRows.map(row => {
      const amount = toMoney(row.amount)
      const deterministicClassification = applyTransactionAutoCategorization({
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
      const legacyCategory = row.customCategory ?? row.category
      const legacySubcategory = row.customSubcategory ?? row.subcategory
      const legacyIncomeType = row.incomeType
      const disagreement =
        legacyCategory !== deterministicClassification.category ||
        legacySubcategory !== deterministicClassification.subcategory ||
        legacyIncomeType !== deterministicClassification.incomeType

      const shouldCutover =
        categorizationMigration.enabled &&
        toStableBucket(`${row.powensAccountId}:${row.id}`) < categorizationMigration.rolloutPercent

      const resolvedCategory = shouldCutover ? deterministicClassification.category : legacyCategory
      const resolvedSubcategory = shouldCutover
        ? deterministicClassification.subcategory
        : legacySubcategory
      const resolvedIncomeType = shouldCutover
        ? deterministicClassification.incomeType
        : legacyIncomeType

      if (disagreement) {
        disagreementCount += 1
      }

      const merchantKey = row.merchant.trim() || 'Unknown merchant'
      const categoryKey = (legacyCategory ?? 'Unknown').trim() || 'Unknown'
      const accountKey = (row.accountName ?? row.powensAccountId).trim() || row.powensAccountId
      const trackedKeys: Array<[Map<string, { total: number; disagreements: number }>, string]> = [
        [merchantDisagreements, merchantKey],
        [categoryDisagreements, categoryKey],
        [accountDisagreements, accountKey],
      ]
      for (const [counter, key] of trackedKeys) {
        const current = counter.get(key) ?? { total: 0, disagreements: 0 }
        current.total += 1
        if (disagreement) {
          current.disagreements += 1
        }
        counter.set(key, current)
      }

      const direction: 'income' | 'expense' = amount >= 0 ? 'income' : 'expense'

      return {
        id: row.id,
        bookingDate: row.bookingDate,
        amount,
        currency: row.currency,
        direction,
        label: row.label,
        merchant: row.merchant,
        category: resolvedCategory,
        subcategory: resolvedSubcategory,
        incomeType: resolvedIncomeType,
        resolvedCategory,
        resolutionSource: shouldCutover
          ? deterministicClassification.resolutionSource
          : ('fallback' as const),
        resolutionRuleId: shouldCutover ? deterministicClassification.resolutionRuleId : null,
        resolutionTrace: shouldCutover
          ? deterministicClassification.resolutionTrace
          : [
              {
                source: 'fallback' as const,
                rank: 5,
                matched: true,
                reason: 'migration_shadow_legacy_active',
                category: resolvedCategory,
                subcategory: resolvedSubcategory,
                ruleId: null,
              },
            ],
        tags: row.tags,
        powensConnectionId: row.powensConnectionId,
        powensAccountId: row.powensAccountId,
        accountName: row.accountName,
      }
    })
    const shadowLatencyMs = Math.max(0, now().getTime() - categorizationStartedAt)
    const shadowDisabledReason =
      !categorizationMigration.enabled
        ? 'disabled'
        : shadowLatencyMs > categorizationMigration.shadowLatencyBudgetMs
          ? 'latency_budget_exceeded'
          : null
    if (onCategorizationMigrationEvaluated) {
      const disagreementRate = items.length === 0 ? 0 : disagreementCount / items.length
      onCategorizationMigrationEvaluated({
        mode: 'admin',
        evaluatedAt: now().toISOString(),
        total: items.length,
        rolloutPercent: categorizationMigration.enabled ? categorizationMigration.rolloutPercent : 0,
        disagreements: disagreementCount,
        disagreementRate,
        overAlertThreshold: disagreementRate >= categorizationMigration.alertDisagreementRate,
        byMerchant: summarizeDisagreement(merchantDisagreements),
        byCategory: summarizeDisagreement(categoryDisagreements),
        byAccount: summarizeDisagreement(accountDisagreements),
        shadowDisabledReason,
        shadowLatencyMs,
      })
    }

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
      items,
    }
  }
}
