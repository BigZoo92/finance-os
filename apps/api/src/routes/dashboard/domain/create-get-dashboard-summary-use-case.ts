import type { DashboardSummaryResponse, DashboardUseCases } from '../types'
import { getRangeStartDate } from '../utils/range'

interface CreateGetDashboardSummaryUseCaseDependencies {
  listAccountsWithConnections: () => Promise<
    Array<{
      powensAccountId: string
      powensConnectionId: string
      accountName: string
      accountCurrency: string
      accountType: string | null
      enabled: boolean
      accountRaw: unknown
      connectionStatus: 'connected' | 'syncing' | 'error' | 'reconnect_required' | null
      lastSyncAt: Date | null
      lastSuccessAt: Date | null
      lastError: string | null
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

const extractBalanceFromRaw = (raw: unknown) => {
  if (!raw || typeof raw !== 'object') {
    return 0
  }

  const source = raw as Record<string, unknown>
  const candidates = ['balance', 'current_balance', 'available_balance']

  for (const key of candidates) {
    const candidate = source[key]

    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }

    if (typeof candidate === 'string') {
      const parsed = Number(candidate)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }

    const nestedValue =
      typeof candidate === 'object' && candidate && 'value' in candidate
        ? (candidate as { value?: number | string }).value
        : undefined

    if (typeof nestedValue === 'number' && Number.isFinite(nestedValue)) {
      return nestedValue
    }

    if (typeof nestedValue === 'string') {
      const parsed = Number(nestedValue)
      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  return 0
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
        status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
        lastSyncAt: string | null
        lastSuccessAt: string | null
        lastError: string | null
        balance: number
        accountCount: number
      }
    >()

    const accountSummaries: DashboardSummaryResponse['accounts'] = []

    for (const account of accounts) {
      if (!account.enabled) {
        continue
      }

      const balance = toMoney(extractBalanceFromRaw(account.accountRaw))

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
        status: account.connectionStatus ?? 'connected',
        lastSyncAt: toIsoString(account.lastSyncAt),
        lastSuccessAt: toIsoString(account.lastSuccessAt),
        lastError: account.lastError,
        balance,
        accountCount: 1,
      })
    }

    const totalBalance = accountSummaries.reduce((sum, account) => toMoney(sum + account.balance), 0)

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
