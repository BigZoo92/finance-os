CREATE TABLE "market_cache_state" (
	"singleton" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"last_request_id" text,
	"refresh_count" integer DEFAULT 0 NOT NULL,
	"provider_failure_count" integer DEFAULT 0 NOT NULL,
	"last_instrument_count" integer,
	"last_macro_observation_count" integer,
	"last_signal_count" integer,
	"last_refresh_duration_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_cache_state_singleton_pk" PRIMARY KEY("singleton")
);
--> statement-breakpoint
CREATE TABLE "market_context_bundle_snapshot" (
	"singleton" boolean DEFAULT true NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"schema_version" text NOT NULL,
	"bundle" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_context_bundle_snapshot_singleton_pk" PRIMARY KEY("singleton")
);
--> statement-breakpoint
CREATE TABLE "market_macro_observation" (
	"series_id" text NOT NULL,
	"observation_date" text NOT NULL,
	"source_provider" text DEFAULT 'fred' NOT NULL,
	"value" numeric(18, 6) NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "market_macro_observation_pk" PRIMARY KEY("series_id","observation_date")
);
--> statement-breakpoint
CREATE TABLE "market_provider_state" (
	"provider" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"last_request_id" text,
	"last_fetched_count" integer,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"last_duration_ms" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "market_quote_snapshot" (
	"instrument_id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"symbol" text NOT NULL,
	"provider_symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"region" text NOT NULL,
	"exchange" text NOT NULL,
	"currency" text NOT NULL,
	"source_provider" text NOT NULL,
	"baseline_provider" text NOT NULL,
	"overlay_provider" text,
	"source_mode" text NOT NULL,
	"source_delay_label" text NOT NULL,
	"source_reason" text NOT NULL,
	"quote_date" text NOT NULL,
	"quote_as_of" timestamp with time zone,
	"captured_at" timestamp with time zone NOT NULL,
	"market_state" text DEFAULT 'closed' NOT NULL,
	"market_open" boolean,
	"is_delayed" boolean DEFAULT true NOT NULL,
	"freshness_minutes" integer,
	"price" numeric(18, 6) NOT NULL,
	"previous_close" numeric(18, 6),
	"day_change_pct" numeric(12, 6),
	"week_change_pct" numeric(12, 6),
	"month_change_pct" numeric(12, 6),
	"ytd_change_pct" numeric(12, 6),
	"history" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "market_macro_observation_series_id_idx" ON "market_macro_observation" USING btree ("series_id");--> statement-breakpoint
CREATE INDEX "market_macro_observation_observation_date_idx" ON "market_macro_observation" USING btree ("observation_date");--> statement-breakpoint
CREATE INDEX "market_provider_state_last_attempt_at_idx" ON "market_provider_state" USING btree ("last_attempt_at");--> statement-breakpoint
CREATE INDEX "market_quote_snapshot_region_idx" ON "market_quote_snapshot" USING btree ("region");--> statement-breakpoint
CREATE INDEX "market_quote_snapshot_source_provider_idx" ON "market_quote_snapshot" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "market_quote_snapshot_quote_as_of_idx" ON "market_quote_snapshot" USING btree ("quote_as_of");