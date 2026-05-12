-- Additive only. Wires X profile cache columns on signal_source plus the new
-- pay-per-use usage ledger and the admin Free Firehose manual run tracker.

ALTER TABLE "signal_source" ADD COLUMN IF NOT EXISTS "external_id" text;
ALTER TABLE "signal_source" ADD COLUMN IF NOT EXISTS "profile_image_url" text;
ALTER TABLE "signal_source" ADD COLUMN IF NOT EXISTS "profile_metadata" jsonb;
ALTER TABLE "signal_source" ADD COLUMN IF NOT EXISTS "profile_cached_at" timestamp with time zone;

CREATE TABLE IF NOT EXISTS "x_twitter_usage_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "x_twitter_usage_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text,
	"endpoint" text NOT NULL,
	"post_reads" integer DEFAULT 0 NOT NULL,
	"user_reads" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" double precision DEFAULT 0 NOT NULL,
	"actual_cost_usd" double precision,
	"request_count" integer DEFAULT 1 NOT NULL,
	"status_code" integer,
	"error_code" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "x_twitter_usage_ledger_occurred_at_idx" ON "x_twitter_usage_ledger" ("occurred_at");
CREATE INDEX IF NOT EXISTS "x_twitter_usage_ledger_run_id_idx" ON "x_twitter_usage_ledger" ("run_id");
CREATE INDEX IF NOT EXISTS "x_twitter_usage_ledger_error_code_idx" ON "x_twitter_usage_ledger" ("error_code");

CREATE TABLE IF NOT EXISTS "free_firehose_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "free_firehose_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" text NOT NULL,
	"requested_by" text DEFAULT 'admin' NOT NULL,
	"mode" text NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"deduped_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"provider_breakdown" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"error_summary" text,
	"request_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "free_firehose_run_run_id_unique" ON "free_firehose_run" ("run_id");
CREATE INDEX IF NOT EXISTS "free_firehose_run_started_at_idx" ON "free_firehose_run" ("started_at");
CREATE INDEX IF NOT EXISTS "free_firehose_run_status_idx" ON "free_firehose_run" ("status");
