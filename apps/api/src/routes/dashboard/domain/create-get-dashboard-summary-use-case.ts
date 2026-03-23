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
  getFlowTotals: (fromDate: string) => Promise<{ income: string; expenses: string }>
  listTopExpenseGroups: (
    fromDate: string,
    limit: number
  ) => Promise<Array<{ category: string; merchant: string; total: string; count: number }>>
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

export const createGetDashboardSummaryUseCase = ({
  listAccountsWithConnections,
  getFlowTotals,
  listTopExpenseGroups,
}: CreateGetDashboardSummaryUseCaseDependencies): DashboardUseCases['getSummary'] => {
  return async range => {
    const fromDate = getRangeStartDate(range)

    const [accounts, flowTotals, topExpenseGroups] = await Promise.all([
      listAccountsWithConnections(),
      getFlowTotals(fromDate),
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

    const totalBalance = accountSummaries.reduce(
      (sum, account) => toMoney(sum + account.balance),
      0
    )

    return {
      range,
      totals: {
        balance: totalBalance,
        incomes: toMoney(toNumber(flowTotals.income)),
        expenses: toMoney(toNumber(flowTotals.expenses)),
      },
      connections: Array.from(perConnection.values()),
      accounts: accountSummaries,
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
