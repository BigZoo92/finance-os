import type { createDbClient } from '@finance-os/db'
import type { getApiEnv } from '@finance-os/env'
import type { createRedisClient } from '@finance-os/redis'
import type {
  DashboardAdvisorAssumptionsResponse,
  DashboardAdvisorKnowledgeAnswerResponse,
  DashboardAdvisorKnowledgeTopicsResponse,
  DashboardAdvisorChatPostResponse,
  DashboardAdvisorChatThreadResponse,
  DashboardAdvisorDailyBriefResponse,
  DashboardAdvisorEvalRunResponse,
  DashboardAdvisorEvalsResponse,
  DashboardAdvisorManualOperationResponse,
  DashboardAdvisorManualRefreshAndRunPostResponse,
  DashboardAdvisorOverviewResponse,
  DashboardAdvisorRecommendationsResponse,
  DashboardAdvisorRelabelResponse,
  DashboardAdvisorRunDailyResponse,
  DashboardAdvisorRunsResponse,
  DashboardAdvisorSignalsResponse,
  DashboardAdvisorSpendAnalyticsResponse,
  DashboardAdvisorTransactionLabelSuggestionResponse,
} from './advisor-contract'
import type { NewsDuplicateCandidate } from './domain/news-dedupe'
import type {
  DashboardNewsFilters,
  DashboardNewsSignalCard,
  NewsContextBundle,
  NewsPersistableSignalDraft,
  NewsProviderHealth,
  NewsProviderRunResult,
} from './domain/news-types'
import type {
  DashboardMarketsContextBundleResponse,
  DashboardMarketsMacroResponse,
  DashboardMarketsOverviewResponse,
  DashboardMarketsWatchlistResponse,
  MarketContextBundle,
  MarketMacroObservationPersistInput,
  MarketProviderRunResult,
  MarketQuotePersistInput,
} from './domain/markets-types'

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

export interface PowensConnectionRow {
  powensConnectionId: string
  source: string
  provider: string
  providerConnectionId: string
  providerInstitutionId: string | null
  providerInstitutionName: string | null
  status: 'connected' | 'syncing' | 'error' | 'reconnect_required'
  lastSyncStatus: 'OK' | 'KO' | null
  lastSyncReasonCode: 'SUCCESS' | 'PARTIAL_IMPORT' | 'SYNC_FAILED' | 'RECONNECT_REQUIRED' | null
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

export interface ManualAssetRow extends AssetRow {
  createdAt: Date
  updatedAt: Date
}

export interface DashboardManualAssetWriteInput {
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: number
  valuationAsOf: string | null
  note: string | null
  category: string | null
  enabled: boolean
}

export interface DashboardManualAssetPersistenceInput {
  assetType: 'cash' | 'investment' | 'manual'
  name: string
  currency: string
  valuation: string
  valuationAsOf: Date | null
  note: string | null
  category: string | null
  enabled: boolean
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

export interface DashboardNewsCacheStateRow {
  lastSuccessAt: Date | null
  lastAttemptAt: Date | null
  lastFailureAt: Date | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  ingestionCount: number
  dedupeDropCount: number
  providerFailureCount: number
  lastFetchedCount: number | null
  lastInsertedCount: number | null
  lastMergedCount: number | null
  lastProviderCount: number | null
  lastSignalCount: number | null
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
    personaProfile: string | null
    personaId: 'student' | 'freelancer' | 'family' | 'retiree' | null
    personaVariation: 0 | 1 | 2 | null
    overrideReason: 'manual_scenario_override' | 'persona_match' | 'kill_switch_disabled' | null
    fallbackCause: string | null
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

export interface DashboardManualAssetResponse {
  assetId: number
  type: 'cash' | 'investment' | 'manual'
  origin: 'provider' | 'manual'
  source: string
  name: string
  currency: string
  valuation: number
  valuationAsOf: string | null
  enabled: boolean
  note: string | null
  category: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
  updatedAt: string
}

export interface DashboardManualAssetsResponse {
  items: DashboardManualAssetResponse[]
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
  decisionWorkflow: {
    goal: string
    checkpoints: Array<{
      id: string
      label: string
      rationale: string
    }>
    nextReviewLabel: string
  }
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
    lastFetchedCount: number | null
    lastInsertedCount: number | null
    lastMergedCount: number | null
  }
  filters: {
    applied: Omit<DashboardNewsFilters, 'limit'>
  }
  providers: NewsProviderHealth[]
  clusters: NewsContextBundle['clusteredEvents']
  contextPreview: Pick<
    NewsContextBundle,
    | 'topSignals'
    | 'mostImpactedSectors'
    | 'mostImpactedEntities'
    | 'contradictorySignals'
    | 'causalHypotheses'
  >
  items: DashboardNewsSignalCard[]
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
  listPowensConnections: () => Promise<PowensConnectionRow[]>
  listAssets: () => Promise<AssetRow[]>
  listManualAssets: () => Promise<ManualAssetRow[]>
  createManualAsset: (
    input: DashboardManualAssetPersistenceInput
  ) => Promise<ManualAssetRow>
  updateManualAsset: (
    assetId: number,
    input: DashboardManualAssetPersistenceInput
  ) => Promise<ManualAssetRow | null>
  deleteManualAsset: (assetId: number) => Promise<boolean>
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
}

export interface DashboardNewsRepository {
  listNewsArticles: (filters: DashboardNewsFilters) => Promise<DashboardNewsSignalCard[]>
  countNewsArticles: () => Promise<number>
  findNewsArticleCandidates: (params: {
    canonicalUrlFingerprint: string | null
    normalizedTitle: string
    publishedAfter: Date
    publishedBefore: Date
  }) => Promise<NewsDuplicateCandidate[]>
  insertNewsSignal: (signal: NewsPersistableSignalDraft) => Promise<number>
  mergeNewsSignal: (params: {
    articleId: number
    signal: NewsPersistableSignalDraft
    dedupeEvidence: Record<string, unknown> | null
  }) => Promise<void>
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
    lastFetchedCount?: number | null
    lastInsertedCount?: number | null
    lastMergedCount?: number | null
    lastProviderCount?: number | null
    lastSignalCount?: number | null
  }) => Promise<void>
  upsertNewsProviderState: (input: NewsProviderRunResult & { enabled: boolean }) => Promise<void>
  listNewsProviderHealth: () => Promise<NewsProviderHealth[]>
}

export interface DashboardMarketsRepository {
  listQuoteSnapshots: () => Promise<
    Array<{
      instrumentId: string
      label: string
      symbol: string
      providerSymbol: string
      assetClass: string
      region: string
      exchange: string
      currency: string
      sourceProvider: 'eodhd' | 'fred' | 'twelve_data'
      baselineProvider: 'eodhd' | 'fred' | 'twelve_data'
      overlayProvider: 'eodhd' | 'fred' | 'twelve_data' | null
      sourceMode: 'eod' | 'delayed' | 'intraday'
      sourceDelayLabel: string
      sourceReason: string
      quoteDate: string
      quoteAsOf: Date | null
      capturedAt: Date
      marketState: 'open' | 'closed'
      marketOpen: boolean | null
      isDelayed: boolean
      freshnessMinutes: number | null
      price: number
      previousClose: number | null
      dayChangePct: number | null
      weekChangePct: number | null
      monthChangePct: number | null
      ytdChangePct: number | null
      history: Array<{ date: string; value: number; provider: string }>
    }>
  >
  syncQuoteSnapshots: (quotes: MarketQuotePersistInput[]) => Promise<void>
  listMacroObservations: () => Promise<
    Array<{
      seriesId: string
      observationDate: string
      value: number
    }>
  >
  upsertMacroObservations: (observations: MarketMacroObservationPersistInput[]) => Promise<void>
  getMarketCacheState: () => Promise<{
    lastSuccessAt: Date | null
    lastAttemptAt: Date | null
    lastFailureAt: Date | null
    lastErrorCode: string | null
    lastErrorMessage: string | null
    refreshCount: number
    providerFailureCount: number
    lastInstrumentCount: number | null
    lastMacroObservationCount: number | null
    lastSignalCount: number | null
    lastRefreshDurationMs: number | null
  } | null>
  upsertMarketCacheState: (input: {
    lastSuccessAt?: Date | null
    lastAttemptAt?: Date | null
    lastFailureAt?: Date | null
    lastErrorCode?: string | null
    lastErrorMessage?: string | null
    lastRequestId?: string | null
    refreshCountIncrement?: number
    providerFailureCountIncrement?: number
    lastInstrumentCount?: number | null
    lastMacroObservationCount?: number | null
    lastSignalCount?: number | null
    lastRefreshDurationMs?: number | null
  }) => Promise<void>
  upsertMarketProviderState: (input: MarketProviderRunResult & { enabled: boolean }) => Promise<void>
  listMarketProviderHealth: () => Promise<
    Array<{
      provider: 'eodhd' | 'fred' | 'twelve_data'
      label: string
      role: 'prices' | 'macro' | 'overlay'
      enabled: boolean
      status: 'healthy' | 'degraded' | 'failing' | 'idle'
      lastSuccessAt: string | null
      lastAttemptAt: string | null
      lastFailureAt: string | null
      lastErrorCode: string | null
      lastErrorMessage: string | null
      lastFetchedCount: number
      successCount: number
      failureCount: number
      skippedCount: number
      freshnessLabel: string
    }>
  >
  saveContextBundle: (input: {
    generatedAt: Date
    schemaVersion: string
    bundle: MarketContextBundle
  }) => Promise<void>
  getContextBundle: () => Promise<{
    generatedAt: string
    schemaVersion: string
    bundle: MarketContextBundle
  } | null>
}

export interface DashboardAdvisorRepository {
  createRun: (input: {
    runType: 'daily' | 'chat' | 'relabel' | 'eval'
    status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
    mode: 'demo' | 'admin'
    triggerSource: string
    requestId: string
    degraded: boolean
    fallbackReason?: string | null
    inputDigest?: Record<string, unknown> | null
    budgetState?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }) => Promise<number>
  updateRun: (input: {
    runId: number
    status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
    degraded: boolean
    finishedAt?: Date | null
    durationMs?: number | null
    fallbackReason?: string | null
    errorCode?: string | null
    errorMessage?: string | null
    outputDigest?: Record<string, unknown> | null
    budgetState?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
  upsertPromptTemplate: (input: {
    templateKey: string
    version: string
    description: string
    schemaName: string
    systemPrompt: string
    userPromptTemplate: string
    schema: Record<string, unknown>
  }) => Promise<void>
  upsertEvalCases: (
    cases: Array<{
      caseKey: string
      category: string
      description: string
      input: Record<string, unknown>
      expectation: Record<string, unknown>
    }>
  ) => Promise<void>
  createRunStep: (input: {
    runId: number
    stepKey: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
    provider?: string | null
    model?: string | null
    promptTemplateKey?: string | null
    promptTemplateVersion?: string | null
    startedAt?: Date | null
    metadata?: Record<string, unknown> | null
  }) => Promise<number>
  updateRunStep: (input: {
    stepId: number
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
    finishedAt?: Date | null
    latencyMs?: number | null
    errorCode?: string | null
    errorMessage?: string | null
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
  insertModelUsage: (input: {
    runId?: number | null
    runStepId?: number | null
    provider: string
    model: string
    endpointType: string
    feature: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'skipped'
    inputTokens: number
    outputTokens: number
    cachedInputTokens: number
    cacheWriteTokens: number
    cacheDuration?: string | null
    batch: boolean
    latencyMs: number
    requestId?: string | null
    responseId?: string | null
    pricingVersion: string
    estimatedCostUsd: number
    estimatedCostEur: number
    usdToEurRate: number
    rawUsage?: Record<string, unknown> | null
    createdAt?: Date
  }) => Promise<void>
  saveDailyArtifacts: (input: {
    runId: number
    snapshot: {
      asOfDate: string
      range: '7d' | '30d' | '90d'
      currency: string
      riskProfile: string
      metrics: Record<string, unknown>
      allocationBuckets: Array<Record<string, unknown>>
      assetClassAllocations: Array<Record<string, unknown>>
      driftSignals: Array<Record<string, unknown>>
      scenarios: Array<Record<string, unknown>>
      diagnostics: Record<string, unknown>
    }
    assumptions: Array<{
      assumptionKey: string
      source: string
      value: unknown
      justification: string
    }>
    brief: {
      title: string
      summary: string
      keyFacts: string[]
      opportunities: string[]
      risks: string[]
      watchItems: string[]
      recommendationNotes: Array<Record<string, unknown>>
      provider?: string | null
      model?: string | null
      promptTemplateKey?: string | null
      promptTemplateVersion?: string | null
    } | null
    recommendations: Array<{
      recommendationKey: string
      type: string
      category: string
      title: string
      description: string
      whyNow: string
      evidence: string[]
      assumptions: string[]
      confidence: number
      riskLevel: 'low' | 'medium' | 'high'
      expectedImpact: Record<string, unknown>
      effort: 'low' | 'medium' | 'high'
      reversibility: 'high' | 'medium' | 'low'
      blockingFactors: string[]
      alternatives: string[]
      deterministicMetricsUsed: string[]
      llmModelsUsed: string[]
      challengerStatus: 'confirmed' | 'softened' | 'flagged' | 'skipped'
      priorityScore: number
      expiresAt?: Date | null
      challenge?: {
        status: 'confirmed' | 'softened' | 'flagged' | 'skipped'
        summary: string
        contradictions: string[]
        missingSignals: string[]
        confidenceAdjustment: number
        provider?: string | null
        model?: string | null
      } | null
    }>
    macroSignals: Array<{
      signalKey: string
      title: string
      direction: string
      severity: number
      confidence: number
      facts: string[]
      hypotheses: string[]
      implications: string[]
      sourceRefs: Array<Record<string, unknown>>
    }>
    newsSignals: Array<{
      newsArticleId?: number | null
      signalKey: string
      title: string
      eventType: string
      direction: string
      severity: number
      confidence: number
      publishedAt?: Date | null
      supportingUrls: string[]
      affectedEntities: string[]
      affectedSectors: string[]
      whyItMatters: string[]
    }>
    transactionSuggestions: Array<{
      transactionId?: number | null
      suggestionKey: string
      status: string
      suggestionSource: string
      suggestedKind: string
      suggestedCategory: string
      suggestedSubcategory?: string | null
      suggestedTags: string[]
      confidence: number
      rationale: string[]
      provider?: string | null
      model?: string | null
    }>
    evalRun?: {
      status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
      totalCases: number
      passedCases: number
      failedCases: number
      summary: Record<string, unknown>
    } | null
  }) => Promise<void>
  getAdvisorOverview: (input: {
    dailyBudgetUsd: number
    monthlyBudgetUsd: number
    challengerDisableRatio: number
    deepAnalysisDisableRatio: number
    chatEnabled: boolean
  }) => Promise<DashboardAdvisorOverviewResponse | null>
  getLatestDailyBrief: () => Promise<DashboardAdvisorDailyBriefResponse | null>
  listRecommendations: (limit: number) => Promise<DashboardAdvisorRecommendationsResponse>
  listRuns: (limit: number) => Promise<DashboardAdvisorRunsResponse>
  listAssumptions: (limit: number) => Promise<DashboardAdvisorAssumptionsResponse>
  listSignals: (limit: number) => Promise<DashboardAdvisorSignalsResponse>
  getSpendAnalytics: (input: {
    dailyBudgetUsd: number
    monthlyBudgetUsd: number
    challengerDisableRatio: number
    deepAnalysisDisableRatio: number
  }) => Promise<DashboardAdvisorSpendAnalyticsResponse>
  listTransactionSuggestions: (
    runId: number,
    limit: number
  ) => Promise<DashboardAdvisorTransactionLabelSuggestionResponse[]>
  getOrCreateChatThread: (input: { threadKey: string; mode: 'demo' | 'admin' }) => Promise<string>
  listChatMessages: (
    threadKey: string,
    limit: number
  ) => Promise<DashboardAdvisorChatThreadResponse | null>
  appendChatMessages: (input: {
    threadKey: string
    title: string
    mode: 'demo' | 'admin'
    runId?: number | null
    userMessage: {
      content: string
    }
    assistantMessage: {
      content: string
      citations: Array<Record<string, unknown>>
      assumptions: string[]
      caveats: string[]
      simulations: Array<Record<string, unknown>>
      provider?: string | null
      model?: string | null
    }
  }) => Promise<DashboardAdvisorChatPostResponse>
  getEvals: () => Promise<DashboardAdvisorEvalsResponse>
  getLatestEvalRun: () => Promise<DashboardAdvisorEvalRunResponse | null>
  createManualOperation: (input: {
    operationId: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded'
    mode: 'admin'
    triggerSource: string
    requestId: string
    currentStage?: 'personal_sync' | 'news_refresh' | 'market_refresh' | 'advisor_run' | null
    statusMessage?: string | null
    degraded: boolean
    advisorRunId?: number | null
    inputDigest?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
  updateManualOperation: (input: {
    operationId: string
    status?: 'queued' | 'running' | 'completed' | 'failed' | 'degraded'
    currentStage?: 'personal_sync' | 'news_refresh' | 'market_refresh' | 'advisor_run' | null
    statusMessage?: string | null
    degraded?: boolean
    errorCode?: string | null
    errorMessage?: string | null
    advisorRunId?: number | null
    finishedAt?: Date | null
    durationMs?: number | null
    outputDigest?: Record<string, unknown> | null
    metadata?: Record<string, unknown> | null
  }) => Promise<void>
  upsertManualOperationStep: (input: {
    operationId: string
    stepKey: 'personal_sync' | 'news_refresh' | 'market_refresh' | 'advisor_run'
    label: string
    status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
    startedAt?: Date | null
    finishedAt?: Date | null
    durationMs?: number | null
    errorCode?: string | null
    errorMessage?: string | null
    details?: Record<string, unknown> | null
  }) => Promise<void>
  getManualOperation: (operationId: string) => Promise<DashboardAdvisorManualOperationResponse | null>
  getLatestManualOperation: () => Promise<DashboardAdvisorManualOperationResponse | null>
  getLatestActiveManualOperation: () => Promise<DashboardAdvisorManualOperationResponse | null>
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
  getManualAssets?: (input: { mode: 'demo' | 'admin' }) => Promise<DashboardManualAssetsResponse>
  createManualAsset?: (
    input: { mode: 'demo' | 'admin' } & DashboardManualAssetWriteInput
  ) => Promise<DashboardManualAssetResponse>
  updateManualAsset?: (
    assetId: number,
    input: { mode: 'demo' | 'admin' } & DashboardManualAssetWriteInput
  ) => Promise<DashboardManualAssetResponse | null>
  deleteManualAsset?: (
    assetId: number,
    input: { mode: 'demo' | 'admin' }
  ) => Promise<{ ok: boolean; assetId: number }>
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
  getNews?: (input: DashboardNewsFilters & { requestId: string }) => Promise<DashboardNewsResponse>
  getNewsContextBundle?: (input: {
    requestId: string
    range: '24h' | '7d' | '30d'
  }) => Promise<NewsContextBundle>
  ingestNews?: (input: { requestId: string }) => Promise<{
    fetchedCount: number
    insertedCount: number
    mergedCount: number
    dedupeDropCount: number
  }>
  getMarketsOverview?: (input: { requestId: string }) => Promise<DashboardMarketsOverviewResponse>
  getMarketsWatchlist?: (input: { requestId: string }) => Promise<DashboardMarketsWatchlistResponse>
  getMarketsMacro?: (input: { requestId: string }) => Promise<DashboardMarketsMacroResponse>
  getMarketsContextBundle?: (input: {
    requestId: string
  }) => Promise<DashboardMarketsContextBundleResponse>
  refreshMarkets?: (input: { requestId: string }) => Promise<{
    requestId: string
    refreshedAt: string
    quoteCount: number
    macroObservationCount: number
    signalCount: number
    providerResults: MarketProviderRunResult[]
  }>
  getAdvisorOverview?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorOverviewResponse>
  getAdvisorDailyBrief?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorDailyBriefResponse | null>
  getAdvisorRecommendations?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
  }) => Promise<DashboardAdvisorRecommendationsResponse>
  getAdvisorRuns?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
  }) => Promise<DashboardAdvisorRunsResponse>
  getAdvisorAssumptions?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
  }) => Promise<DashboardAdvisorAssumptionsResponse>
  getAdvisorSignals?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    limit?: number
  }) => Promise<DashboardAdvisorSignalsResponse>
  getAdvisorSpend?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorSpendAnalyticsResponse>
  getAdvisorKnowledgeTopics?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorKnowledgeTopicsResponse>
  getAdvisorKnowledgeAnswer?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    question: string
  }) => Promise<DashboardAdvisorKnowledgeAnswerResponse>
  runAdvisorDaily?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    triggerSource: string
  }) => Promise<DashboardAdvisorRunDailyResponse>
  getLatestAdvisorManualOperation?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorManualOperationResponse | null>
  getAdvisorManualOperationById?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    operationId: string
  }) => Promise<DashboardAdvisorManualOperationResponse | null>
  runAdvisorManualRefreshAndAnalysis?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    triggerSource: string
  }) => Promise<DashboardAdvisorManualRefreshAndRunPostResponse>
  relabelAdvisorTransactions?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    triggerSource: string
  }) => Promise<DashboardAdvisorRelabelResponse>
  getAdvisorChat?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    threadKey?: string
  }) => Promise<DashboardAdvisorChatThreadResponse>
  postAdvisorChat?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
    threadKey?: string
    message: string
  }) => Promise<DashboardAdvisorChatPostResponse>
  getAdvisorEvals?: (input: {
    mode: 'demo' | 'admin'
    requestId: string
  }) => Promise<DashboardAdvisorEvalsResponse>
}

export interface DashboardNewsUseCases {
  getNews: (input: DashboardNewsFilters & { requestId: string }) => Promise<DashboardNewsResponse>
  getNewsContextBundle: (input: {
    requestId: string
    range: '24h' | '7d' | '30d'
  }) => Promise<NewsContextBundle>
  ingestNews: (input: { requestId: string }) => Promise<{
    fetchedCount: number
    insertedCount: number
    mergedCount: number
    dedupeDropCount: number
  }>
}

export interface DashboardMarketsUseCases {
  getOverview: (input: { requestId: string }) => Promise<DashboardMarketsOverviewResponse>
  getWatchlist: (input: { requestId: string }) => Promise<DashboardMarketsWatchlistResponse>
  getMacro: (input: { requestId: string }) => Promise<DashboardMarketsMacroResponse>
  getContextBundle: (input: {
    requestId: string
  }) => Promise<DashboardMarketsContextBundleResponse>
  refreshMarkets: (input: { requestId: string }) => Promise<{
    requestId: string
    refreshedAt: string
    quoteCount: number
    macroObservationCount: number
    signalCount: number
    providerResults: MarketProviderRunResult[]
  }>
}

export interface DashboardRouteRuntime {
  repositories: {
    readModel: DashboardReadRepository
    news?: DashboardNewsRepository
    markets?: DashboardMarketsRepository
    advisor?: DashboardAdvisorRepository
    derivedRecompute: DashboardDerivedRecomputeRepository
  }
  useCases: DashboardUseCases
}
