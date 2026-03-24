import type { createDbClient } from '@finance-os/db'

export type ApiDb = ReturnType<typeof createDbClient>['db']

export type DashboardRange = '7d' | '30d' | '90d'

export interface DashboardTransactionCursor {
  bookingDate: string
  id: number
}

export interface AccountWithConnectionRow {
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
}

export interface AssetRow {
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
}

export interface InvestmentPositionRow {
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
}

export interface DashboardFlowTotals {
  income: string
  expenses: string
}

export interface DashboardExpenseGroupRow {
  category: string
  merchant: string
  total: string
  count: number
}

export interface DashboardDailyNetFlowRow {
  bookingDate: string
  netAmount: string
}

export interface DashboardTransactionRow {
  id: number
  bookingDate: string
  amount: string
  currency: string
  label: string
  powensConnectionId: string
  powensAccountId: string
  accountName: string | null
}

export interface DashboardSummaryResponse {
  range: DashboardRange
  totals: {
    balance: number
    incomes: number
    expenses: number
  }
  connections: Array<{
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
  }>
  accounts: Array<{
    powensAccountId: string
    powensConnectionId: string
    name: string
    currency: string
    type: string | null
    enabled: boolean
    balance: number
  }>
  assets: Array<{
    assetId: number
    type: 'cash' | 'investment' | 'manual'
    origin: 'provider' | 'manual'
    source: string
    provider: string | null
    providerConnectionId: string | null
    providerInstitutionName: string | null
    powensConnectionId: string | null
    powensAccountId: string | null
    name: string
    currency: string
    valuation: number
    valuationAsOf: string | null
    enabled: boolean
    metadata: Record<string, unknown> | null
  }>
  positions: Array<{
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
    quantity: number | null
    costBasis: number | null
    costBasisSource: 'minimal' | 'provider' | 'manual' | 'unknown'
    currentValue: number | null
    lastKnownValue: number | null
    openedAt: string | null
    closedAt: string | null
    valuedAt: string | null
    lastSyncedAt: string | null
    enabled: boolean
    metadata: Record<string, unknown> | null
  }>
  dailyWealthSnapshots: Array<{
    date: string
    balance: number
  }>
  topExpenseGroups: Array<{
    label: string
    category: string
    merchant: string
    total: number
    count: number
  }>
}

export interface DashboardTransactionsResponse {
  range: DashboardRange
  limit: number
  nextCursor: string | null
  items: Array<{
    id: number
    bookingDate: string
    amount: number
    currency: string
    direction: 'income' | 'expense'
    label: string
    powensConnectionId: string
    powensAccountId: string
    accountName: string | null
  }>
}

export interface DashboardReadRepository {
  listAccountsWithConnections: () => Promise<AccountWithConnectionRow[]>
  listAssets: () => Promise<AssetRow[]>
  listInvestmentPositions: () => Promise<InvestmentPositionRow[]>
  getFlowTotals: (fromDate: string) => Promise<DashboardFlowTotals>
  listDailyNetFlows: (fromDate: string) => Promise<DashboardDailyNetFlowRow[]>
  listTopExpenseGroups: (fromDate: string, limit: number) => Promise<DashboardExpenseGroupRow[]>
  listTransactions: (params: {
    fromDate: string
    limit: number
    cursor: DashboardTransactionCursor | null
  }) => Promise<DashboardTransactionRow[]>
}

export interface DashboardUseCases {
  getSummary: (range: DashboardRange) => Promise<DashboardSummaryResponse>
  getTransactions: (input: {
    range: DashboardRange
    limit: number
    cursor: string | undefined
  }) => Promise<DashboardTransactionsResponse>
}

export interface DashboardRouteRuntime {
  repositories: {
    readModel: DashboardReadRepository
  }
  useCases: DashboardUseCases
}
