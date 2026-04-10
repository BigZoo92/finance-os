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


export type DashboardAdvisorResponse = {
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
  insights: Array<{
    id: string
    title: string
    detail: string
    severity: 'info' | 'warning'
    citations: Array<{
      id: string
      label: string
      value: string
    }>
  }>
  actions: Array<{
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

export type DashboardNewsSignalCard = {
  id: string
  title: string
  summary: string | null
  contentSnippet: string | null
  url: string
  canonicalUrl: string | null
  sourceName: string
  sourceDomain: string | null
  sourceType: 'media' | 'regulator' | 'central_bank' | 'filing' | 'macro_data' | 'company' | 'gov' | 'industry' | 'blog' | 'tech_forum'
  topic: string
  language: string
  publishedAt: string
  domains: string[]
  categories: string[]
  subcategories: string[]
  eventType: string
  severity: number
  severityLabel: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  novelty: number
  marketImpactScore: number
  relevanceScore: number
  direction: 'risk' | 'opportunity' | 'mixed'
  riskFlags: string[]
  opportunityFlags: string[]
  affectedEntities: Array<{
    name: string
    type: string
    role: 'primary' | 'affected' | 'reference'
    confidence: number
  }>
  affectedTickers: string[]
  affectedSectors: string[]
  affectedThemes: string[]
  transmissionHypotheses: Array<{
    id: string
    label: string
    direction: 'risk' | 'opportunity' | 'mixed'
    confidence: number
  }>
  whyItMatters: string[]
  scoringReasons: string[]
  metadataCard: {
    title: string
    description: string | null
    canonicalUrl: string | null
    imageUrl: string | null
    imageCandidates: string[]
    imageAlt: string | null
    siteName: string | null
    displayUrl: string
    faviconUrl: string | null
    faviconCandidates: string[]
    publishedAt: string | null
    author: string | null
    articleType: string | null
  } | null
  metadataFetchStatus: 'not_requested' | 'pending' | 'fetched' | 'failed' | 'skipped'
  eventClusterId: string
  provenance: {
    sourceCount: number
    providerCount: number
    providers: string[]
    sourceDomains: string[]
  }
  sources: Array<{
    provider: string
    providerArticleId: string
    sourceName: string
    sourceDomain: string | null
    sourceType: string
    publishedAt: string
    providerUrl: string | null
  }>
}

export type DashboardNewsProviderHealth = {
  provider: string
  label: string
  enabled: boolean
  status: 'healthy' | 'degraded' | 'failing' | 'idle'
  lastSuccessAt: string | null
  lastAttemptAt: string | null
  lastFailureAt: string | null
  lastErrorCode: string | null
  lastErrorMessage: string | null
  successCount: number
  failureCount: number
  skippedCount: number
  lastFetchedCount: number
  lastInsertedCount: number
  lastMergedCount: number
  cooldownUntil: string | null
}

export type DashboardNewsContextPreview = {
  topSignals: Array<{
    id: string
    title: string
    publishedAt: string
    eventType: string
    direction: 'risk' | 'opportunity' | 'mixed'
    severity: number
    confidence: number
    novelty: number
    marketImpactScore: number
    relevanceScore: number
    sourceCount: number
    providerCount: number
    affectedEntities: string[]
    affectedSectors: string[]
    affectedTickers: string[]
    whyItMatters: string[]
    supportingUrls: string[]
  }>
  mostImpactedSectors: Array<{ sector: string; score: number }>
  mostImpactedEntities: Array<{ entity: string; score: number }>
  contradictorySignals: Array<{
    topic: string
    bullishCount: number
    bearishCount: number
    signalIds: string[]
  }>
  causalHypotheses: string[]
}

export type DashboardNewsResponse = {
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
    applied: Record<string, string | number>
  }
  providers: DashboardNewsProviderHealth[]
  clusters: Array<{
    clusterId: string
    title: string
    eventType: string
    direction: 'risk' | 'opportunity' | 'mixed'
    signalCount: number
    sourceCount: number
    latestPublishedAt: string
    topDomains: string[]
    topSectors: string[]
    headlineIds: string[]
  }>
  contextPreview: DashboardNewsContextPreview
  items: DashboardNewsSignalCard[]
}
