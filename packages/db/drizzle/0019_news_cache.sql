CREATE TABLE "news_article" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "provider" text NOT NULL,
  "provider_article_id" text NOT NULL,
  "dedupe_key" text NOT NULL,
  "title" text NOT NULL,
  "summary" text,
  "url" text NOT NULL,
  "source_name" text NOT NULL,
  "topic" text NOT NULL,
  "language" text DEFAULT 'en' NOT NULL,
  "published_at" timestamp with time zone NOT NULL,
  "metadata" jsonb,
  "ingested_at" timestamp with time zone NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_dedupe_key_unique" ON "news_article" USING btree ("dedupe_key");
--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_provider_article_unique" ON "news_article" USING btree ("provider","provider_article_id");
--> statement-breakpoint
CREATE INDEX "news_article_published_at_idx" ON "news_article" USING btree ("published_at");
--> statement-breakpoint
CREATE INDEX "news_article_topic_idx" ON "news_article" USING btree ("topic");
--> statement-breakpoint
CREATE INDEX "news_article_source_name_idx" ON "news_article" USING btree ("source_name");
--> statement-breakpoint
CREATE TABLE "news_cache_state" (
  "singleton" boolean PRIMARY KEY DEFAULT true NOT NULL,
  "last_success_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_message" text,
  "last_request_id" text,
  "ingestion_count" integer DEFAULT 0 NOT NULL,
  "dedupe_drop_count" integer DEFAULT 0 NOT NULL,
  "provider_failure_count" integer DEFAULT 0 NOT NULL,
  "last_ingest_duration_ms" integer,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
