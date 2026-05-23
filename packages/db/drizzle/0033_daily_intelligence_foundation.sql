-- Additive foundation for Daily Intelligence observability, market valuation,
-- advisor investment recommendations, and prediction learning loops.

ALTER TABLE "free_firehose_run" ADD COLUMN IF NOT EXISTS "override_requested" boolean DEFAULT false NOT NULL;
ALTER TABLE "free_firehose_run" ADD COLUMN IF NOT EXISTS "override_confirmed_risk" boolean DEFAULT false NOT NULL;
ALTER TABLE "free_firehose_run" ADD COLUMN IF NOT EXISTS "override_used" boolean DEFAULT false NOT NULL;
ALTER TABLE "free_firehose_run" ADD COLUMN IF NOT EXISTS "override_reason" text;

CREATE TABLE IF NOT EXISTS "asset_price_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"asset_id" text,
	"instrument_id" text,
	"symbol" text NOT NULL,
	"isin" text,
	"figi" text,
	"conid" text,
	"exchange" text,
	"mic" text,
	"asset_class" text NOT NULL,
	"provider" text NOT NULL,
	"provider_priority" integer DEFAULT 100 NOT NULL,
	"source_type" text NOT NULL,
	"price" numeric(24, 10) NOT NULL,
	"currency" text NOT NULL,
	"bid" numeric(24, 10),
	"ask" numeric(24, 10),
	"last" numeric(24, 10),
	"close" numeric(24, 10),
	"previous_close" numeric(24, 10),
	"volume" numeric(28, 6),
	"market_timestamp" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"delay_seconds" integer DEFAULT 0 NOT NULL,
	"stale_after_seconds" integer NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"stale_reason" text,
	"is_market_open" boolean,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"raw_payload_hash" text,
	"raw_payload_redacted" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "asset_price_snapshot_symbol_idx" ON "asset_price_snapshot" ("symbol");
CREATE INDEX IF NOT EXISTS "asset_price_snapshot_instrument_idx" ON "asset_price_snapshot" ("instrument_id");
CREATE INDEX IF NOT EXISTS "asset_price_snapshot_provider_idx" ON "asset_price_snapshot" ("provider");
CREATE INDEX IF NOT EXISTS "asset_price_snapshot_market_ts_idx" ON "asset_price_snapshot" ("market_timestamp");
CREATE INDEX IF NOT EXISTS "asset_price_snapshot_created_at_idx" ON "asset_price_snapshot" ("created_at");

CREATE TABLE IF NOT EXISTS "asset_valuation_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"account_id" text,
	"asset_id" text,
	"instrument_id" text,
	"quantity" numeric(28, 10) NOT NULL,
	"price" numeric(24, 10) NOT NULL,
	"price_currency" text NOT NULL,
	"base_currency" text NOT NULL,
	"fx_rate" numeric(24, 12),
	"fx_rate_source" text,
	"fx_rate_timestamp" timestamp with time zone,
	"value_base" numeric(28, 10) NOT NULL,
	"price_snapshot_id" integer REFERENCES "asset_price_snapshot"("id") ON DELETE SET NULL,
	"valuation_timestamp" timestamp with time zone NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"stale_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "asset_valuation_snapshot_account_idx" ON "asset_valuation_snapshot" ("account_id");
CREATE INDEX IF NOT EXISTS "asset_valuation_snapshot_instrument_idx" ON "asset_valuation_snapshot" ("instrument_id");
CREATE INDEX IF NOT EXISTS "asset_valuation_snapshot_price_snapshot_idx" ON "asset_valuation_snapshot" ("price_snapshot_id");
CREATE INDEX IF NOT EXISTS "asset_valuation_snapshot_created_at_idx" ON "asset_valuation_snapshot" ("created_at");

CREATE TABLE IF NOT EXISTS "provider_health_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"provider" text NOT NULL,
	"asset_class" text NOT NULL,
	"status" text NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"latency_ms" integer,
	"rate_limit_remaining" integer,
	"error_code" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "provider_health_snapshot_provider_idx" ON "provider_health_snapshot" ("provider");
CREATE INDEX IF NOT EXISTS "provider_health_snapshot_status_idx" ON "provider_health_snapshot" ("status");
CREATE INDEX IF NOT EXISTS "provider_health_snapshot_created_at_idx" ON "provider_health_snapshot" ("created_at");

CREATE TABLE IF NOT EXISTS "fx_rate_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"base_currency" text NOT NULL,
	"quote_currency" text NOT NULL,
	"provider" text NOT NULL,
	"source_type" text NOT NULL,
	"rate" numeric(24, 12) NOT NULL,
	"rate_timestamp" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"stale_after_seconds" integer DEFAULT 129600 NOT NULL,
	"is_stale" boolean DEFAULT false NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "fx_rate_snapshot_pair_idx" ON "fx_rate_snapshot" ("base_currency", "quote_currency");
CREATE INDEX IF NOT EXISTS "fx_rate_snapshot_provider_idx" ON "fx_rate_snapshot" ("provider");
CREATE INDEX IF NOT EXISTS "fx_rate_snapshot_rate_ts_idx" ON "fx_rate_snapshot" ("rate_timestamp");

CREATE TABLE IF NOT EXISTS "advisor_investment_recommendation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"run_id" integer REFERENCES "ai_run"("id") ON DELETE SET NULL,
	"legacy_recommendation_id" integer REFERENCES "ai_recommendation"("id") ON DELETE SET NULL,
	"account_scope" text NOT NULL,
	"asset_id" text,
	"instrument_id" text,
	"symbol" text NOT NULL,
	"action" text NOT NULL,
	"horizon" text NOT NULL,
	"thesis" text NOT NULL,
	"supporting_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contradicting_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_level" text NOT NULL,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"price_used" numeric(24, 10),
	"price_snapshot_id" integer REFERENCES "asset_price_snapshot"("id") ON DELETE SET NULL,
	"price_source" text,
	"price_source_type" text,
	"market_timestamp" timestamp with time zone,
	"fetched_at" timestamp with time zone,
	"delay_seconds" integer,
	"is_price_stale" boolean DEFAULT false NOT NULL,
	"stale_reason" text,
	"invalidation_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"expected_move" double precision,
	"probability" double precision,
	"review_dates" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_data" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"human_validation_required" boolean DEFAULT true NOT NULL,
	"no_auto_trade" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_investment_recommendation_run_idx" ON "advisor_investment_recommendation" ("run_id");
CREATE INDEX IF NOT EXISTS "advisor_investment_recommendation_scope_idx" ON "advisor_investment_recommendation" ("account_scope");
CREATE INDEX IF NOT EXISTS "advisor_investment_recommendation_symbol_idx" ON "advisor_investment_recommendation" ("symbol");
CREATE INDEX IF NOT EXISTS "advisor_investment_recommendation_action_idx" ON "advisor_investment_recommendation" ("action");
CREATE INDEX IF NOT EXISTS "advisor_investment_recommendation_price_snapshot_idx" ON "advisor_investment_recommendation" ("price_snapshot_id");

CREATE TABLE IF NOT EXISTS "advisor_market_hypothesis" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"recommendation_id" integer REFERENCES "advisor_investment_recommendation"("id") ON DELETE SET NULL,
	"run_id" integer REFERENCES "ai_run"("id") ON DELETE SET NULL,
	"asset_id" text,
	"symbol" text NOT NULL,
	"account_scope" text NOT NULL,
	"direction" text NOT NULL,
	"action_suggested" text NOT NULL,
	"horizon" text NOT NULL,
	"expected_move" double precision,
	"probability" double precision,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"thesis" text NOT NULL,
	"supporting_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contradicting_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invalidation_criteria" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_at_prediction" numeric(24, 10),
	"price_snapshot_id" integer REFERENCES "asset_price_snapshot"("id") ON DELETE SET NULL,
	"price_source" text,
	"price_source_type" text,
	"price_freshness" jsonb,
	"market_timestamp" timestamp with time zone,
	"fetched_at" timestamp with time zone,
	"review_schedule" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_by_model" text,
	"prompt_version" text,
	"strategy_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_market_hypothesis_recommendation_idx" ON "advisor_market_hypothesis" ("recommendation_id");
CREATE INDEX IF NOT EXISTS "advisor_market_hypothesis_run_idx" ON "advisor_market_hypothesis" ("run_id");
CREATE INDEX IF NOT EXISTS "advisor_market_hypothesis_symbol_idx" ON "advisor_market_hypothesis" ("symbol");
CREATE INDEX IF NOT EXISTS "advisor_market_hypothesis_status_idx" ON "advisor_market_hypothesis" ("status");
CREATE INDEX IF NOT EXISTS "advisor_market_hypothesis_created_at_idx" ON "advisor_market_hypothesis" ("created_at");

CREATE TABLE IF NOT EXISTS "advisor_prediction_outcome" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"hypothesis_id" integer NOT NULL REFERENCES "advisor_market_hypothesis"("id") ON DELETE CASCADE,
	"review_horizon" text NOT NULL,
	"review_due_at" timestamp with time zone NOT NULL,
	"reviewed_at" timestamp with time zone,
	"initial_price" numeric(24, 10),
	"review_price" numeric(24, 10),
	"benchmark_price" numeric(24, 10),
	"performance" double precision,
	"performance_vs_benchmark" double precision,
	"max_favorable_excursion" double precision,
	"max_adverse_excursion" double precision,
	"result" text DEFAULT 'inconclusive' NOT NULL,
	"error_attribution" text,
	"data_quality_notes" text,
	"pricing_freshness_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_prediction_outcome_hypothesis_idx" ON "advisor_prediction_outcome" ("hypothesis_id");
CREATE INDEX IF NOT EXISTS "advisor_prediction_outcome_due_idx" ON "advisor_prediction_outcome" ("review_due_at");
CREATE INDEX IF NOT EXISTS "advisor_prediction_outcome_result_idx" ON "advisor_prediction_outcome" ("result");

CREATE TABLE IF NOT EXISTS "advisor_market_post_mortem" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"hypothesis_id" integer NOT NULL REFERENCES "advisor_market_hypothesis"("id") ON DELETE CASCADE,
	"outcome_id" integer REFERENCES "advisor_prediction_outcome"("id") ON DELETE SET NULL,
	"result" text NOT NULL,
	"what_worked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"what_failed" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why_it_worked_or_failed" text NOT NULL,
	"lesson" text NOT NULL,
	"future_prompt_hint" text,
	"reusable_rule_candidate" text,
	"should_update_strategy" boolean DEFAULT false NOT NULL,
	"requires_human_review" boolean DEFAULT true NOT NULL,
	"memory_write_status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_market_post_mortem_hypothesis_idx" ON "advisor_market_post_mortem" ("hypothesis_id");
CREATE INDEX IF NOT EXISTS "advisor_market_post_mortem_outcome_idx" ON "advisor_market_post_mortem" ("outcome_id");
CREATE INDEX IF NOT EXISTS "advisor_market_post_mortem_created_at_idx" ON "advisor_market_post_mortem" ("created_at");

CREATE TABLE IF NOT EXISTS "advisor_memory_event" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"run_id" integer REFERENCES "ai_run"("id") ON DELETE SET NULL,
	"hypothesis_id" integer REFERENCES "advisor_market_hypothesis"("id") ON DELETE SET NULL,
	"event_type" text NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"graph_write_status" text DEFAULT 'pending' NOT NULL,
	"graph_write_error" text,
	"nodes_written" integer DEFAULT 0 NOT NULL,
	"edges_written" integer DEFAULT 0 NOT NULL,
	"vectors_written" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_memory_event_run_idx" ON "advisor_memory_event" ("run_id");
CREATE INDEX IF NOT EXISTS "advisor_memory_event_hypothesis_idx" ON "advisor_memory_event" ("hypothesis_id");
CREATE INDEX IF NOT EXISTS "advisor_memory_event_type_idx" ON "advisor_memory_event" ("event_type");
CREATE INDEX IF NOT EXISTS "advisor_memory_event_graph_status_idx" ON "advisor_memory_event" ("graph_write_status");
CREATE INDEX IF NOT EXISTS "advisor_memory_event_created_at_idx" ON "advisor_memory_event" ("created_at");
