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
    category: string | null
    subcategory: string | null
    incomeType: 'salary' | 'recurring' | 'exceptional' | null
    tags: string[]
    powensConnectionId: string
    powensAccountId: string
    accountName: string | null
  }>
}

export type DashboardDerivedRecomputeRowCounts = {
  rawTransactionCount: number
  transactionMatchedCount: number
  transactionUpdatedCount: number
  transactionUnchangedCount: number
  transactionSkippedCount: number
  rawImportTimestampUpdatedCount: number
  snapshotRowCount: number
}

export type DashboardDerivedRecomputeRun = {
  snapshotVersion: string
  status: 'running' | 'completed' | 'failed'
  triggerSource: 'admin' | 'internal'
  requestId: string
  stage: string | null
  rowCounts: DashboardDerivedRecomputeRowCounts | null
  safeErrorCode: string | null
  safeErrorMessage: string | null
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
}

export type DashboardDerivedSnapshot = {
  snapshotVersion: string
  finishedAt: string
  rowCounts: DashboardDerivedRecomputeRowCounts | null
}

export type DashboardDerivedRecomputeStatusResponse = {
  featureEnabled: boolean
  state: 'idle' | 'running' | 'completed' | 'failed'
  latestRun: DashboardDerivedRecomputeRun | null
  currentSnapshot: DashboardDerivedSnapshot | null
}

export type DashboardDerivedRecomputeActionError = {
  message: string
  code?: string
  requestId?: string
  retryable: boolean
  offline: boolean
}
