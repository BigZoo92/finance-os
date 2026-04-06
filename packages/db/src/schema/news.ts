import { boolean, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core'

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
    sourceName: text('source_name').notNull(),
    topic: text('topic').notNull(),
    language: text('language').notNull().default('en'),
    publishedAt: timestamp('published_at', { withTimezone: true }).notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown> | null>(),
    ingestedAt: timestamp('ingested_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [
    uniqueIndex('news_article_dedupe_key_unique').on(table.dedupeKey),
    uniqueIndex('news_article_provider_article_unique').on(table.provider, table.providerArticleId),
    index('news_article_published_at_idx').on(table.publishedAt),
    index('news_article_topic_idx').on(table.topic),
    index('news_article_source_name_idx').on(table.sourceName),
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
    lastIngestDurationMs: integer('last_ingest_duration_ms'),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  table => [primaryKey({ columns: [table.singleton], name: 'news_cache_state_singleton_pk' })]
)
