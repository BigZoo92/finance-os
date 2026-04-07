import type { createDbClient } from '@finance-os/db'
import type { getApiEnv } from '@finance-os/env'
import type { createRedisClient } from '@finance-os/redis'

export type ApiDb = ReturnType<typeof createDbClient>['db']
export type ApiEnv = ReturnType<typeof getApiEnv>
export type RedisClient = ReturnType<typeof createRedisClient>['client']

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

export interface DashboardNewsArticleRow {
  id: number
  title: string
  summary: string | null
  url: string
  sourceName: string
  topic: string
  language: string
  publishedAt: Date
}

export interface DashboardNewsCacheStateRow {
  lastSuccessAt: Date | null
  lastAttemptAt: Date | null
  lastFailureAt: Date | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  ingestionCount: number
  dedupeDropCount: number
  providerFailureCount: number
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
}

export interface DashboardTransactionSyncMetadataRow {
  powensConnectionId: string
  connectionStatus: 'connected' | 'syncing' | 'error' | 'reconnect_required' | null
  lastSyncStatus: 'OK' | 'KO' | null
  lastSyncReasonCode: 'SUCCESS' | 'PARTIAL_IMPORT' | 'SYNC_FAILED' | 'RECONNECT_REQUIRED' | null
  lastSyncAt: Date | null
  lastSyncAttemptAt: Date | null
  lastFailedAt: Date | null
}

export interface DashboardTransactionClassificationUpdateInput {
  category: string | null
  subcategory: string | null
  incomeType: 'salary' | 'recurring' | 'exceptional' | null
  tags: string[]
  merchant?: string | null
}

export type DashboardGoalType =
  | 'emergency_fund'
  | 'travel'
  | 'home'
  | 'education'
  | 'retirement'
  | 'custom'

export interface DashboardGoalProgressSnapshotRow {
  recordedAt: string
  amount: number
  note: string | null
}

export interface DashboardGoalRow {
  id: number
  name: string
  goalType: DashboardGoalType
  currency: string
  targetAmount: string
  currentAmount: string
  targetDate: string | null
  note: string | null
  progressSnapshots: DashboardGoalProgressSnapshotRow[]
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface DashboardGoalWriteInput {
  name: string
  goalType: DashboardGoalType
  currency: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  note: string | null
}

export interface DashboardGoalPersistenceInput {
  name: string
  goalType: DashboardGoalType
  currency: string
  targetAmount: string
  currentAmount: string
  targetDate: string | null
  note: string | null
  progressSnapshots: DashboardGoalProgressSnapshotRow[]
  updatedAt: Date
}

export interface DashboardDerivedRecomputeRowCounts {
  rawTransactionCount: number
  transactionMatchedCount: number
  transactionUpdatedCount: number
  transactionUnchangedCount: number
  transactionSkippedCount: number
  rawImportTimestampUpdatedCount: number
  snapshotRowCount: number
}

export interface DashboardDerivedRecomputeRunRow {
  id: number
  snapshotVersion: string
  status: 'running' | 'completed' | 'failed'
  triggerSource: 'admin' | 'internal'
  requestId: string
  stage: string | null
  rowCounts: DashboardDerivedRecomputeRowCounts | null
  safeErrorCode: string | null
  safeErrorMessage: string | null
  isCurrentSnapshot: boolean
  startedAt: Date
  finishedAt: Date | null
  durationMs: number | null
}

export interface DashboardDerivedSnapshotResponse {
  snapshotVersion: string
  finishedAt: string
  rowCounts: DashboardDerivedRecomputeRowCounts | null
}

export interface DashboardDerivedRecomputeRunResponse {
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

export interface DashboardDerivedRecomputeStatusResponse {
  featureEnabled: boolean
  state: 'idle' | 'running' | 'completed' | 'failed'
  latestRun: DashboardDerivedRecomputeRunResponse | null
  currentSnapshot: DashboardDerivedSnapshotResponse | null
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
    metadata: Record<string, unknown> | null
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
  schemaVersion: '2026-04-04' | '2026-04-05'
  range: DashboardRange
  limit: number
  nextCursor: string | null
  demoFixture?: {
    mode: 'demo' | 'admin'
    datasetVersion: string | null
    fixtureSeed: string | null
    scenario: string | null
    degradedFallback: boolean
    degradedReason: string | null
  }
  freshness: {
    strategy: 'snapshot-first'
    lastSyncedAt: string | null
    syncStatus:
      | 'fresh'
      | 'stale-but-usable'
      | 'syncing'
      | 'sync-failed-with-safe-data'
      | 'no-data-first-connect'
    degradedReason: string | null
    snapshotAgeSeconds: number | null
    refreshRequested: boolean
  }
  items: Array<{
    id: number
    bookingDate: string
    amount: number
    currency: string
    direction: 'income' | 'expense'
    label: string
    merchant: string
    category: string | null
    subcategory: string | null
    resolvedCategory: string | null
    resolutionSource: 'manual_override' | 'merchant_rules' | 'mcc' | 'counterparty' | 'fallback'
    resolutionRuleId: string | null
    resolutionTrace: Array<{
      source: 'manual_override' | 'merchant_rules' | 'mcc' | 'counterparty' | 'fallback'
      rank: number
      matched: boolean
      reason: string
      category: string | null
      subcategory: string | null
      ruleId: string | null
    }>
    incomeType: 'salary' | 'recurring' | 'exceptional' | null
    tags: string[]
    powensConnectionId: string
    powensAccountId: string
    accountName: string | null
  }>
}


export interface DashboardAdvisorInsight {
  id: string
  title: string
  detail: string
  severity: 'info' | 'warning'
  citations: Array<{
    id: string
    label: string
    value: string
  }>
}

export interface DashboardAdvisorAction {
  id: string
  title: string
  detail: string
  estimatedMonthlyImpact: number
  effort: 'low' | 'medium' | 'high'
  tracking: {
    status: 'suggested' | 'in_progress' | 'done'
    metricLabel: string
    targetLabel: string
    currentLabel: string
  }
  citations: Array<{
    id: string
    label: string
    value: string
  }>
}

export interface DashboardAdvisorResponse {
  mode: 'demo' | 'admin'
  source: 'local' | 'provider'
  fallback: boolean
  fallbackReason: string | null
  requestId: string
  generatedAt: string
  degradedMessage?: string | null
  emptyMessage?: string | null
  dataStatus: {
    mode: 'sufficient' | 'insufficient'
    message: string | null
  }
  metrics: {
    latencyMs: number
    fallbackRate: number
    errorRate: number
    insightAcceptedRate: number
  }
  insights: DashboardAdvisorInsight[]
  actions: DashboardAdvisorAction[]
}

export interface DashboardNewsResponse {
  source: 'demo_fixture' | 'cache'
  dataset?: {
    version: string
    source: 'demo_fixture' | 'admin_live' | 'admin_fallback'
    mode: 'demo' | 'admin'
    isDemoData: boolean
  }
  resilience: {
    domain: 'alerts' | 'news' | 'insights'
    status: 'ok' | 'degraded' | 'unavailable'
    source: 'live' | 'cache' | 'demo'
    requestId: string
    reasonCode: string | null
    policy: {
      enabled: boolean
      sourceOrder: Array<'live' | 'cache' | 'demo'>
    }
    slo: {
      degradedRate: number
      hardFailRate: number
      staleAgeSeconds: number | null
    }
  }
  lastUpdatedAt: string | null
  staleCache: boolean
  providerError: {
    code: string
    message: string
  } | null
  metrics: {
    cacheHitRate: number
    dedupeDropRate: number
    providerFailureRate: number
  }
  items: Array<{
    id: string
    title: string
    summary: string | null
    url: string
    sourceName: string
    topic: string
    language: string
    publishedAt: string
  }>
}

export interface DashboardGoalResponse {
  id: number
  name: string
  goalType: DashboardGoalType
  currency: string
  targetAmount: number
  currentAmount: number
  targetDate: string | null
  note: string | null
  progressSnapshots: DashboardGoalProgressSnapshotRow[]
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface DashboardGoalsResponse {
  items: DashboardGoalResponse[]
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
  listTransactionSyncMetadata: (
    connectionIds: string[]
  ) => Promise<DashboardTransactionSyncMetadataRow[]>
  updateTransactionClassification: (
    transactionId: number,
    input: DashboardTransactionClassificationUpdateInput
  ) => Promise<DashboardTransactionRow | null>
  listGoals: () => Promise<DashboardGoalRow[]>
  getGoalById: (goalId: number) => Promise<DashboardGoalRow | null>
  createGoal: (input: DashboardGoalPersistenceInput) => Promise<DashboardGoalRow>
  updateGoal: (
    goalId: number,
    input: DashboardGoalPersistenceInput
  ) => Promise<DashboardGoalRow | null>
  archiveGoal: (goalId: number, archivedAt: Date) => Promise<DashboardGoalRow | null>
  listNewsArticles: (params: {
    topic?: string
    sourceName?: string
    limit: number
  }) => Promise<DashboardNewsArticleRow[]>
  upsertNewsArticles: (
    rows: Array<{
      providerArticleId: string
      dedupeKey: string
      title: string
      summary: string | null
      url: string
      sourceName: string
      topic: string
      language: string
      publishedAt: Date
      metadata: Record<string, unknown> | null
    }>
  ) => Promise<{ insertedCount: number; dedupeDropCount: number }>
  getNewsCacheState: () => Promise<DashboardNewsCacheStateRow | null>
  upsertNewsCacheState: (input: {
    lastSuccessAt?: Date | null
    lastAttemptAt?: Date | null
    lastFailureAt?: Date | null
    lastErrorCode?: string | null
    lastErrorMessage?: string | null
    lastRequestId?: string | null
    ingestionCountIncrement?: number
    dedupeDropCountIncrement?: number
    providerFailureCountIncrement?: number
    lastIngestDurationMs?: number
  }) => Promise<void>
}

export interface DashboardDerivedRecomputeRepository {
  getLatestRun: () => Promise<DashboardDerivedRecomputeRunRow | null>
  getCurrentSnapshotRun: () => Promise<DashboardDerivedRecomputeRunRow | null>
  createRun: (input: {
    snapshotVersion: string
    triggerSource: 'admin' | 'internal'
    requestId: string
    stage: string
    startedAt: Date
  }) => Promise<DashboardDerivedRecomputeRunRow>
  updateRunProgress: (input: {
    runId: number
    stage: string
    rowCounts?: DashboardDerivedRecomputeRowCounts
  }) => Promise<void>
  markRunFailed: (input: {
    runId: number
    stage: string
    rowCounts?: DashboardDerivedRecomputeRowCounts
    safeErrorCode: string
    safeErrorMessage: string
    finishedAt: Date
    durationMs: number
  }) => Promise<void>
  acquireRunLock: () => Promise<boolean>
  releaseRunLock: () => Promise<void>
  recomputeFromSourceOfTruth: (input: { runId: number; startedAt: Date }) => Promise<{
    rowCounts: DashboardDerivedRecomputeRowCounts
    finishedAt: Date
    durationMs: number
  }>
}

export interface DashboardUseCases {
  getSummary: (range: DashboardRange) => Promise<DashboardSummaryResponse>
  getTransactions: (input: {
    range: DashboardRange
    limit: number
    cursor: string | undefined
  }) => Promise<DashboardTransactionsResponse>
  requestTransactionsBackgroundRefresh: (input: { requestId: string }) => Promise<boolean>
  updateTransactionClassification: (
    transactionId: number,
    input: DashboardTransactionClassificationUpdateInput
  ) => Promise<DashboardTransactionsResponse['items'][number] | null>
  getGoals: () => Promise<DashboardGoalsResponse>
  createGoal: (input: DashboardGoalWriteInput) => Promise<DashboardGoalResponse>
  updateGoal: (
    goalId: number,
    input: DashboardGoalWriteInput
  ) => Promise<DashboardGoalResponse | null>
  archiveGoal: (goalId: number) => Promise<DashboardGoalResponse | null>
  getDerivedRecomputeStatus: () => Promise<DashboardDerivedRecomputeStatusResponse>
  runDerivedRecompute: (input: {
    requestId: string
    triggerSource: 'admin' | 'internal'
  }) => Promise<DashboardDerivedRecomputeStatusResponse>
  getNews?: (input: {
    topic?: string
    sourceName?: string
    limit: number
    requestId: string
  }) => Promise<DashboardNewsResponse>
  ingestNews?: (input: { requestId: string }) => Promise<{
    fetchedCount: number
    insertedCount: number
    dedupeDropCount: number
  }>
}

export interface DashboardNewsUseCases {
  getNews: (input: {
    topic?: string
    sourceName?: string
    limit: number
    requestId: string
  }) => Promise<DashboardNewsResponse>
  ingestNews: (input: { requestId: string }) => Promise<{
    fetchedCount: number
    insertedCount: number
    dedupeDropCount: number
  }>
}

export interface DashboardRouteRuntime {
  repositories: {
    readModel: DashboardReadRepository
    derivedRecompute: DashboardDerivedRecomputeRepository
  }
  useCases: DashboardUseCases
}
