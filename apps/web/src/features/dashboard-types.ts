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

export type DashboardAdvisorUsageSummaryResponse = {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalCostEur: number
}

export type DashboardAdvisorBudgetStateResponse = {
  dailyUsdSpent: number
  monthlyUsdSpent: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerAllowed: boolean
  deepAnalysisAllowed: boolean
  blocked: boolean
  reasons: string[]
}

export type DashboardAdvisorRunSummaryResponse = {
  id: number
  runType: 'daily' | 'chat' | 'relabel' | 'eval'
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
  triggerSource: string
  requestId: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  degraded: boolean
  fallbackReason: string | null
  errorCode: string | null
  errorMessage: string | null
  budgetState: DashboardAdvisorBudgetStateResponse | null
  usageSummary: DashboardAdvisorUsageSummaryResponse
}

export type DashboardAdvisorSnapshotResponse = {
  id: number
  runId: number
  asOfDate: string
  range: DashboardRange
  currency: string
  riskProfile: string
  metrics: Record<string, unknown>
  allocationBuckets: Array<Record<string, unknown>>
  assetClassAllocations: Array<Record<string, unknown>>
  driftSignals: Array<Record<string, unknown>>
  scenarios: Array<Record<string, unknown>>
  diagnostics: Record<string, unknown>
}

export type DashboardAdvisorDailyBriefResponse = {
  id: number
  runId: number
  title: string
  summary: string
  keyFacts: string[]
  opportunities: string[]
  risks: string[]
  watchItems: string[]
  recommendationNotes: Array<Record<string, unknown>>
  provider: string | null
  model: string | null
  createdAt: string
}

export type DashboardAdvisorRecommendationChallengeResponse = {
  id: number
  status: 'confirmed' | 'softened' | 'flagged' | 'skipped'
  summary: string
  contradictions: string[]
  missingSignals: string[]
  confidenceAdjustment: number
  provider: string | null
  model: string | null
  createdAt: string
}

export type DashboardAdvisorRecommendationResponse = {
  id: number
  runId: number
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
  expiresAt: string | null
  createdAt: string
  challenge: DashboardAdvisorRecommendationChallengeResponse | null
}

export type DashboardAdvisorAssumptionResponse = {
  id: number
  runId: number
  assumptionKey: string
  source: string
  value: unknown
  justification: string
  createdAt: string
}

export type DashboardAdvisorMacroSignalResponse = {
  id: number
  runId: number
  signalKey: string
  title: string
  direction: string
  severity: number
  confidence: number
  facts: string[]
  hypotheses: string[]
  implications: string[]
  sourceRefs: Array<Record<string, unknown>>
  createdAt: string
}

export type DashboardAdvisorNewsSignalResponse = {
  id: number
  runId: number
  signalKey: string
  title: string
  eventType: string
  direction: string
  severity: number
  confidence: number
  publishedAt: string | null
  supportingUrls: string[]
  affectedEntities: string[]
  affectedSectors: string[]
  whyItMatters: string[]
  createdAt: string
}

export type DashboardAdvisorTransactionLabelSuggestionResponse = {
  id: number
  runId: number
  transactionId: number | null
  suggestionKey: string
  status: string
  suggestionSource: string
  suggestedKind: string
  suggestedCategory: string
  suggestedSubcategory: string | null
  suggestedTags: string[]
  confidence: number
  rationale: string[]
  provider: string | null
  model: string | null
  createdAt: string
  reviewedAt: string | null
}

export type DashboardAdvisorSpendSeriesPointResponse = {
  date: string
  usd: number
  eur: number
}

export type DashboardAdvisorSpendBreakdownResponse = {
  key: string
  label: string
  usd: number
  eur: number
}

export type DashboardAdvisorSpendAnalyticsResponse = {
  summary: DashboardAdvisorBudgetStateResponse
  daily: DashboardAdvisorSpendSeriesPointResponse[]
  byFeature: DashboardAdvisorSpendBreakdownResponse[]
  byModel: DashboardAdvisorSpendBreakdownResponse[]
  anomalies: Array<{
    severity: 'warning' | 'critical'
    kind: 'daily_budget' | 'monthly_budget' | 'usage_spike'
    message: string
  }>
}

export type DashboardAdvisorChatMessageResponse = {
  id: number
  role: 'user' | 'assistant' | 'system'
  content: string
  citations: Array<Record<string, unknown>>
  assumptions: string[]
  caveats: string[]
  simulations: Array<Record<string, unknown>>
  provider: string | null
  model: string | null
  createdAt: string
}

export type DashboardAdvisorChatThreadResponse = {
  threadId: string
  title: string
  messages: DashboardAdvisorChatMessageResponse[]
}

export type DashboardAdvisorKnowledgeTopicResponse = {
  topicId: string
  title: string
  summary: string
  difficulty: 'beginner' | 'intermediate'
  estimatedReadMinutes: number
  tags: string[]
  relatedQuestions: string[]
}

export type DashboardAdvisorKnowledgeTopicsResponse = {
  mode: 'demo' | 'admin'
  requestId: string
  generatedAt: string
  retrievalEnabled: boolean
  browseOnlyReason: 'provider_disable_switch' | 'retrieval_kill_switch' | null
  topics: DashboardAdvisorKnowledgeTopicResponse[]
}

export type DashboardAdvisorKnowledgeCitationResponse = {
  citationId: string
  topicId: string
  topicTitle: string
  sectionTitle: string
  label: string
  excerpt: string
}

export type DashboardAdvisorKnowledgeStageTraceResponse = {
  stage: 'query_parse' | 'retrieval' | 'answer_assembly' | 'fallback'
  status: 'completed' | 'skipped'
  detail: string
}

export type DashboardAdvisorKnowledgeAnswerContentResponse = {
  headline: string
  summary: string
  keyPoints: string[]
  nextStep: string
  guardrail: string
}

export type DashboardAdvisorKnowledgeAnswerResponse = {
  mode: 'demo' | 'admin'
  source: 'demo_fixture' | 'retrieval' | 'browse_fallback'
  requestId: string
  generatedAt: string
  status: 'answered' | 'low_confidence' | 'guardrail_blocked' | 'browse_only'
  question: string
  answer: DashboardAdvisorKnowledgeAnswerContentResponse | null
  confidenceScore: number
  confidenceLabel: 'high' | 'medium' | 'low'
  lowConfidence: boolean
  fallbackReason:
    | 'provider_disable_switch'
    | 'retrieval_kill_switch'
    | 'guardrail_personalized_advice'
    | 'guardrail_regulatory_or_tax'
    | 'low_confidence'
    | 'retrieval_error'
    | null
  retrievalEnabled: boolean
  retrieval: {
    intent: 'definition' | 'comparison' | 'how_to' | 'risk' | 'planning' | 'unknown'
    matchedTopicIds: string[]
    hitCount: number
    guardrailTriggered: boolean
    stageLatenciesMs: {
      queryParse: number
      retrieval: number
      answerAssembly: number
      total: number
    }
    stages: DashboardAdvisorKnowledgeStageTraceResponse[]
  }
  citations: DashboardAdvisorKnowledgeCitationResponse[]
  suggestedTopics: DashboardAdvisorKnowledgeTopicResponse[]
}

export type DashboardAdvisorEvalCaseResponse = {
  id: number
  caseKey: string
  category: string
  description: string
  input: Record<string, unknown>
  expectation: Record<string, unknown>
  active: boolean
}

export type DashboardAdvisorEvalRunResponse = {
  id: number
  runId: number | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
  totalCases: number
  passedCases: number
  failedCases: number
  summary: Record<string, unknown>
  createdAt: string
}

export type DashboardAdvisorOverviewResponse = {
  mode: 'demo' | 'admin'
  source: 'demo_fixture' | 'persisted' | 'preview'
  requestId: string
  generatedAt: string
  status: 'ready' | 'needs_run' | 'degraded'
  degradedMessage: string | null
  latestRun: DashboardAdvisorRunSummaryResponse | null
  brief: DashboardAdvisorDailyBriefResponse | null
  topRecommendations: DashboardAdvisorRecommendationResponse[]
  snapshot: DashboardAdvisorSnapshotResponse | null
  spend: DashboardAdvisorBudgetStateResponse
  signalCounts: {
    macro: number
    news: number
  }
  assumptionCount: number
  chatEnabled: boolean
}

export type DashboardAdvisorRecommendationsResponse = {
  items: DashboardAdvisorRecommendationResponse[]
}

export type DashboardAdvisorRunsResponse = {
  items: DashboardAdvisorRunSummaryResponse[]
}

export type DashboardAdvisorAssumptionsResponse = {
  items: DashboardAdvisorAssumptionResponse[]
}

export type DashboardAdvisorSignalsResponse = {
  macroSignals: DashboardAdvisorMacroSignalResponse[]
  newsSignals: DashboardAdvisorNewsSignalResponse[]
}

export type DashboardAdvisorEvalsResponse = {
  cases: DashboardAdvisorEvalCaseResponse[]
  latestRun: DashboardAdvisorEvalRunResponse | null
}

export type DashboardAdvisorManualOperationStepResponse = {
  id: number
  stepKey: 'personal_sync' | 'news_refresh' | 'market_refresh' | 'advisor_run'
  label: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
  startedAt: string | null
  finishedAt: string | null
  durationMs: number | null
  errorCode: string | null
  errorMessage: string | null
  details: Record<string, unknown> | null
}

export type DashboardAdvisorManualOperationResponse = {
  operationId: string
  requestId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded'
  currentStage: 'personal_sync' | 'news_refresh' | 'market_refresh' | 'advisor_run' | null
  statusMessage: string | null
  triggerSource: string
  startedAt: string
  finishedAt: string | null
  durationMs: number | null
  degraded: boolean
  errorCode: string | null
  errorMessage: string | null
  advisorRunId: number | null
  advisorRun: DashboardAdvisorRunSummaryResponse | null
  steps: DashboardAdvisorManualOperationStepResponse[]
  outputDigest: Record<string, unknown> | null
}

export type DashboardAdvisorRunDailyResponse = {
  ok: boolean
  requestId: string
  run: DashboardAdvisorRunSummaryResponse
}

export type DashboardAdvisorRelabelResponse = {
  ok: boolean
  requestId: string
  run: DashboardAdvisorRunSummaryResponse
  suggestions: DashboardAdvisorTransactionLabelSuggestionResponse[]
}

export type DashboardAdvisorChatPostResponse = {
  ok: boolean
  requestId: string
  thread: DashboardAdvisorChatThreadResponse
}

export type DashboardAdvisorManualRefreshAndRunPostResponse = {
  ok: boolean
  requestId: string
  alreadyRunning: boolean
  operation: DashboardAdvisorManualOperationResponse
}

export type DashboardManualAssetResponse = {
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

export type DashboardManualAssetsResponse = {
  items: DashboardManualAssetResponse[]
}
