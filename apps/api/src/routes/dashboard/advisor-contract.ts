export interface DashboardAdvisorUsageSummaryResponse {
  totalCalls: number
  totalInputTokens: number
  totalOutputTokens: number
  totalCostUsd: number
  totalCostEur: number
}

export interface DashboardAdvisorBudgetStateResponse {
  dailyUsdSpent: number
  monthlyUsdSpent: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerAllowed: boolean
  deepAnalysisAllowed: boolean
  blocked: boolean
  reasons: string[]
}

export interface DashboardAdvisorRunSummaryResponse {
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

export interface DashboardAdvisorSnapshotResponse {
  id: number
  runId: number
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

export interface DashboardAdvisorDailyBriefResponse {
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

export interface DashboardAdvisorRecommendationChallengeResponse {
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

export interface DashboardAdvisorRecommendationResponse {
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

export interface DashboardAdvisorAssumptionResponse {
  id: number
  runId: number
  assumptionKey: string
  source: string
  value: unknown
  justification: string
  createdAt: string
}

export interface DashboardAdvisorMacroSignalResponse {
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

export interface DashboardAdvisorNewsSignalResponse {
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

export interface DashboardAdvisorTransactionLabelSuggestionResponse {
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

export interface DashboardAdvisorSpendSeriesPointResponse {
  date: string
  usd: number
  eur: number
}

export interface DashboardAdvisorSpendBreakdownResponse {
  key: string
  label: string
  usd: number
  eur: number
}

export interface DashboardAdvisorSpendAnalyticsResponse {
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

export interface DashboardAdvisorChatMessageResponse {
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

export interface DashboardAdvisorChatThreadResponse {
  threadId: string
  title: string
  messages: DashboardAdvisorChatMessageResponse[]
}

export interface DashboardAdvisorEvalCaseResponse {
  id: number
  caseKey: string
  category: string
  description: string
  input: Record<string, unknown>
  expectation: Record<string, unknown>
  active: boolean
}

export interface DashboardAdvisorEvalRunResponse {
  id: number
  runId: number | null
  status: 'queued' | 'running' | 'completed' | 'failed' | 'degraded' | 'skipped'
  totalCases: number
  passedCases: number
  failedCases: number
  summary: Record<string, unknown>
  createdAt: string
}

export interface DashboardAdvisorOverviewResponse {
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
  spend: DashboardAdvisorSpendAnalyticsResponse['summary']
  signalCounts: {
    macro: number
    news: number
  }
  assumptionCount: number
  chatEnabled: boolean
}

export interface DashboardAdvisorRecommendationsResponse {
  items: DashboardAdvisorRecommendationResponse[]
}

export interface DashboardAdvisorRunsResponse {
  items: DashboardAdvisorRunSummaryResponse[]
}

export interface DashboardAdvisorAssumptionsResponse {
  items: DashboardAdvisorAssumptionResponse[]
}

export interface DashboardAdvisorSignalsResponse {
  macroSignals: DashboardAdvisorMacroSignalResponse[]
  newsSignals: DashboardAdvisorNewsSignalResponse[]
}

export interface DashboardAdvisorEvalsResponse {
  cases: DashboardAdvisorEvalCaseResponse[]
  latestRun: DashboardAdvisorEvalRunResponse | null
}

export interface DashboardAdvisorManualOperationStepResponse {
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

export interface DashboardAdvisorManualOperationResponse {
  operationId: string
  requestId: string
  status:
    | 'queued'
    | 'running'
    | 'completed'
    | 'failed'
    | 'degraded'
  currentStage:
    | 'personal_sync'
    | 'news_refresh'
    | 'market_refresh'
    | 'advisor_run'
    | null
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

export interface DashboardAdvisorRunDailyResponse {
  ok: boolean
  requestId: string
  run: DashboardAdvisorRunSummaryResponse
}

export interface DashboardAdvisorRelabelResponse {
  ok: boolean
  requestId: string
  run: DashboardAdvisorRunSummaryResponse
  suggestions: DashboardAdvisorTransactionLabelSuggestionResponse[]
}

export interface DashboardAdvisorChatPostResponse {
  ok: boolean
  requestId: string
  thread: DashboardAdvisorChatThreadResponse
}

export interface DashboardAdvisorManualRefreshAndRunPostResponse {
  ok: boolean
  requestId: string
  alreadyRunning: boolean
  operation: DashboardAdvisorManualOperationResponse
}
