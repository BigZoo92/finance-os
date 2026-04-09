import { sql } from 'drizzle-orm'
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const newsArticle = pgTable(
  'news_article',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    provider: text('provider').notNull(),
    providerArticleId: text('provider_article_id').notNull(),
    dedupeKey: text('dedupe_key').notNull(),
    title: text('title').notNull(),
    summary: text('summary'),
    url: text('url').notNull(),
    providerUrl: text('provider_url'),
    canonicalUrl: text('canonical_url'),
    sourceName: text('source_name').notNull(),
    sourceDomain: text('source_domain'),
    sourceType: text('source_type').notNull().default('media'),
    topic: text('topic').notNull(),
    contentSnippet: text('content_snippet'),
    language: text('language').notNull().default('en'),
    country: text('country'),
    region: text('region'),
    geoScope: text('geo_scope'),
    domains: jsonb('domains').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    categories: jsonb('categories').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    subcategories: jsonb('subcategories').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    eventType: text('event_type').notNull().default('general_update'),
    severity: integer('severity').notNull().default(0),
    confidence: integer('confidence').notNull().default(0),
    novelty: integer('novelty').notNull().default(0),
    marketImpactScore: integer('market_impact_score').notNull().default(0),
    relevanceScore: integer('relevance_score').notNull().default(0),
    riskFlags: jsonb('risk_flags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    opportunityFlags: jsonb('opportunity_flags').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    affectedEntities: jsonb('affected_entities')
      .$type<
        Array<{
          name: string
          type: string
          role: 'primary' | 'affected' | 'reference'
          confidence: number
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    affectedTickers: jsonb('affected_tickers').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    affectedSectors: jsonb('affected_sectors').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    affectedThemes: jsonb('affected_themes').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    transmissionHypotheses: jsonb('transmission_hypotheses')
      .$type<
        Array<{
          id: string
          label: string
          direction: 'risk' | 'opportunity' | 'mixed'
          confidence: number
        }>
      >()
      .notNull()
      .default(sql`'[]'::jsonb`),
    macroLinks: jsonb('macro_links')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    policyLinks: jsonb('policy_links')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    filingLinks: jsonb('filing_links')
      .$type<Array<Record<string, unknown>>>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    whyItMatters: jsonb('why_it_matters').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    scoringReasons: jsonb('scoring_reasons').$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    normalizedTitle: text('normalized_title'),
    canonicalUrlFingerprint: text('canonical_url_fingerprint'),
    clusteringKey: text('clustering_key').notNull().default('legacy'),
    eventClusterId: text('event_cluster_id').notNull().default('legacy'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).notNull().defaultNow(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    rawProviderPayload: jsonb('raw_provider_payload').$type<Record<string, unknown> | null>(),
    provenance: jsonb('provenance')
      .$type<{
        sourceCount: number
        providerCount: number
        providers: string[]
        sourceDomains: string[]
        primaryReason: string | null
      } | null>(),
    metadataFetchStatus: text('metadata_fetch_status').notNull().default('not_requested'),
    metadataCard: jsonb('metadata_card').$type<Record<string, unknown> | null>(),
    metadataFetchedAt: timestamp('metadata_fetched_at', { withTimezone: true }),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull(),
    lastEnrichedAt: timestamp('last_enriched_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('news_article_dedupe_key_unique').on(table.dedupeKey),
    uniqueIndex('news_article_provider_article_unique').on(table.provider, table.providerArticleId),
    index('news_article_published_at_idx').on(table.publishedAt),
    index('news_article_topic_idx').on(table.topic),
    index('news_article_source_name_idx').on(table.sourceName),
    index('news_article_source_type_idx').on(table.sourceType),
    index('news_article_source_domain_idx').on(table.sourceDomain),
    index('news_article_event_type_idx').on(table.eventType),
    index('news_article_relevance_score_idx').on(table.relevanceScore),
    index('news_article_market_impact_score_idx').on(table.marketImpactScore),
    index('news_article_clustering_key_idx').on(table.clusteringKey),
    index('news_article_event_cluster_id_idx').on(table.eventClusterId),
  ]
)

export const newsArticleSourceRef = pgTable(
  'news_article_source_ref',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    newsArticleId: integer('news_article_id')
      .notNull()
      .references(() => newsArticle.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(),
    providerArticleId: text('provider_article_id').notNull(),
    providerUrl: text('provider_url'),
    canonicalUrl: text('canonical_url'),
    sourceName: text('source_name').notNull(),
    sourceDomain: text('source_domain'),
    sourceType: text('source_type').notNull().default('media'),
    title: text('title').notNull(),
    normalizedTitle: text('normalized_title'),
    language: text('language').notNull().default('en'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    rawProviderPayload: jsonb('raw_provider_payload').$type<Record<string, unknown> | null>(),
    dedupeEvidence: jsonb('dedupe_evidence').$type<Record<string, unknown> | null>(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  table => [
    uniqueIndex('news_article_source_ref_provider_article_unique').on(
      table.provider,
      table.providerArticleId
    ),
    index('news_article_source_ref_news_article_id_idx').on(table.newsArticleId),
    index('news_article_source_ref_source_domain_idx').on(table.sourceDomain),
    index('news_article_source_ref_published_at_idx').on(table.publishedAt),
  ]
)

export const newsCacheState = pgTable(
  'news_cache_state',
  {
    singleton: boolean('singleton').notNull().default(true),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastRequestId: text('last_request_id'),
    ingestionCount: integer('ingestion_count').notNull().default(0),
    dedupeDropCount: integer('dedupe_drop_count').notNull().default(0),
    providerFailureCount: integer('provider_failure_count').notNull().default(0),
    lastFetchedCount: integer('last_fetched_count'),
    lastInsertedCount: integer('last_inserted_count'),
    lastMergedCount: integer('last_merged_count'),
    lastProviderCount: integer('last_provider_count'),
    lastSignalCount: integer('last_signal_count'),
    lastIngestDurationMs: integer('last_ingest_duration_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.singleton], name: 'news_cache_state_singleton_pk' })]
)

export const newsProviderState = pgTable(
  'news_provider_state',
  {
    provider: text('provider').primaryKey(),
    enabled: boolean('enabled').notNull().default(true),
    lastSuccessAt: timestamp('last_success_at', { withTimezone: true }),
    lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true }),
    lastFailureAt: timestamp('last_failure_at', { withTimezone: true }),
    lastErrorCode: text('last_error_code'),
    lastErrorMessage: text('last_error_message'),
    lastRequestId: text('last_request_id'),
    lastFetchedCount: integer('last_fetched_count'),
    lastInsertedCount: integer('last_inserted_count'),
    lastMergedCount: integer('last_merged_count'),
    successCount: integer('success_count').notNull().default(0),
    failureCount: integer('failure_count').notNull().default(0),
    skippedCount: integer('skipped_count').notNull().default(0),
    lastDurationMs: integer('last_duration_ms'),
    cooldownUntil: timestamp('cooldown_until', { withTimezone: true }),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    index('news_provider_state_last_attempt_at_idx').on(table.lastAttemptAt),
    index('news_provider_state_cooldown_until_idx').on(table.cooldownUntil),
  ]
)
