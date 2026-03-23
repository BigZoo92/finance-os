export type DashboardRange = '7d' | '30d' | '90d'

export type DashboardSummaryResponse = {
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
  topExpenseGroups: Array<{
    label: string
    category: string
    merchant: string
    total: number
    count: number
  }>
}

export type DashboardTransactionsResponse = {
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
