import type { ItemValuation, ValuationCoverageReport } from '@finance-os/finance-engine'
import type { DashboardSummaryResponse, DashboardUseCases } from '../types'
import { getRangeStartDate } from '../utils/range'

export interface DashboardValuationOverlay {
  valuations: ItemValuation[]
  coverage: ValuationCoverageReport
}

interface CreateGetDashboardSummaryUseCaseDependencies {
  listAccountsWithConnections: () => Promise<
    Array<{
      powensAccountId: string
      powensConnectionId: string
      source: string | null
      provider: string | null
      providerConnectionId: string | null
      providerInstitutionId: string | null
      providerInstitutionName: string | null
      accountName: string
      accountCurrency: string
      accountType: string | null
      accountMetadata: Record<string, unknown> | null
      enabled: boolean
      accountBalance: string | null
      connectionStatus: 'connected' | 'syncing' | 'error' | 'reconnect_required' | null
      lastSyncAttemptAt: Date | null
      lastSyncAt: Date | null
      lastSuccessAt: Date | null
      lastFailedAt: Date | null
      lastError: string | null
      syncMetadata: Record<string, unknown> | null
    }>
  >
  listAssets: () => Promise<
    Array<{
      assetId: number
      assetType: 'cash' | 'investment' | 'manual'
      origin: 'provider' | 'manual'
      source: string
      provider: string | null
      providerConnectionId: string | null
      providerExternalAssetId: string | null
      providerInstitutionName: string | null
      powensConnectionId: string | null
      powensAccountId: string | null
      name: string
      currency: string
      valuation: string | null
      valuationAsOf: Date | null
      enabled: boolean
      metadata: Record<string, unknown> | null
    }>
  >
  listInvestmentPositions: () => Promise<
    Array<{
      positionId: number
      positionKey: string
      assetId: number | null
      powensAccountId: string | null
      powensConnectionId: string | null
      source: string
      provider: string | null
      providerConnectionId: string | null
      providerPositionId: string | null
      assetName: string | null
      accountName: string | null
      name: string
      currency: string
      quantity: string | null
      costBasis: string | null
      costBasisSource: 'minimal' | 'provider' | 'manual' | 'unknown'
      currentValue: string | null
      lastKnownValue: string | null
      openedAt: Date | null
      closedAt: Date | null
      valuedAt: Date | null
      lastSyncedAt: Date | null
      metadata: Record<string, unknown> | null
    }>
  >
  getFlowTotals: (fromDate: string) => Promise<{ income: string; expenses: string }>
  listDailyNetFlows: (fromDate: string) => Promise<Array<{ bookingDate: string; netAmount: string }>>
  listTopExpenseGroups: (
    fromDate: string,
    limit: number
  ) => Promise<Array<{ category: string; merchant: string; total: string; count: number }>>
  /**
   * Canonical valuation overlay (Financial Data Core). Optional and fail-soft:
   * a null result yields `valuation: null` and null per-item statuses, never 0.
   */
  getValuationOverlay?: () => Promise<DashboardValuationOverlay | null>
  now?: () => Date
}

// A missing or malformed persisted amount is unknown, never 0.
const toNumberOrNull = (value: string | number | null | undefined): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return null
}

const toMoney = (value: number) => {
  return Math.round(value * 100) / 100
}

const toMoneyOrNull = (value: string | number | null | undefined): number | null => {
  const parsed = toNumberOrNull(value)
  return parsed === null ? null : toMoney(parsed)
}

const toIsoString = (value: Date | null) => value?.toISOString() ?? null
const toDateOnly = (value: Date) => value.toISOString().slice(0, 10)

const makeGroupLabel = (category: string, merchant: string) => {
  if (category !== 'Unknown') {
    return category
  }

  const cleanMerchant = merchant.trim()
  if (cleanMerchant.length === 0) {
    return 'Unknown'
  }

  const clipped = cleanMerchant.slice(0, 36)
  return `Unknown - ${clipped}`
}

const listDatesInRange = ({ fromDate, toDate }: { fromDate: string; toDate: string }) => {
  const dates: string[] = []
  const cursor = new Date(`${fromDate}T00:00:00.000Z`)
  const end = new Date(`${toDate}T00:00:00.000Z`)

  while (cursor.getTime() <= end.getTime()) {
    dates.push(toDateOnly(cursor))
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }

  return dates
}

const buildDailyWealthSnapshots = ({
  fromDate,
  toDate,
  totalBalance,
  dailyNetFlows,
}: {
  fromDate: string
  toDate: string
  totalBalance: number
  dailyNetFlows: Array<{ bookingDate: string; netAmount: string }>
}): DashboardSummaryResponse['dailyWealthSnapshots'] => {
  const dates = listDatesInRange({ fromDate, toDate })
  const netFlowByDate = new Map(
    dailyNetFlows.flatMap(flow => {
      const netAmount = toMoneyOrNull(flow.netAmount)
      return netAmount === null ? [] : [[flow.bookingDate, netAmount] as const]
    })
  )

  let runningBalance = totalBalance
  const snapshotsDescending: DashboardSummaryResponse['dailyWealthSnapshots'] = []

  for (const date of [...dates].reverse()) {
    snapshotsDescending.push({
      date,
      balance: toMoney(runningBalance),
    })

    runningBalance = toMoney(runningBalance - (netFlowByDate.get(date) ?? 0))
  }

  return snapshotsDescending.reverse()
}

export const createGetDashboardSummaryUseCase = ({
  listAccountsWithConnections,
  listAssets,
  listInvestmentPositions,
  getFlowTotals,
  listDailyNetFlows,
  listTopExpenseGroups,
  getValuationOverlay,
  now = () => new Date(),
}: CreateGetDashboardSummaryUseCaseDependencies): DashboardUseCases['getSummary'] => {
  return async range => {
    const currentDate = now()
    const fromDate = getRangeStartDate(range, currentDate)
    const toDate = toDateOnly(currentDate)

    const [accounts, assets, positions, flowTotals, dailyNetFlows, topExpenseGroups, overlay] =
      await Promise.all([
        listAccountsWithConnections(),
        listAssets(),
        listInvestmentPositions(),
        getFlowTotals(fromDate),
        listDailyNetFlows(fromDate),
        listTopExpenseGroups(fromDate, 5),
        getValuationOverlay ? getValuationOverlay() : Promise.resolve(null),
      ])

    const valuationByItemKey = new Map<string, ItemValuation>(
      overlay?.valuations.map(valuation => [valuation.itemKey, valuation]) ?? []
    )

    const perConnection = new Map<
      string,
      {
        powensConnectionId: string
        source: string
        provider: string
        providerConnectionId: string
        providerInstitutionId: string | null
        providerInstitutionName: string | null
        status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
        lastSyncAttemptAt: string | null
        lastSyncAt: string | null
        lastSuccessAt: string | null
        lastFailedAt: string | null
        lastError: string | null
        syncMetadata: Record<string, unknown> | null
        balance: number | null
        accountCount: number
      }
    >()

    const accountSummaries: DashboardSummaryResponse['accounts'] = []
    const assetSummaries: DashboardSummaryResponse['assets'] = assets
      .filter(asset => asset.enabled)
      .map(asset => {
        // Bridged external assets are valued through their canonical
        // external position (itemKey === providerExternalAssetId).
        const itemKey =
          asset.source === 'external_investment' && asset.providerExternalAssetId
            ? asset.providerExternalAssetId
            : `asset:${asset.assetId}`
        const itemValuation = valuationByItemKey.get(itemKey)
        return {
          assetId: asset.assetId,
          type: asset.assetType,
          origin: asset.origin,
          source: asset.source,
          provider: asset.provider,
          providerConnectionId: asset.providerConnectionId,
          providerInstitutionName: asset.providerInstitutionName,
          powensConnectionId: asset.powensConnectionId,
          powensAccountId: asset.powensAccountId,
          name: asset.name,
          currency: asset.currency,
          valuation: toMoneyOrNull(asset.valuation),
          valuationAsOf: toIsoString(asset.valuationAsOf),
          valueBase: itemValuation?.valueBase ?? null,
          valuationStatus: itemValuation?.status ?? null,
          enabled: asset.enabled,
          metadata: asset.metadata,
        }
      })

    const positionSummaries: DashboardSummaryResponse['positions'] = positions.map(position => {
      const itemValuation = valuationByItemKey.get(`position:${position.positionKey}`)
      return {
      positionId: position.positionId,
      positionKey: position.positionKey,
      assetId: position.assetId,
      powensAccountId: position.powensAccountId,
      powensConnectionId: position.powensConnectionId,
      source: position.source,
      provider: position.provider,
      providerConnectionId: position.providerConnectionId,
      providerPositionId: position.providerPositionId,
      assetName: position.assetName,
      accountName: position.accountName,
      name: position.name,
      currency: position.currency,
      quantity: toNumberOrNull(position.quantity),
      costBasis: toMoneyOrNull(position.costBasis),
      costBasisSource: position.costBasisSource,
      currentValue: toMoneyOrNull(position.currentValue),
      lastKnownValue: toMoneyOrNull(position.lastKnownValue),
      openedAt: toIsoString(position.openedAt),
      closedAt: toIsoString(position.closedAt),
      valuedAt: toIsoString(position.valuedAt),
      lastSyncedAt: toIsoString(position.lastSyncedAt),
      valueBase: itemValuation?.valueBase ?? null,
      valuationStatus: itemValuation?.status ?? null,
      enabled: position.closedAt === null,
      metadata: position.metadata,
      }
    })

    for (const account of accounts) {
      if (!account.enabled) {
        continue
      }

      const balance = toMoneyOrNull(account.accountBalance)

      accountSummaries.push({
        powensAccountId: account.powensAccountId,
        powensConnectionId: account.powensConnectionId,
        name: account.accountName,
        currency: account.accountCurrency,
        type: account.accountType,
        metadata: account.accountMetadata,
        enabled: account.enabled,
        balance,
      })

      const existing = perConnection.get(account.powensConnectionId)
      if (existing) {
        // One unknown account balance makes the connection total unknown: a
        // partial sum would read as a precise total.
        existing.balance =
          existing.balance === null || balance === null
            ? null
            : toMoney(existing.balance + balance)
        existing.accountCount += 1
        continue
      }

      perConnection.set(account.powensConnectionId, {
        powensConnectionId: account.powensConnectionId,
        source: account.source ?? 'banking',
        provider: account.provider ?? 'powens',
        providerConnectionId: account.providerConnectionId ?? account.powensConnectionId,
        providerInstitutionId: account.providerInstitutionId,
        providerInstitutionName: account.providerInstitutionName,
        status: account.connectionStatus ?? 'connected',
        lastSyncAttemptAt: toIsoString(account.lastSyncAttemptAt),
        lastSyncAt: toIsoString(account.lastSyncAt),
        lastSuccessAt: toIsoString(account.lastSuccessAt),
        lastFailedAt: toIsoString(account.lastFailedAt),
        lastError: account.lastError,
        syncMetadata: account.syncMetadata,
        balance,
        accountCount: 1,
      })
    }

    // The legacy total is only meaningful when every enabled asset is valued.
    // Unvalued assets are counted, and the total becomes unknown, not smaller.
    const unknownValuationAssetCount = assetSummaries.filter(
      asset => asset.valuation === null
    ).length
    const totalBalance =
      unknownValuationAssetCount > 0
        ? null
        : assetSummaries.reduce((sum, asset) => toMoney(sum + (asset.valuation ?? 0)), 0)
    const dailyWealthSnapshots =
      totalBalance === null
        ? []
        : buildDailyWealthSnapshots({
            fromDate,
            toDate,
            totalBalance,
            dailyNetFlows,
          })

    const valuationBlock: DashboardSummaryResponse['valuation'] = overlay
      ? (() => {
          const knownPnl = overlay.valuations
            .map(valuation => valuation.unrealizedPnlBase)
            .filter((value): value is number => value !== null)
          return {
            baseCurrency: overlay.coverage.baseCurrency,
            totalValueBase: overlay.coverage.totalValueBase,
            coveragePercent: overlay.coverage.coveragePercent,
            statusCounts: overlay.coverage.statusCounts,
            unknownValueCount: overlay.coverage.unknownValueCount,
            totalUnrealizedPnlBase:
              knownPnl.length > 0
                ? toMoney(knownPnl.reduce((sum, value) => sum + value, 0))
                : null,
            pnlCoverageCount: knownPnl.length,
            asOf: currentDate.toISOString(),
          }
        })()
      : null

    return {
      range,
      totals: {
        balance: totalBalance,
        unknownValuationAssetCount,
        // Period flow sums are SQL aggregates coalesced to 0: an empty period
        // is a true zero, unlike a missing valuation.
        incomes: toMoneyOrNull(flowTotals.income) ?? 0,
        expenses: toMoneyOrNull(flowTotals.expenses) ?? 0,
      },
      valuation: valuationBlock,
      connections: Array.from(perConnection.values()),
      accounts: accountSummaries,
      assets: assetSummaries,
      positions: positionSummaries,
      dailyWealthSnapshots,
      // A group whose SQL total cannot be parsed is dropped, not shown as 0.
      topExpenseGroups: topExpenseGroups.flatMap(group => {
        const total = toMoneyOrNull(group.total)
        if (total === null) {
          return []
        }

        return [
          {
            label: makeGroupLabel(group.category, group.merchant),
            category: group.category,
            merchant: group.merchant,
            total,
            count: group.count,
          },
        ]
      }),
    }
  }
}
