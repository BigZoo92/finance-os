import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

// ---------------------------------------------------------------------------
// Signal source — a watched account, feed, or manual import source
// ---------------------------------------------------------------------------

export const signalSource = pgTable(
  'signal_source',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    handle: text('handle').notNull(),
    displayName: text('display_name').notNull(),
    url: text('url'),
    group: text('group').notNull().$type<'finance' | 'ai_tech'>(),
    enabled: boolean('enabled').notNull().default(true),
    priority: integer('priority').notNull().default(50),
    tags: jsonb('tags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    language: text('language').notNull().default('en'),
    includePatterns: jsonb('include_patterns')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    excludePatterns: jsonb('exclude_patterns')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    minRelevanceScore: integer('min_relevance_score').notNull().default(0),
    requiresAttentionPolicy: text('requires_attention_policy')
      .notNull()
      .default('auto')
      .$type<'auto' | 'always' | 'never' | 'high_only'>(),
    lastFetchedAt: timestamp('last_fetched_at', { withTimezone: true }),
    lastCursor: text('last_cursor'),
    lastError: text('last_error'),
    lastFetchedCount: integer('last_fetched_count'),
    /** Provider-side user ID (e.g. X numeric user_id). Stored once after the first
     *  by-username lookup so daily timeline fetches don't pay $0.01/run/user. */
    externalId: text('external_id'),
    /** Cached profile_image_url for UI display (avatar). 24h Redis cache also exists. */
    profileImageUrl: text('profile_image_url'),
    /** Last-known provider profile metadata (verified, public_metrics, description, banner). */
    profileMetadata: jsonb('profile_metadata').$type<Record<string, unknown> | null>(),
    /** When the cached profile was last refreshed from the provider. */
    profileCachedAt: timestamp('profile_cached_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('signal_source_provider_handle_unique').on(table.provider, table.handle),
    index('signal_source_group_idx').on(table.group),
    index('signal_source_enabled_idx').on(table.enabled),
    index('signal_source_provider_idx').on(table.provider),
  ]
)

// ---------------------------------------------------------------------------
// Signal ingestion run — tracks each ingestion pass
// ---------------------------------------------------------------------------

export const signalIngestionRun = pgTable(
  'signal_ingestion_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    runType: text('run_type')
      .notNull()
      .default('scheduled')
      .$type<'scheduled' | 'manual' | 'social_poll' | 'manual_import'>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    status: text('status')
      .notNull()
      .default('running')
      .$type<'running' | 'success' | 'partial' | 'failed'>(),
    fetchedCount: integer('fetched_count').notNull().default(0),
    insertedCount: integer('inserted_count').notNull().default(0),
    dedupedCount: integer('deduped_count').notNull().default(0),
    classifiedCount: integer('classified_count').notNull().default(0),
    graphIngestedCount: integer('graph_ingested_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    errorSummary: text('error_summary'),
    requestId: text('request_id'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('signal_ingestion_run_provider_idx').on(table.provider),
    index('signal_ingestion_run_started_at_idx').on(table.startedAt),
    index('signal_ingestion_run_status_idx').on(table.status),
  ]
)

// ---------------------------------------------------------------------------
// Signal item — canonical persisted signal (news, social, macro, manual)
// ---------------------------------------------------------------------------

export const signalItem = pgTable(
  'signal_item',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    sourceProvider: text('source_provider').notNull(),
    sourceType: text('source_type').notNull().default('social'),
    sourceAccountId: integer('source_account_id'),
    externalId: text('external_id').notNull(),
    url: text('url'),
    title: text('title').notNull(),
    body: text('body'),
    author: text('author'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull(),
    language: text('language').notNull().default('en'),
    entities: jsonb('entities').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    tickers: jsonb('tickers').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    sectors: jsonb('sectors').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    regions: jsonb('regions').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    topics: jsonb('topics').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    signalDomain: text('signal_domain').notNull().default('unknown'),
    relevanceScore: integer('relevance_score').notNull().default(0),
    noveltyScore: integer('novelty_score').notNull().default(0),
    confidenceScore: integer('confidence_score').notNull().default(0),
    impactScore: integer('impact_score').notNull().default(0),
    urgencyScore: integer('urgency_score').notNull().default(0),
    requiresAttention: boolean('requires_attention').notNull().default(false),
    attentionReason: text('attention_reason'),
    sentiment: doublePrecision('sentiment'),
    dedupeKey: text('dedupe_key').notNull(),
    contentHash: text('content_hash').notNull(),
    provenance: jsonb('provenance')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    rawPayloadRedacted: jsonb('raw_payload_redacted').$type<Record<string, unknown> | null>(),
    graphIngestStatus: text('graph_ingest_status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'sent' | 'skipped' | 'failed'>(),
    advisorIngestStatus: text('advisor_ingest_status')
      .notNull()
      .default('pending')
      .$type<'pending' | 'sent' | 'skipped'>(),
    scope: text('scope').notNull().default('admin').$type<'admin' | 'demo'>(),
    ingestionRunId: integer('ingestion_run_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('signal_item_dedupe_key_unique').on(table.dedupeKey),
    index('signal_item_published_at_idx').on(table.publishedAt),
    index('signal_item_signal_domain_idx').on(table.signalDomain),
    index('signal_item_source_provider_idx').on(table.sourceProvider),
    index('signal_item_requires_attention_idx').on(table.requiresAttention),
    index('signal_item_content_hash_idx').on(table.contentHash),
    index('signal_item_graph_ingest_status_idx').on(table.graphIngestStatus),
    index('signal_item_ingestion_run_id_idx').on(table.ingestionRunId),
  ]
)

// ---------------------------------------------------------------------------
// X / Twitter pay-per-use ledger
// ---------------------------------------------------------------------------
//
// Each X API call (resource read) is billed. We persist one row per call so
// the worker can refuse to launch a run that would blow the daily / monthly
// cap (X_DAILY_BUDGET_USD / X_MONTHLY_BUDGET_USD). Aggregations are computed
// at read time — no secondary counter table to drift out of sync.

export const xTwitterUsageLedger = pgTable(
  'x_twitter_usage_ledger',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: text('run_id'),
    /** Endpoint hit, e.g. 'users/by/username', 'users/:id/tweets' (no PII / no token). */
    endpoint: text('endpoint').notNull(),
    /** Billable counters (post reads, user reads) charged by X for this call. */
    postReads: integer('post_reads').notNull().default(0),
    userReads: integer('user_reads').notNull().default(0),
    /** Estimated cost in USD (computed from postReads × $0.005 + userReads × $0.010). */
    estimatedCostUsd: doublePrecision('estimated_cost_usd').notNull().default(0),
    /** Actual cost USD if X has reported it (otherwise null). */
    actualCostUsd: doublePrecision('actual_cost_usd'),
    requestCount: integer('request_count').notNull().default(1),
    statusCode: integer('status_code'),
    /** Provider error code if any: TOKEN_INVALID, PAYMENT_REQUIRED, RATE_LIMITED, etc. */
    errorCode: text('error_code'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('x_twitter_usage_ledger_occurred_at_idx').on(table.occurredAt),
    index('x_twitter_usage_ledger_run_id_idx').on(table.runId),
    index('x_twitter_usage_ledger_error_code_idx').on(table.errorCode),
  ]
)

// ---------------------------------------------------------------------------
// Free Firehose manual import runs
// ---------------------------------------------------------------------------
//
// Distinct from signal_ingestion_run: this table tracks the explicit, admin-
// gated, manual massive import button. One row per run. Strictly free sources
// (GDELT / HN / ECB / Fed / SEC / FRED). Never triggered by cron. Provider
// breakdown lets the UI show per-source progress and errors.

export const freeFirehoseRun = pgTable(
  'free_firehose_run',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    runId: text('run_id').notNull(),
    requestedBy: text('requested_by').notNull().default('admin'),
    /** 'dry_run' | 'live'. dry_run never writes signal_item / news_article rows. */
    mode: text('mode').notNull().$type<'dry_run' | 'live'>(),
    status: text('status')
      .notNull()
      .default('running')
      .$type<'running' | 'success' | 'partial' | 'failed' | 'cancelled' | 'skipped_quota'>(),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    fetchedCount: integer('fetched_count').notNull().default(0),
    insertedCount: integer('inserted_count').notNull().default(0),
    dedupedCount: integer('deduped_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    failedCount: integer('failed_count').notNull().default(0),
    /** Per-provider counters: { gdelt: {fetched, inserted, errors}, hn: {...} }. */
    providerBreakdown: jsonb('provider_breakdown')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    errorSummary: text('error_summary'),
    overrideRequested: boolean('override_requested').notNull().default(false),
    overrideConfirmedRisk: boolean('override_confirmed_risk').notNull().default(false),
    overrideUsed: boolean('override_used').notNull().default(false),
    overrideReason: text('override_reason'),
    requestId: text('request_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('free_firehose_run_run_id_unique').on(table.runId),
    index('free_firehose_run_started_at_idx').on(table.startedAt),
    index('free_firehose_run_status_idx').on(table.status),
  ]
)
