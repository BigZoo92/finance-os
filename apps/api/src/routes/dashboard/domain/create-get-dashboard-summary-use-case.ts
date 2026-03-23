import type { DashboardSummaryResponse, DashboardUseCases } from '../types'
import { getRangeStartDate } from '../utils/range'

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
  getFlowTotals: (fromDate: string) => Promise<{ income: string; expenses: string }>
  listDailyNetFlows: (fromDate: string) => Promise<Array<{ bookingDate: string; netAmount: string }>>
  listTopExpenseGroups: (
    fromDate: string,
    limit: number
  ) => Promise<Array<{ category: string; merchant: string; total: string; count: number }>>
  now?: () => Date
}

const toNumber = (value: string | number | null | undefined) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return 0
}

const toMoney = (value: number) => {
  return Math.round(value * 100) / 100
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
    dailyNetFlows.map(flow => [flow.bookingDate, toMoney(toNumber(flow.netAmount))])
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
  getFlowTotals,
  listDailyNetFlows,
  listTopExpenseGroups,
  now = () => new Date(),
}: CreateGetDashboardSummaryUseCaseDependencies): DashboardUseCases['getSummary'] => {
  return async range => {
    const currentDate = now()
    const fromDate = getRangeStartDate(range, currentDate)
    const toDate = toDateOnly(currentDate)

    const [accounts, assets, flowTotals, dailyNetFlows, topExpenseGroups] = await Promise.all([
      listAccountsWithConnections(),
      listAssets(),
      getFlowTotals(fromDate),
      listDailyNetFlows(fromDate),
      listTopExpenseGroups(fromDate, 5),
    ])

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
        balance: number
        accountCount: number
      }
    >()

    const accountSummaries: DashboardSummaryResponse['accounts'] = []
    const assetSummaries: DashboardSummaryResponse['assets'] = assets
      .filter(asset => asset.enabled)
      .map(asset => ({
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
        valuation: toMoney(toNumber(asset.valuation)),
        valuationAsOf: toIsoString(asset.valuationAsOf),
        enabled: asset.enabled,
        metadata: asset.metadata,
      }))

    for (const account of accounts) {
      if (!account.enabled) {
        continue
      }

      const balance = toMoney(toNumber(account.accountBalance))

      accountSummaries.push({
        powensAccountId: account.powensAccountId,
        powensConnectionId: account.powensConnectionId,
        name: account.accountName,
        currency: account.accountCurrency,
        type: account.accountType,
        enabled: account.enabled,
        balance,
      })

      const existing = perConnection.get(account.powensConnectionId)
      if (existing) {
        existing.balance = toMoney(existing.balance + balance)
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

    const totalBalance = assetSummaries.reduce((sum, asset) => toMoney(sum + asset.valuation), 0)
    const dailyWealthSnapshots = buildDailyWealthSnapshots({
      fromDate,
      toDate,
      totalBalance,
      dailyNetFlows,
    })

    return {
      range,
      totals: {
        balance: totalBalance,
        incomes: toMoney(toNumber(flowTotals.income)),
        expenses: toMoney(toNumber(flowTotals.expenses)),
      },
      connections: Array.from(perConnection.values()),
      accounts: accountSummaries,
      assets: assetSummaries,
      dailyWealthSnapshots,
      topExpenseGroups: topExpenseGroups.map(group => ({
        label: makeGroupLabel(group.category, group.merchant),
        category: group.category,
        merchant: group.merchant,
        total: toMoney(toNumber(group.total)),
        count: group.count,
      })),
    }
  }
}
