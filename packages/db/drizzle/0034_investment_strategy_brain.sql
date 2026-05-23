-- Additive Investment Strategy Engine + Advisor Brain persistence.
-- Reuses the Daily Intelligence valuation, recommendation, hypothesis,
-- outcome, post-mortem, and memory-event foundations from 0033.

CREATE TABLE IF NOT EXISTS "investment_strategy_profile" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"name" text NOT NULL,
	"version" text NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"description" text NOT NULL,
	"risk_profile" text NOT NULL,
	"horizon_years" integer NOT NULL,
	"base_currency" text DEFAULT 'EUR' NOT NULL,
	"monthly_contribution_target" numeric(18, 2),
	"rebalance_threshold_pct" double precision DEFAULT 5 NOT NULL,
	"review_frequency" text DEFAULT 'daily_monitoring' NOT NULL,
	"no_auto_trade" boolean DEFAULT true NOT NULL,
	"human_validation_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "investment_strategy_profile_name_version_unique"
	ON "investment_strategy_profile" ("name", "version");
CREATE INDEX IF NOT EXISTS "investment_strategy_profile_status_idx"
	ON "investment_strategy_profile" ("status");

CREATE TABLE IF NOT EXISTS "investment_strategy_bucket" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"bucket_key" text NOT NULL,
	"target_pct" double precision NOT NULL,
	"min_pct" double precision NOT NULL,
	"max_pct" double precision NOT NULL,
	"risk_level" text NOT NULL,
	"description" text NOT NULL,
	"default_horizon" text NOT NULL,
	"rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "investment_strategy_bucket_strategy_key_unique"
	ON "investment_strategy_bucket" ("strategy_id", "bucket_key");
CREATE INDEX IF NOT EXISTS "investment_strategy_bucket_strategy_idx"
	ON "investment_strategy_bucket" ("strategy_id");

CREATE TABLE IF NOT EXISTS "account_strategy_policy" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"account_id" text,
	"provider" text NOT NULL,
	"account_type" text NOT NULL,
	"label" text NOT NULL,
	"allowed_buckets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_bucket" text,
	"max_allocation_pct" double precision NOT NULL,
	"max_single_asset_pct" double precision NOT NULL,
	"min_order_amount" numeric(18, 2),
	"trading_currency" text DEFAULT 'EUR' NOT NULL,
	"tax_wrapper" text,
	"eligibility_rules_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"restricted_assets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"human_readable_policy" text NOT NULL,
	"no_auto_trade" boolean DEFAULT true NOT NULL,
	"human_validation_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "account_strategy_policy_strategy_provider_label_unique"
	ON "account_strategy_policy" ("strategy_id", "provider", "label");
CREATE INDEX IF NOT EXISTS "account_strategy_policy_strategy_idx"
	ON "account_strategy_policy" ("strategy_id");
CREATE INDEX IF NOT EXISTS "account_strategy_policy_provider_idx"
	ON "account_strategy_policy" ("provider");
CREATE INDEX IF NOT EXISTS "account_strategy_policy_account_type_idx"
	ON "account_strategy_policy" ("account_type");

CREATE TABLE IF NOT EXISTS "asset_universe_candidate" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" text NOT NULL,
	"bucket" text NOT NULL,
	"account_types_allowed_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider_symbols_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"isin" text,
	"exchange" text,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"eligibility_status" text DEFAULT 'unknown' NOT NULL,
	"pea_eligibility_status" text DEFAULT 'unknown' NOT NULL,
	"risk_level" text NOT NULL,
	"liquidity_score" double precision,
	"notes" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_universe_candidate_symbol_bucket_unique"
	ON "asset_universe_candidate" ("symbol", "bucket");
CREATE INDEX IF NOT EXISTS "asset_universe_candidate_bucket_idx"
	ON "asset_universe_candidate" ("bucket");
CREATE INDEX IF NOT EXISTS "asset_universe_candidate_eligibility_idx"
	ON "asset_universe_candidate" ("eligibility_status");
CREATE INDEX IF NOT EXISTS "asset_universe_candidate_pea_eligibility_idx"
	ON "asset_universe_candidate" ("pea_eligibility_status");

CREATE TABLE IF NOT EXISTS "portfolio_allocation_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"snapshot_at" timestamp with time zone NOT NULL,
	"base_currency" text DEFAULT 'EUR' NOT NULL,
	"total_value" numeric(28, 10) NOT NULL,
	"core_value" numeric(28, 10) NOT NULL,
	"growth_value" numeric(28, 10) NOT NULL,
	"asymmetric_value" numeric(28, 10) NOT NULL,
	"cash_value" numeric(28, 10) NOT NULL,
	"unknown_value" numeric(28, 10) NOT NULL,
	"core_pct" double precision NOT NULL,
	"growth_pct" double precision NOT NULL,
	"asymmetric_pct" double precision NOT NULL,
	"drift_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"data_quality_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "portfolio_allocation_snapshot_strategy_idx"
	ON "portfolio_allocation_snapshot" ("strategy_id");
CREATE INDEX IF NOT EXISTS "portfolio_allocation_snapshot_at_idx"
	ON "portfolio_allocation_snapshot" ("snapshot_at");

CREATE TABLE IF NOT EXISTS "strategy_drift_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"snapshot_id" integer NOT NULL REFERENCES "portfolio_allocation_snapshot"("id") ON DELETE CASCADE,
	"bucket" text NOT NULL,
	"target_pct" double precision NOT NULL,
	"actual_pct" double precision NOT NULL,
	"drift_pct" double precision NOT NULL,
	"severity" text NOT NULL,
	"recommended_contribution" numeric(18, 2),
	"recommended_action" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "strategy_drift_snapshot_strategy_idx"
	ON "strategy_drift_snapshot" ("strategy_id");
CREATE INDEX IF NOT EXISTS "strategy_drift_snapshot_snapshot_idx"
	ON "strategy_drift_snapshot" ("snapshot_id");
CREATE INDEX IF NOT EXISTS "strategy_drift_snapshot_bucket_idx"
	ON "strategy_drift_snapshot" ("bucket");

CREATE TABLE IF NOT EXISTS "advisor_action_plan" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"run_id" integer REFERENCES "ai_run"("id") ON DELETE SET NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"top_action_id" integer,
	"summary" text NOT NULL,
	"global_risk" text NOT NULL,
	"global_confidence" double precision DEFAULT 0 NOT NULL,
	"data_quality_status" text NOT NULL,
	"no_auto_trade" boolean DEFAULT true NOT NULL,
	"human_validation_required" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_action_plan_strategy_idx"
	ON "advisor_action_plan" ("strategy_id");
CREATE INDEX IF NOT EXISTS "advisor_action_plan_status_generated_idx"
	ON "advisor_action_plan" ("status", "generated_at");
CREATE INDEX IF NOT EXISTS "advisor_action_plan_run_idx"
	ON "advisor_action_plan" ("run_id");

CREATE TABLE IF NOT EXISTS "advisor_action_plan_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"plan_id" integer NOT NULL REFERENCES "advisor_action_plan"("id") ON DELETE CASCADE,
	"account_policy_id" integer REFERENCES "account_strategy_policy"("id") ON DELETE SET NULL,
	"account_label" text NOT NULL,
	"account_type" text NOT NULL,
	"bucket" text NOT NULL,
	"symbol" text,
	"asset_name" text,
	"action" text NOT NULL,
	"amount_value" numeric(18, 2),
	"amount_currency" text DEFAULT 'EUR' NOT NULL,
	"target_weight_pct" double precision,
	"current_weight_pct" double precision,
	"confidence" double precision DEFAULT 0 NOT NULL,
	"risk_level" text NOT NULL,
	"horizon" text NOT NULL,
	"thesis" text NOT NULL,
	"arguments_for_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"arguments_against_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"invalidation_criteria_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"price_snapshot_id" integer REFERENCES "asset_price_snapshot"("id") ON DELETE SET NULL,
	"valuation_snapshot_id" integer REFERENCES "asset_valuation_snapshot"("id") ON DELETE SET NULL,
	"data_freshness_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"human_validation_required" boolean DEFAULT true NOT NULL,
	"no_auto_trade" boolean DEFAULT true NOT NULL,
	"creates_hypothesis" boolean DEFAULT false NOT NULL,
	"created_hypothesis_id" integer REFERENCES "advisor_market_hypothesis"("id") ON DELETE SET NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_action_plan_item_plan_idx"
	ON "advisor_action_plan_item" ("plan_id");
CREATE INDEX IF NOT EXISTS "advisor_action_plan_item_policy_idx"
	ON "advisor_action_plan_item" ("account_policy_id");
CREATE INDEX IF NOT EXISTS "advisor_action_plan_item_action_idx"
	ON "advisor_action_plan_item" ("action");
CREATE INDEX IF NOT EXISTS "advisor_action_plan_item_symbol_idx"
	ON "advisor_action_plan_item" ("symbol");

CREATE TABLE IF NOT EXISTS "strategy_lesson" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"source_hypothesis_id" integer REFERENCES "advisor_market_hypothesis"("id") ON DELETE SET NULL,
	"source_post_mortem_id" integer REFERENCES "advisor_market_post_mortem"("id") ON DELETE SET NULL,
	"lesson_type" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"confidence_impact" double precision DEFAULT 0 NOT NULL,
	"rule_candidate_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"status" text DEFAULT 'candidate' NOT NULL,
	"requires_human_review" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "strategy_lesson_strategy_idx"
	ON "strategy_lesson" ("strategy_id");
CREATE INDEX IF NOT EXISTS "strategy_lesson_status_idx"
	ON "strategy_lesson" ("status");
CREATE INDEX IF NOT EXISTS "strategy_lesson_source_hypothesis_idx"
	ON "strategy_lesson" ("source_hypothesis_id");

CREATE TABLE IF NOT EXISTS "advisor_calibration_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"strategy_id" integer NOT NULL REFERENCES "investment_strategy_profile"("id") ON DELETE CASCADE,
	"generated_at" timestamp with time zone NOT NULL,
	"horizon" text NOT NULL,
	"sample_size" integer DEFAULT 0 NOT NULL,
	"hit_rate" double precision DEFAULT 0 NOT NULL,
	"brier_score" double precision,
	"average_confidence" double precision DEFAULT 0 NOT NULL,
	"calibration_buckets_json" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"by_bucket_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_account_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"by_asset_class_json" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "advisor_calibration_snapshot_strategy_idx"
	ON "advisor_calibration_snapshot" ("strategy_id");
CREATE INDEX IF NOT EXISTS "advisor_calibration_snapshot_generated_idx"
	ON "advisor_calibration_snapshot" ("generated_at");
CREATE INDEX IF NOT EXISTS "advisor_calibration_snapshot_horizon_idx"
	ON "advisor_calibration_snapshot" ("horizon");
