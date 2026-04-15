export type AiProviderId = 'openai' | 'anthropic' | 'local' | 'mock'

export type AiRunType = 'daily' | 'chat' | 'relabel' | 'eval'

export type AiStepStatus = 'completed' | 'failed' | 'skipped'

export interface JsonSchemaLike {
  type?: string
  properties?: Record<string, unknown>
  items?: unknown
  required?: readonly string[]
  additionalProperties?: boolean
  [key: string]: unknown
}

export interface ModelPricingEntry {
  provider: AiProviderId
  model: string
  pricingVersion: string
  effectiveDate: string
  sourceUrl: string
  inputUsdPerMillion: number
  cachedInputUsdPerMillion?: number
  cacheReadUsdPerMillion?: number
  cacheWriteUsdPerMillion5m?: number
  cacheWriteUsdPerMillion1h?: number
  outputUsdPerMillion: number
  batchInputUsdPerMillion?: number
  batchOutputUsdPerMillion?: number
  notes?: string
}

export interface EstimatedModelUsage {
  provider: AiProviderId
  model: string
  feature: string
  endpointType: string
  status: AiStepStatus
  inputTokens: number
  outputTokens: number
  cachedInputTokens: number
  cacheWriteTokens: number
  cacheDuration?: '5m' | '1h' | null
  batch: boolean
  latencyMs: number
  requestId: string | null
  responseId: string | null
  pricingVersion: string
  estimatedCostUsd: number
  estimatedCostEur: number
  usdToEurRate: number
  rawUsage: Record<string, unknown> | null
}

export interface StructuredCompletionRequest {
  feature: string
  model: string
  systemPrompt: string
  userPrompt: string
  schemaName: string
  schema: JsonSchemaLike
  maxOutputTokens?: number
  reasoningEffort?: 'low' | 'medium' | 'high'
  promptCache?: boolean
}

export interface StructuredCompletionResult<TOutput> {
  output: TOutput
  usage: EstimatedModelUsage
}

export interface AiBudgetState {
  dailyUsdSpent: number
  monthlyUsdSpent: number
  dailyBudgetUsd: number
  monthlyBudgetUsd: number
  challengerAllowed: boolean
  deepAnalysisAllowed: boolean
  blocked: boolean
  reasons: string[]
}

export interface DailyBriefLlmDraft {
  title: string
  summary: string
  keyFacts: string[]
  opportunities: string[]
  risks: string[]
  watchItems: string[]
  recommendationNotes: Array<{
    recommendationId: string
    whyNow: string
    narrative: string
    confidenceDelta: number
    impactSummary: string
    alternatives: string[]
  }>
}

export interface RecommendationChallengeDraft {
  recommendationId: string
  status: 'confirmed' | 'softened' | 'flagged' | 'skipped'
  summary: string
  contradictions: string[]
  missingSignals: string[]
  confidenceAdjustment: number
}

export interface TransactionLabelSuggestionDraft {
  transactionId: number
  suggestedKind:
    | 'income'
    | 'expense'
    | 'transfer'
    | 'investment'
    | 'reimbursement'
    | 'fees'
    | 'taxes'
    | 'cash_movement'
  suggestedCategory: string
  suggestedSubcategory: string | null
  suggestedTags: string[]
  confidence: number
  rationale: string[]
}

export interface ChatGroundedAnswer {
  answer: string
  citations: Array<{
    sourceType: 'recommendation' | 'brief' | 'snapshot' | 'signal' | 'assumption'
    sourceId: string
    label: string
  }>
  assumptions: string[]
  caveats: string[]
  simulations: Array<{
    label: string
    value: string
  }>
}

export interface AiPromptTemplateDefinition {
  key: string
  version: string
  description: string
  schemaName: string
  schema: JsonSchemaLike
  systemPrompt: string
  userPromptTemplate: string
}

export interface AiEvalCaseSeed {
  key: string
  category:
    | 'transaction_classification'
    | 'recommendation_quality'
    | 'challenger'
    | 'data_sufficiency'
    | 'cost_control'
  description: string
  input: Record<string, unknown>
  expectation: Record<string, unknown>
}
