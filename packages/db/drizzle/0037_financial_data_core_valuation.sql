-- FINANCIAL-DATA-CORE-0: canonical asset valuation layer (additive only).
--
-- 1. asset_valuation_snapshot gains status/provenance/P&L columns (all nullable).
-- 2. New asset_valuation_run table (same run pattern as derived_recompute_run).
-- 3. fx_rate_snapshot gains a uniqueness guarantee for idempotent ingestion.

ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "run_id" integer;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "item_key" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "kind" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "status" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "valuation_source" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "provider" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "value_original" numeric(28, 10);--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "cost_basis_base" numeric(28, 10);--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "unrealized_pnl_base" numeric(28, 10);--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "unrealized_pnl_pct" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "as_of" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "error_code" text;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ADD COLUMN IF NOT EXISTS "safe_error_message" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_valuation_snapshot_run_idx" ON "asset_valuation_snapshot" ("run_id");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_valuation_snapshot_run_item_unique" ON "asset_valuation_snapshot" ("run_id", "item_key") WHERE "run_id" is not null and "item_key" is not null;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_valuation_run" (
  "id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_valuation_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
  "status" text NOT NULL,
  "trigger_source" text NOT NULL,
  "request_id" text NOT NULL,
  "dry_run" boolean DEFAULT false NOT NULL,
  "coverage" jsonb,
  "totals" jsonb,
  "item_count" integer,
  "snapshot_count" integer,
  "provider_failures" jsonb,
  "safe_error_code" text,
  "safe_error_message" text,
  "started_at" timestamp with time zone NOT NULL,
  "finished_at" timestamp with time zone,
  "duration_ms" integer,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_valuation_run_started_at_idx" ON "asset_valuation_run" ("started_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_valuation_run_status_idx" ON "asset_valuation_run" ("status");--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "asset_valuation_run_single_running" ON "asset_valuation_run" ("status") WHERE "status" = 'running';--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "fx_rate_snapshot_pair_provider_ts_unique" ON "fx_rate_snapshot" ("base_currency", "quote_currency", "provider", "rate_timestamp");
