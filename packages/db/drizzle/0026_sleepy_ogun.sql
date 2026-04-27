CREATE TABLE "attention_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "attention_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_type" text NOT NULL,
	"source_id" text,
	"severity" text DEFAULT 'info' NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"summary" text,
	"reason" text,
	"action_href" text,
	"dedupe_key" text NOT NULL,
	"scope" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "trading_lab_backtest_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trading_lab_backtest_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"strategy_id" integer NOT NULL,
	"name" text NOT NULL,
	"market_data_source" text DEFAULT 'eodhd' NOT NULL,
	"symbol" text NOT NULL,
	"timeframe" text DEFAULT '1d' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone NOT NULL,
	"initial_cash" double precision DEFAULT 10000 NOT NULL,
	"fees_bps" double precision DEFAULT 10 NOT NULL,
	"slippage_bps" double precision DEFAULT 5 NOT NULL,
	"spread_bps" double precision DEFAULT 2 NOT NULL,
	"run_status" text DEFAULT 'pending' NOT NULL,
	"run_started_at" timestamp with time zone,
	"run_finished_at" timestamp with time zone,
	"duration_ms" integer,
	"params_hash" text,
	"data_hash" text,
	"result_summary" jsonb,
	"metrics" jsonb,
	"equity_curve" jsonb,
	"trades" jsonb,
	"drawdowns" jsonb,
	"error_summary" text,
	"scope" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_lab_paper_scenario" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trading_lab_paper_scenario_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"description" text,
	"linked_signal_item_id" integer,
	"linked_news_article_id" integer,
	"linked_strategy_id" integer,
	"status" text DEFAULT 'open' NOT NULL,
	"thesis" text,
	"expected_outcome" text,
	"invalidation_criteria" text,
	"risk_notes" text,
	"scope" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_lab_signal_link" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trading_lab_signal_link_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"signal_item_id" integer NOT NULL,
	"strategy_id" integer NOT NULL,
	"backtest_run_id" integer,
	"relation_type" text DEFAULT 'observation' NOT NULL,
	"confidence" double precision DEFAULT 0.5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trading_lab_strategy" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trading_lab_strategy_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"strategy_type" text DEFAULT 'experimental' NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"parameters" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"indicators" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"entry_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exit_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risk_rules" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"caveats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"scope" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "trading_lab_backtest_run" ADD CONSTRAINT "trading_lab_backtest_run_strategy_id_trading_lab_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_lab_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_lab_paper_scenario" ADD CONSTRAINT "trading_lab_paper_scenario_linked_strategy_id_trading_lab_strategy_id_fk" FOREIGN KEY ("linked_strategy_id") REFERENCES "public"."trading_lab_strategy"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_lab_signal_link" ADD CONSTRAINT "trading_lab_signal_link_strategy_id_trading_lab_strategy_id_fk" FOREIGN KEY ("strategy_id") REFERENCES "public"."trading_lab_strategy"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_lab_signal_link" ADD CONSTRAINT "trading_lab_signal_link_backtest_run_id_trading_lab_backtest_run_id_fk" FOREIGN KEY ("backtest_run_id") REFERENCES "public"."trading_lab_backtest_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "attention_item_dedupe_key_unique" ON "attention_item" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "attention_item_source_type_idx" ON "attention_item" USING btree ("source_type");--> statement-breakpoint
CREATE INDEX "attention_item_severity_idx" ON "attention_item" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "attention_item_status_idx" ON "attention_item" USING btree ("status");--> statement-breakpoint
CREATE INDEX "attention_item_created_at_idx" ON "attention_item" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "attention_item_expires_at_idx" ON "attention_item" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "trading_lab_backtest_run_strategy_id_idx" ON "trading_lab_backtest_run" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "trading_lab_backtest_run_symbol_idx" ON "trading_lab_backtest_run" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "trading_lab_backtest_run_status_idx" ON "trading_lab_backtest_run" USING btree ("run_status");--> statement-breakpoint
CREATE INDEX "trading_lab_backtest_run_created_at_idx" ON "trading_lab_backtest_run" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "trading_lab_paper_scenario_status_idx" ON "trading_lab_paper_scenario" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trading_lab_paper_scenario_strategy_idx" ON "trading_lab_paper_scenario" USING btree ("linked_strategy_id");--> statement-breakpoint
CREATE INDEX "trading_lab_paper_scenario_signal_idx" ON "trading_lab_paper_scenario" USING btree ("linked_signal_item_id");--> statement-breakpoint
CREATE INDEX "trading_lab_paper_scenario_news_idx" ON "trading_lab_paper_scenario" USING btree ("linked_news_article_id");--> statement-breakpoint
CREATE INDEX "trading_lab_signal_link_signal_idx" ON "trading_lab_signal_link" USING btree ("signal_item_id");--> statement-breakpoint
CREATE INDEX "trading_lab_signal_link_strategy_idx" ON "trading_lab_signal_link" USING btree ("strategy_id");--> statement-breakpoint
CREATE INDEX "trading_lab_signal_link_backtest_idx" ON "trading_lab_signal_link" USING btree ("backtest_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "trading_lab_strategy_slug_unique" ON "trading_lab_strategy" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "trading_lab_strategy_status_idx" ON "trading_lab_strategy" USING btree ("status");--> statement-breakpoint
CREATE INDEX "trading_lab_strategy_type_idx" ON "trading_lab_strategy" USING btree ("strategy_type");--> statement-breakpoint
CREATE INDEX "trading_lab_strategy_enabled_idx" ON "trading_lab_strategy" USING btree ("enabled");