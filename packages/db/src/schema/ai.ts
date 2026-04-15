import { sql } from 'drizzle-orm'
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import { newsArticle } from './news'
import { transaction } from './powens'

export const aiRunTypeEnum = pgEnum('ai_run_type', ['daily', 'chat', 'relabel', 'eval'])

export const aiRunStatusEnum = pgEnum('ai_run_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'degraded',
  'skipped',
])

export const aiManualOperationStatusEnum = pgEnum('ai_manual_operation_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'degraded',
])

export const aiStepStatusEnum = pgEnum('ai_step_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'skipped',
])

export const aiManualOperationStepStatusEnum = pgEnum('ai_manual_operation_step_status', [
  'queued',
  'running',
  'completed',
  'failed',
  'degraded',
  'skipped',
])

export const aiRecommendationRiskLevelEnum = pgEnum('ai_recommendation_risk_level', [
  'low',
  'medium',
  'high',
])

export const aiRecommendationEffortEnum = pgEnum('ai_recommendation_effort', [
  'low',
  'medium',
  'high',
])

export const aiRecommendationReversibilityEnum = pgEnum('ai_recommendation_reversibility', [
  'high',
  'medium',
  'low',
])

export const aiRecommendationChallengeStatusEnum = pgEnum(
  'ai_recommendation_challenge_status',
  ['confirmed', 'softened', 'flagged', 'skipped']
)

export const aiChatMessageRoleEnum = pgEnum('ai_chat_message_role', ['user', 'assistant', 'system'])

export const aiRun = pgTable(
  'ai_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runType: aiRunTypeEnum('run_type').notNull(),
    status: aiRunStatusEnum('status').notNull().default('queued'),
    mode: text('mode').notNull().default('admin'),
    triggerSource: text('trigger_source').notNull().default('manual'),
    requestId: text('request_id').notNull(),
    requestCorrelationId: text('request_correlation_id'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    degraded: boolean('degraded').notNull().default(false),
    fallbackReason: text('fallback_reason'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    inputDigest: jsonb('input_digest').$type<Record<string, unknown> | null>(),
    outputDigest: jsonb('output_digest').$type<Record<string, unknown> | null>(),
    budgetState: jsonb('budget_state').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_run_request_id_unique').on(table.requestId),
    index('ai_run_type_started_at_idx').on(table.runType, table.startedAt),
    index('ai_run_status_started_at_idx').on(table.status, table.startedAt),
    index('ai_run_trigger_source_idx').on(table.triggerSource),
  ]
)

export const aiManualOperation = pgTable(
  'ai_manual_operation',
  {
    id: text('id').primaryKey(),
    status: aiManualOperationStatusEnum('status').notNull().default('queued'),
    mode: text('mode').notNull().default('admin'),
    triggerSource: text('trigger_source').notNull().default('manual'),
    requestId: text('request_id').notNull(),
    currentStage: text('current_stage'),
    statusMessage: text('status_message'),
    degraded: boolean('degraded').notNull().default(false),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    advisorRunId: integer('advisor_run_id').references(() => aiRun.id, {
      onDelete: 'set null',
    }),
    inputDigest: jsonb('input_digest').$type<Record<string, unknown> | null>(),
    outputDigest: jsonb('output_digest').$type<Record<string, unknown> | null>(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_manual_operation_request_id_unique').on(table.requestId),
    index('ai_manual_operation_status_started_at_idx').on(table.status, table.startedAt),
    index('ai_manual_operation_trigger_source_idx').on(table.triggerSource),
    index('ai_manual_operation_advisor_run_id_idx').on(table.advisorRunId),
  ]
)

export const aiManualOperationStep = pgTable(
  'ai_manual_operation_step',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    operationId: text('operation_id')
      .notNull()
      .references(() => aiManualOperation.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    label: text('label').notNull(),
    status: aiManualOperationStepStatusEnum('status').notNull().default('queued'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    details: jsonb('details').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_manual_operation_step_operation_key_unique').on(table.operationId, table.stepKey),
    index('ai_manual_operation_step_status_idx').on(table.status),
    index('ai_manual_operation_step_operation_id_idx').on(table.operationId),
  ]
)

export const aiPromptTemplate = pgTable(
  'ai_prompt_template',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    templateKey: text('template_key').notNull(),
    version: text('version').notNull(),
    description: text('description'),
    schemaName: text('schema_name').notNull(),
    systemPrompt: text('system_prompt').notNull(),
    userPromptTemplate: text('user_prompt_template').notNull(),
    schema: jsonb('schema').$type<Record<string, unknown>>().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_prompt_template_key_version_unique').on(table.templateKey, table.version),
    index('ai_prompt_template_active_idx').on(table.active),
  ]
)

export const aiPortfolioSnapshot = pgTable(
  'ai_portfolio_snapshot',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    asOfDate: date('as_of_date').notNull(),
    range: text('range').notNull(),
    currency: text('currency').notNull().default('EUR'),
    riskProfile: text('risk_profile').notNull(),
    metrics: jsonb('metrics').$type<Record<string, unknown>>().notNull(),
    allocationBuckets: jsonb('allocation_buckets').$type<Array<Record<string, unknown>>>().notNull(),
    assetClassAllocations: jsonb('asset_class_allocations')
      .$type<Array<Record<string, unknown>>>()
      .notNull(),
    driftSignals: jsonb('drift_signals').$type<Array<Record<string, unknown>>>().notNull(),
    scenarios: jsonb('scenarios').$type<Array<Record<string, unknown>>>().notNull(),
    diagnostics: jsonb('diagnostics').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_portfolio_snapshot_run_id_unique').on(table.runId),
    index('ai_portfolio_snapshot_as_of_date_idx').on(table.asOfDate),
  ]
)

export const aiDailyBrief = pgTable(
  'ai_daily_brief',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id').references(() => aiPortfolioSnapshot.id, {
      onDelete: 'set null',
    }),
    title: text('title').notNull(),
    summary: text('summary').notNull(),
    keyFacts: jsonb('key_facts').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    opportunities: jsonb('opportunities').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    risks: jsonb('risks').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    watchItems: jsonb('watch_items').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    recommendationNotes: jsonb('recommendation_notes')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    provider: text('provider'),
    model: text('model'),
    promptTemplateKey: text('prompt_template_key'),
    promptTemplateVersion: text('prompt_template_version'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_daily_brief_run_id_idx').on(table.runId),
    index('ai_daily_brief_created_at_idx').on(table.createdAt),
  ]
)

export const aiRecommendation = pgTable(
  'ai_recommendation',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id').references(() => aiPortfolioSnapshot.id, {
      onDelete: 'set null',
    }),
    recommendationKey: text('recommendation_key').notNull(),
    type: text('type').notNull(),
    category: text('category').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    whyNow: text('why_now').notNull(),
    evidence: jsonb('evidence').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confidence: numeric('confidence', { precision: 6, scale: 4 }).notNull(),
    riskLevel: aiRecommendationRiskLevelEnum('risk_level').notNull(),
    expectedImpact: jsonb('expected_impact').$type<Record<string, unknown>>().notNull(),
    effort: aiRecommendationEffortEnum('effort').notNull(),
    reversibility: aiRecommendationReversibilityEnum('reversibility').notNull(),
    blockingFactors: jsonb('blocking_factors').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    alternatives: jsonb('alternatives').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    deterministicMetricsUsed: jsonb('deterministic_metrics_used')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    llmModelsUsed: jsonb('llm_models_used').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    challengerStatus: aiRecommendationChallengeStatusEnum('challenger_status')
      .notNull()
      .default('skipped'),
    priorityScore: integer('priority_score').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_recommendation_run_key_unique').on(table.runId, table.recommendationKey),
    index('ai_recommendation_category_idx').on(table.category),
    index('ai_recommendation_priority_idx').on(table.priorityScore),
    index('ai_recommendation_created_at_idx').on(table.createdAt),
  ]
)

export const aiRecommendationChallenge = pgTable(
  'ai_recommendation_challenge',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    recommendationId: integer('recommendation_id')
      .notNull()
      .references(() => aiRecommendation.id, { onDelete: 'cascade' }),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    status: aiRecommendationChallengeStatusEnum('status').notNull(),
    summary: text('summary').notNull(),
    contradictions: jsonb('contradictions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    missingSignals: jsonb('missing_signals').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confidenceAdjustment: numeric('confidence_adjustment', { precision: 6, scale: 4 }).notNull(),
    provider: text('provider'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_recommendation_challenge_recommendation_unique').on(table.recommendationId),
    index('ai_recommendation_challenge_status_idx').on(table.status),
  ]
)

export const aiMacroSignal = pgTable(
  'ai_macro_signal',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    signalKey: text('signal_key').notNull(),
    title: text('title').notNull(),
    direction: text('direction').notNull(),
    severity: integer('severity').notNull().default(0),
    confidence: integer('confidence').notNull().default(0),
    facts: jsonb('facts').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    hypotheses: jsonb('hypotheses').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    implications: jsonb('implications').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sourceRefs: jsonb('source_refs').$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_macro_signal_run_key_unique').on(table.runId, table.signalKey),
    index('ai_macro_signal_direction_idx').on(table.direction),
  ]
)

export const aiNewsSignal = pgTable(
  'ai_news_signal',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    newsArticleId: integer('news_article_id').references(() => newsArticle.id, {
      onDelete: 'set null',
    }),
    signalKey: text('signal_key').notNull(),
    title: text('title').notNull(),
    eventType: text('event_type').notNull(),
    direction: text('direction').notNull(),
    severity: integer('severity').notNull().default(0),
    confidence: integer('confidence').notNull().default(0),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    supportingUrls: jsonb('supporting_urls').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    affectedEntities: jsonb('affected_entities').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    affectedSectors: jsonb('affected_sectors').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    whyItMatters: jsonb('why_it_matters').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_news_signal_run_key_unique').on(table.runId, table.signalKey),
    index('ai_news_signal_news_article_id_idx').on(table.newsArticleId),
    index('ai_news_signal_published_at_idx').on(table.publishedAt),
  ]
)

export const aiTransactionLabelSuggestion = pgTable(
  'ai_transaction_label_suggestion',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    transactionId: integer('transaction_id').references(() => transaction.id, {
      onDelete: 'set null',
    }),
    suggestionKey: text('suggestion_key').notNull(),
    status: text('status').notNull().default('suggested'),
    suggestionSource: text('suggestion_source').notNull().default('deterministic'),
    suggestedKind: text('suggested_kind').notNull(),
    suggestedCategory: text('suggested_category').notNull(),
    suggestedSubcategory: text('suggested_subcategory'),
    suggestedTags: jsonb('suggested_tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    confidence: numeric('confidence', { precision: 6, scale: 4 }).notNull(),
    rationale: jsonb('rationale').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    provider: text('provider'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
  },
  table => [
    uniqueIndex('ai_transaction_label_suggestion_run_key_unique').on(table.runId, table.suggestionKey),
    index('ai_transaction_label_suggestion_transaction_id_idx').on(table.transactionId),
    index('ai_transaction_label_suggestion_status_idx').on(table.status),
  ]
)

export const aiAssumptionLog = pgTable(
  'ai_assumption_log',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    snapshotId: integer('snapshot_id').references(() => aiPortfolioSnapshot.id, {
      onDelete: 'set null',
    }),
    assumptionKey: text('assumption_key').notNull(),
    source: text('source').notNull(),
    value: jsonb('value').$type<unknown>().notNull(),
    justification: text('justification').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_assumption_log_run_id_idx').on(table.runId),
    index('ai_assumption_log_assumption_key_idx').on(table.assumptionKey),
  ]
)

export const aiChatThread = pgTable(
  'ai_chat_thread',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    threadKey: text('thread_key').notNull(),
    title: text('title').notNull().default('Finance Assistant'),
    mode: text('mode').notNull().default('admin'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_chat_thread_key_unique').on(table.threadKey),
    index('ai_chat_thread_updated_at_idx').on(table.updatedAt),
  ]
)

export const aiChatMessage = pgTable(
  'ai_chat_message',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    threadId: integer('thread_id')
      .notNull()
      .references(() => aiChatThread.id, { onDelete: 'cascade' }),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    role: aiChatMessageRoleEnum('role').notNull(),
    content: text('content').notNull(),
    citations: jsonb('citations').$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    assumptions: jsonb('assumptions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    caveats: jsonb('caveats').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    simulations: jsonb('simulations').$type<Array<Record<string, unknown>>>().notNull().default(sql`'[]'::jsonb`),
    provider: text('provider'),
    model: text('model'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_chat_message_thread_id_idx').on(table.threadId),
    index('ai_chat_message_created_at_idx').on(table.createdAt),
  ]
)

export const aiRunStep = pgTable(
  'ai_run_step',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id')
      .notNull()
      .references(() => aiRun.id, { onDelete: 'cascade' }),
    stepKey: text('step_key').notNull(),
    status: aiStepStatusEnum('status').notNull().default('queued'),
    provider: text('provider'),
    model: text('model'),
    promptTemplateKey: text('prompt_template_key'),
    promptTemplateVersion: text('prompt_template_version'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    latencyMs: integer('latency_ms'),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_run_step_run_key_unique').on(table.runId, table.stepKey),
    index('ai_run_step_status_idx').on(table.status),
    index('ai_run_step_provider_model_idx').on(table.provider, table.model),
  ]
)

export const aiModelUsage = pgTable(
  'ai_model_usage',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'cascade' }),
    runStepId: integer('run_step_id').references(() => aiRunStep.id, { onDelete: 'set null' }),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    endpointType: text('endpoint_type').notNull(),
    feature: text('feature').notNull(),
    status: aiStepStatusEnum('status').notNull().default('completed'),
    inputTokens: integer('input_tokens').notNull().default(0),
    outputTokens: integer('output_tokens').notNull().default(0),
    cachedInputTokens: integer('cached_input_tokens').notNull().default(0),
    cacheWriteTokens: integer('cache_write_tokens').notNull().default(0),
    cacheDuration: text('cache_duration'),
    batch: boolean('batch').notNull().default(false),
    latencyMs: integer('latency_ms').notNull().default(0),
    requestId: text('request_id'),
    responseId: text('response_id'),
    pricingVersion: text('pricing_version').notNull(),
    estimatedCostUsd: numeric('estimated_cost_usd', { precision: 18, scale: 6 }).notNull(),
    estimatedCostEur: numeric('estimated_cost_eur', { precision: 18, scale: 6 }).notNull(),
    usdToEurRate: numeric('usd_to_eur_rate', { precision: 12, scale: 6 }).notNull(),
    rawUsage: jsonb('raw_usage').$type<Record<string, unknown> | null>(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_model_usage_run_id_idx').on(table.runId),
    index('ai_model_usage_feature_idx').on(table.feature),
    index('ai_model_usage_provider_model_idx').on(table.provider, table.model),
    index('ai_model_usage_created_at_idx').on(table.createdAt),
  ]
)

export const aiCostLedger = pgTable(
  'ai_cost_ledger',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'cascade' }),
    modelUsageId: integer('model_usage_id').references(() => aiModelUsage.id, {
      onDelete: 'set null',
    }),
    ledgerDate: date('ledger_date').notNull(),
    provider: text('provider').notNull(),
    model: text('model').notNull(),
    feature: text('feature').notNull(),
    amountUsd: numeric('amount_usd', { precision: 18, scale: 6 }).notNull(),
    amountEur: numeric('amount_eur', { precision: 18, scale: 6 }).notNull(),
    pricingVersion: text('pricing_version').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_cost_ledger_ledger_date_idx').on(table.ledgerDate),
    index('ai_cost_ledger_feature_idx').on(table.feature),
    index('ai_cost_ledger_provider_model_idx').on(table.provider, table.model),
  ]
)

export const aiEvalCase = pgTable(
  'ai_eval_case',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    caseKey: text('case_key').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    input: jsonb('input').$type<Record<string, unknown>>().notNull(),
    expectation: jsonb('expectation').$type<Record<string, unknown>>().notNull(),
    active: boolean('active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('ai_eval_case_key_unique').on(table.caseKey),
    index('ai_eval_case_category_idx').on(table.category),
  ]
)

export const aiEvalRun = pgTable(
  'ai_eval_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: integer('run_id').references(() => aiRun.id, { onDelete: 'set null' }),
    status: aiRunStatusEnum('status').notNull().default('completed'),
    totalCases: integer('total_cases').notNull().default(0),
    passedCases: integer('passed_cases').notNull().default(0),
    failedCases: integer('failed_cases').notNull().default(0),
    summary: jsonb('summary').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    index('ai_eval_run_run_id_idx').on(table.runId),
    index('ai_eval_run_created_at_idx').on(table.createdAt),
  ]
)
