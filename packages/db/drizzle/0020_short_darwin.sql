ALTER TABLE "news_article" ADD COLUMN "provider_url" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "canonical_url" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "source_domain" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "source_type" text DEFAULT 'media' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "content_snippet" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "country" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "region" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "geo_scope" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "domains" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "categories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "subcategories" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "event_type" text DEFAULT 'general_update' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "severity" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "confidence" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "novelty" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "market_impact_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "relevance_score" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "risk_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "opportunity_flags" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "affected_entities" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "affected_tickers" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "affected_sectors" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "affected_themes" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "transmission_hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "macro_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "policy_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "filing_links" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "why_it_matters" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "scoring_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "normalized_title" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "canonical_url_fingerprint" text;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "clustering_key" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "event_cluster_id" text DEFAULT 'legacy' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "raw_provider_payload" jsonb;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "provenance" jsonb;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "metadata_fetch_status" text DEFAULT 'not_requested' NOT NULL;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "metadata_card" jsonb;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "metadata_fetched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_article" ADD COLUMN "last_enriched_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "news_cache_state" ADD COLUMN "last_fetched_count" integer;--> statement-breakpoint
ALTER TABLE "news_cache_state" ADD COLUMN "last_inserted_count" integer;--> statement-breakpoint
ALTER TABLE "news_cache_state" ADD COLUMN "last_merged_count" integer;--> statement-breakpoint
ALTER TABLE "news_cache_state" ADD COLUMN "last_provider_count" integer;--> statement-breakpoint
ALTER TABLE "news_cache_state" ADD COLUMN "last_signal_count" integer;--> statement-breakpoint
UPDATE "news_article"
SET
  "provider_url" = COALESCE("provider_url", "url"),
  "canonical_url" = COALESCE("canonical_url", "url"),
  "source_domain" = COALESCE(
    "source_domain",
    NULLIF(
      split_part(
        regexp_replace(lower(COALESCE("canonical_url", "provider_url", "url")), '^https?://', ''),
        '/',
        1
      ),
      ''
    )
  ),
  "source_type" = COALESCE(
    "source_type",
    CASE
      WHEN "provider" = 'sec_edgar' THEN 'filing'
      WHEN "provider" IN ('ecb_rss', 'fed_rss') THEN 'central_bank'
      WHEN "provider" IN ('ecb_data', 'fred') THEN 'macro_data'
      WHEN "provider" = 'hn_algolia' THEN 'tech_forum'
      ELSE 'media'
    END
  ),
  "content_snippet" = COALESCE("content_snippet", "summary"),
  "domains" = CASE
    WHEN "domains" = '[]'::jsonb THEN
      CASE
        WHEN "topic" = 'macro' THEN '["macroeconomy","monetary_policy"]'::jsonb
        WHEN "topic" = 'markets' THEN '["markets"]'::jsonb
        WHEN "topic" = 'crypto' THEN '["technology","markets","emerging_themes"]'::jsonb
        WHEN "topic" = 'etf' THEN '["markets","finance"]'::jsonb
        ELSE '["general_impact"]'::jsonb
      END
    ELSE "domains"
  END,
  "categories" = CASE
    WHEN "categories" = '[]'::jsonb THEN
      CASE
        WHEN "topic" = 'macro' THEN '["macro"]'::jsonb
        WHEN "topic" = 'markets' THEN '["markets"]'::jsonb
        WHEN "topic" = 'crypto' THEN '["technology","markets"]'::jsonb
        WHEN "topic" = 'etf' THEN '["finance","markets"]'::jsonb
        ELSE '["cross-domain"]'::jsonb
      END
    ELSE "categories"
  END,
  "subcategories" = CASE
    WHEN "subcategories" = '[]'::jsonb THEN
      CASE
        WHEN "topic" = 'macro' THEN '["macro-release"]'::jsonb
        WHEN "topic" = 'markets' THEN '["market-structure"]'::jsonb
        WHEN "topic" = 'crypto' THEN '["digital-assets"]'::jsonb
        WHEN "topic" = 'etf' THEN '["exchange-traded-funds"]'::jsonb
        ELSE '["general-impact"]'::jsonb
      END
    ELSE "subcategories"
  END,
  "event_type" = CASE
    WHEN "event_type" <> 'general_update' THEN "event_type"
    WHEN "provider" = 'sec_edgar' THEN 'filing_8k'
    WHEN "topic" = 'macro' THEN 'macro_release'
    ELSE 'general_update'
  END,
  "severity" = GREATEST(
    "severity",
    CASE
      WHEN "provider" = 'sec_edgar' THEN 70
      WHEN "topic" = 'macro' THEN 58
      ELSE 28
    END
  ),
  "confidence" = GREATEST(
    "confidence",
    CASE
      WHEN "provider" = 'sec_edgar' THEN 90
      WHEN "provider" IN ('ecb_rss', 'fed_rss', 'ecb_data', 'fred') THEN 84
      ELSE 68
    END
  ),
  "novelty" = GREATEST("novelty", 35),
  "market_impact_score" = GREATEST(
    "market_impact_score",
    CASE
      WHEN "provider" = 'sec_edgar' THEN 62
      WHEN "topic" = 'macro' THEN 60
      WHEN "topic" = 'markets' THEN 48
      ELSE 30
    END
  ),
  "relevance_score" = GREATEST(
    "relevance_score",
    CASE
      WHEN "provider" = 'sec_edgar' THEN 66
      WHEN "topic" = 'macro' THEN 64
      WHEN "topic" = 'markets' THEN 52
      ELSE 36
    END
  ),
  "normalized_title" = COALESCE(
    "normalized_title",
    lower(trim(regexp_replace("title", '[^a-zA-Z0-9]+', ' ', 'g')))
  ),
  "canonical_url_fingerprint" = COALESCE("canonical_url_fingerprint", substring("dedupe_key" from 1 for 24)),
  "clustering_key" = CASE
    WHEN "clustering_key" = 'legacy' THEN substring("dedupe_key" from 1 for 32)
    ELSE "clustering_key"
  END,
  "event_cluster_id" = CASE
    WHEN "event_cluster_id" = 'legacy' THEN substring("dedupe_key" from 1 for 20)
    ELSE "event_cluster_id"
  END,
  "first_seen_at" = COALESCE("first_seen_at", "ingested_at", "created_at", now()),
  "provenance" = COALESCE(
    "provenance",
    jsonb_build_object(
      'sourceCount', 1,
      'providerCount', 1,
      'providers', jsonb_build_array("provider"),
      'sourceDomains',
      CASE
        WHEN "source_domain" IS NULL THEN '[]'::jsonb
        ELSE jsonb_build_array("source_domain")
      END,
      'primaryReason', 'legacy-backfill'
    )
  ),
  "why_it_matters" = CASE
    WHEN "why_it_matters" = '[]'::jsonb THEN
      CASE
        WHEN "provider" = 'sec_edgar' THEN '["Primary filing upgraded from legacy cache row."]'::jsonb
        WHEN "topic" = 'macro' THEN '["Legacy macro headline promoted into the structured signal cache."]'::jsonb
        ELSE '["Legacy news row backfilled into the structured signal cache."]'::jsonb
      END
    ELSE "why_it_matters"
  END,
  "scoring_reasons" = CASE
    WHEN "scoring_reasons" = '[]'::jsonb THEN '["legacy-backfill"]'::jsonb
    ELSE "scoring_reasons"
  END,
  "last_enriched_at" = COALESCE("last_enriched_at", "updated_at", "ingested_at")
;--> statement-breakpoint
CREATE TABLE "news_article_source_ref" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  "news_article_id" integer NOT NULL,
  "provider" text NOT NULL,
  "provider_article_id" text NOT NULL,
  "provider_url" text,
  "canonical_url" text,
  "source_name" text NOT NULL,
  "source_domain" text,
  "source_type" text DEFAULT 'media' NOT NULL,
  "title" text NOT NULL,
  "normalized_title" text,
  "language" text DEFAULT 'en' NOT NULL,
  "published_at" timestamp with time zone NOT NULL,
  "metadata" jsonb,
  "raw_provider_payload" jsonb,
  "dedupe_evidence" jsonb,
  "ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
ALTER TABLE "news_article_source_ref" ADD CONSTRAINT "news_article_source_ref_news_article_id_news_article_id_fk" FOREIGN KEY ("news_article_id") REFERENCES "public"."news_article"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
INSERT INTO "news_article_source_ref" (
  "news_article_id",
  "provider",
  "provider_article_id",
  "provider_url",
  "canonical_url",
  "source_name",
  "source_domain",
  "source_type",
  "title",
  "normalized_title",
  "language",
  "published_at",
  "metadata",
  "raw_provider_payload",
  "ingested_at",
  "updated_at"
)
SELECT
  "id",
  "provider",
  "provider_article_id",
  "provider_url",
  "canonical_url",
  "source_name",
  "source_domain",
  "source_type",
  "title",
  "normalized_title",
  "language",
  "published_at",
  "metadata",
  "raw_provider_payload",
  "ingested_at",
  "updated_at"
FROM "news_article"
;--> statement-breakpoint
CREATE TABLE "news_provider_state" (
  "provider" text PRIMARY KEY NOT NULL,
  "enabled" boolean DEFAULT true NOT NULL,
  "last_success_at" timestamp with time zone,
  "last_attempt_at" timestamp with time zone,
  "last_failure_at" timestamp with time zone,
  "last_error_code" text,
  "last_error_message" text,
  "last_request_id" text,
  "last_fetched_count" integer,
  "last_inserted_count" integer,
  "last_merged_count" integer,
  "success_count" integer DEFAULT 0 NOT NULL,
  "failure_count" integer DEFAULT 0 NOT NULL,
  "skipped_count" integer DEFAULT 0 NOT NULL,
  "last_duration_ms" integer,
  "cooldown_until" timestamp with time zone,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
INSERT INTO "news_provider_state" ("provider", "enabled")
SELECT DISTINCT "provider", true
FROM "news_article"
ON CONFLICT ("provider") DO NOTHING;--> statement-breakpoint
CREATE INDEX "news_article_source_type_idx" ON "news_article" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "news_article_source_domain_idx" ON "news_article" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "news_article_event_type_idx" ON "news_article" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "news_article_relevance_score_idx" ON "news_article" USING btree ("relevance_score");--> statement-breakpoint
CREATE INDEX "news_article_market_impact_score_idx" ON "news_article" USING btree ("market_impact_score");--> statement-breakpoint
CREATE INDEX "news_article_clustering_key_idx" ON "news_article" USING btree ("clustering_key");--> statement-breakpoint
CREATE INDEX "news_article_event_cluster_id_idx" ON "news_article" USING btree ("event_cluster_id");--> statement-breakpoint
CREATE UNIQUE INDEX "news_article_source_ref_provider_article_unique" ON "news_article_source_ref" USING btree ("provider", "provider_article_id");--> statement-breakpoint
CREATE INDEX "news_article_source_ref_news_article_id_idx" ON "news_article_source_ref" USING btree ("news_article_id");--> statement-breakpoint
CREATE INDEX "news_article_source_ref_source_domain_idx" ON "news_article_source_ref" USING btree ("source_domain");--> statement-breakpoint
CREATE INDEX "news_article_source_ref_published_at_idx" ON "news_article_source_ref" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_provider_state_last_attempt_at_idx" ON "news_provider_state" USING btree ("last_attempt_at");--> statement-breakpoint
CREATE INDEX "news_provider_state_cooldown_until_idx" ON "news_provider_state" USING btree ("cooldown_until");
