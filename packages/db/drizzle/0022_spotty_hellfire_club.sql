CREATE TYPE "public"."ai_chat_message_role" AS ENUM('user', 'assistant', 'system');--> statement-breakpoint
CREATE TYPE "public"."ai_recommendation_challenge_status" AS ENUM('confirmed', 'softened', 'flagged', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."ai_recommendation_effort" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ai_recommendation_reversibility" AS ENUM('high', 'medium', 'low');--> statement-breakpoint
CREATE TYPE "public"."ai_recommendation_risk_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ai_run_status" AS ENUM('queued', 'running', 'completed', 'failed', 'degraded', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."ai_run_type" AS ENUM('daily', 'chat', 'relabel', 'eval');--> statement-breakpoint
CREATE TYPE "public"."ai_step_status" AS ENUM('queued', 'running', 'completed', 'failed', 'skipped');--> statement-breakpoint
CREATE TABLE "ai_assumption_log" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_assumption_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"snapshot_id" integer,
	"assumption_key" text NOT NULL,
	"source" text NOT NULL,
	"value" jsonb NOT NULL,
	"justification" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_message" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_message_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"thread_id" integer NOT NULL,
	"run_id" integer,
	"role" "ai_chat_message_role" NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"caveats" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"simulations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_chat_thread" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_chat_thread_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"thread_key" text NOT NULL,
	"title" text DEFAULT 'Finance Assistant' NOT NULL,
	"mode" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_cost_ledger" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_cost_ledger_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer,
	"model_usage_id" integer,
	"ledger_date" date NOT NULL,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"feature" text NOT NULL,
	"amount_usd" numeric(18, 6) NOT NULL,
	"amount_eur" numeric(18, 6) NOT NULL,
	"pricing_version" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_daily_brief" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_daily_brief_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"snapshot_id" integer,
	"title" text NOT NULL,
	"summary" text NOT NULL,
	"key_facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"opportunities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"risks" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"watch_items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"recommendation_notes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"prompt_template_key" text,
	"prompt_template_version" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_eval_case" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_eval_case_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"case_key" text NOT NULL,
	"category" text NOT NULL,
	"description" text NOT NULL,
	"input" jsonb NOT NULL,
	"expectation" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_eval_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_eval_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer,
	"status" "ai_run_status" DEFAULT 'completed' NOT NULL,
	"total_cases" integer DEFAULT 0 NOT NULL,
	"passed_cases" integer DEFAULT 0 NOT NULL,
	"failed_cases" integer DEFAULT 0 NOT NULL,
	"summary" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_macro_signal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_macro_signal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"signal_key" text NOT NULL,
	"title" text NOT NULL,
	"direction" text NOT NULL,
	"severity" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"facts" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"hypotheses" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"implications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_refs" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_model_usage" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_model_usage_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer,
	"run_step_id" integer,
	"provider" text NOT NULL,
	"model" text NOT NULL,
	"endpoint_type" text NOT NULL,
	"feature" text NOT NULL,
	"status" "ai_step_status" DEFAULT 'completed' NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cached_input_tokens" integer DEFAULT 0 NOT NULL,
	"cache_write_tokens" integer DEFAULT 0 NOT NULL,
	"cache_duration" text,
	"batch" boolean DEFAULT false NOT NULL,
	"latency_ms" integer DEFAULT 0 NOT NULL,
	"request_id" text,
	"response_id" text,
	"pricing_version" text NOT NULL,
	"estimated_cost_usd" numeric(18, 6) NOT NULL,
	"estimated_cost_eur" numeric(18, 6) NOT NULL,
	"usd_to_eur_rate" numeric(12, 6) NOT NULL,
	"raw_usage" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_news_signal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_news_signal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"news_article_id" integer,
	"signal_key" text NOT NULL,
	"title" text NOT NULL,
	"event_type" text NOT NULL,
	"direction" text NOT NULL,
	"severity" integer DEFAULT 0 NOT NULL,
	"confidence" integer DEFAULT 0 NOT NULL,
	"published_at" timestamp with time zone,
	"supporting_urls" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"affected_sectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"why_it_matters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_portfolio_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_portfolio_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"as_of_date" date NOT NULL,
	"range" text NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"risk_profile" text NOT NULL,
	"metrics" jsonb NOT NULL,
	"allocation_buckets" jsonb NOT NULL,
	"asset_class_allocations" jsonb NOT NULL,
	"drift_signals" jsonb NOT NULL,
	"scenarios" jsonb NOT NULL,
	"diagnostics" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_template" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_prompt_template_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"template_key" text NOT NULL,
	"version" text NOT NULL,
	"description" text,
	"schema_name" text NOT NULL,
	"system_prompt" text NOT NULL,
	"user_prompt_template" text NOT NULL,
	"schema" jsonb NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendation" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_recommendation_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"snapshot_id" integer,
	"recommendation_key" text NOT NULL,
	"type" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"why_now" text NOT NULL,
	"evidence" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(6, 4) NOT NULL,
	"risk_level" "ai_recommendation_risk_level" NOT NULL,
	"expected_impact" jsonb NOT NULL,
	"effort" "ai_recommendation_effort" NOT NULL,
	"reversibility" "ai_recommendation_reversibility" NOT NULL,
	"blocking_factors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"alternatives" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"deterministic_metrics_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"llm_models_used" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"challenger_status" "ai_recommendation_challenge_status" DEFAULT 'skipped' NOT NULL,
	"priority_score" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_recommendation_challenge" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_recommendation_challenge_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recommendation_id" integer NOT NULL,
	"run_id" integer NOT NULL,
	"status" "ai_recommendation_challenge_status" NOT NULL,
	"summary" text NOT NULL,
	"contradictions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_signals" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence_adjustment" numeric(6, 4) NOT NULL,
	"provider" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_type" "ai_run_type" NOT NULL,
	"status" "ai_run_status" DEFAULT 'queued' NOT NULL,
	"mode" text DEFAULT 'admin' NOT NULL,
	"trigger_source" text DEFAULT 'manual' NOT NULL,
	"request_id" text NOT NULL,
	"request_correlation_id" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"degraded" boolean DEFAULT false NOT NULL,
	"fallback_reason" text,
	"error_code" text,
	"error_message" text,
	"input_digest" jsonb,
	"output_digest" jsonb,
	"budget_state" jsonb,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_run_step" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_run_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"step_key" text NOT NULL,
	"status" "ai_step_status" DEFAULT 'queued' NOT NULL,
	"provider" text,
	"model" text,
	"prompt_template_key" text,
	"prompt_template_version" text,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"latency_ms" integer,
	"error_code" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_transaction_label_suggestion" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_transaction_label_suggestion_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"transaction_id" integer,
	"suggestion_key" text NOT NULL,
	"status" text DEFAULT 'suggested' NOT NULL,
	"suggestion_source" text DEFAULT 'deterministic' NOT NULL,
	"suggested_kind" text NOT NULL,
	"suggested_category" text NOT NULL,
	"suggested_subcategory" text,
	"suggested_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"confidence" numeric(6, 4) NOT NULL,
	"rationale" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"provider" text,
	"model" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "ai_assumption_log" ADD CONSTRAINT "ai_assumption_log_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_assumption_log" ADD CONSTRAINT "ai_assumption_log_snapshot_id_ai_portfolio_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_portfolio_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_thread_id_ai_chat_thread_id_fk" FOREIGN KEY ("thread_id") REFERENCES "public"."ai_chat_thread"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_chat_message" ADD CONSTRAINT "ai_chat_message_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cost_ledger" ADD CONSTRAINT "ai_cost_ledger_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_cost_ledger" ADD CONSTRAINT "ai_cost_ledger_model_usage_id_ai_model_usage_id_fk" FOREIGN KEY ("model_usage_id") REFERENCES "public"."ai_model_usage"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_daily_brief" ADD CONSTRAINT "ai_daily_brief_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_daily_brief" ADD CONSTRAINT "ai_daily_brief_snapshot_id_ai_portfolio_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_portfolio_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_eval_run" ADD CONSTRAINT "ai_eval_run_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_macro_signal" ADD CONSTRAINT "ai_macro_signal_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_model_usage" ADD CONSTRAINT "ai_model_usage_run_step_id_ai_run_step_id_fk" FOREIGN KEY ("run_step_id") REFERENCES "public"."ai_run_step"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_news_signal" ADD CONSTRAINT "ai_news_signal_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_news_signal" ADD CONSTRAINT "ai_news_signal_news_article_id_news_article_id_fk" FOREIGN KEY ("news_article_id") REFERENCES "public"."news_article"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_portfolio_snapshot" ADD CONSTRAINT "ai_portfolio_snapshot_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation" ADD CONSTRAINT "ai_recommendation_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation" ADD CONSTRAINT "ai_recommendation_snapshot_id_ai_portfolio_snapshot_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."ai_portfolio_snapshot"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation_challenge" ADD CONSTRAINT "ai_recommendation_challenge_recommendation_id_ai_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ai_recommendation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_recommendation_challenge" ADD CONSTRAINT "ai_recommendation_challenge_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_run_step" ADD CONSTRAINT "ai_run_step_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_transaction_label_suggestion" ADD CONSTRAINT "ai_transaction_label_suggestion_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_transaction_label_suggestion" ADD CONSTRAINT "ai_transaction_label_suggestion_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_assumption_log_run_id_idx" ON "ai_assumption_log" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_assumption_log_assumption_key_idx" ON "ai_assumption_log" USING btree ("assumption_key");--> statement-breakpoint
CREATE INDEX "ai_chat_message_thread_id_idx" ON "ai_chat_message" USING btree ("thread_id");--> statement-breakpoint
CREATE INDEX "ai_chat_message_created_at_idx" ON "ai_chat_message" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_chat_thread_key_unique" ON "ai_chat_thread" USING btree ("thread_key");--> statement-breakpoint
CREATE INDEX "ai_chat_thread_updated_at_idx" ON "ai_chat_thread" USING btree ("updated_at");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_ledger_date_idx" ON "ai_cost_ledger" USING btree ("ledger_date");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_feature_idx" ON "ai_cost_ledger" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_cost_ledger_provider_model_idx" ON "ai_cost_ledger" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "ai_daily_brief_run_id_idx" ON "ai_daily_brief" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_daily_brief_created_at_idx" ON "ai_daily_brief" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_eval_case_key_unique" ON "ai_eval_case" USING btree ("case_key");--> statement-breakpoint
CREATE INDEX "ai_eval_case_category_idx" ON "ai_eval_case" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_eval_run_run_id_idx" ON "ai_eval_run" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_eval_run_created_at_idx" ON "ai_eval_run" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_macro_signal_run_key_unique" ON "ai_macro_signal" USING btree ("run_id","signal_key");--> statement-breakpoint
CREATE INDEX "ai_macro_signal_direction_idx" ON "ai_macro_signal" USING btree ("direction");--> statement-breakpoint
CREATE INDEX "ai_model_usage_run_id_idx" ON "ai_model_usage" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_model_usage_feature_idx" ON "ai_model_usage" USING btree ("feature");--> statement-breakpoint
CREATE INDEX "ai_model_usage_provider_model_idx" ON "ai_model_usage" USING btree ("provider","model");--> statement-breakpoint
CREATE INDEX "ai_model_usage_created_at_idx" ON "ai_model_usage" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_news_signal_run_key_unique" ON "ai_news_signal" USING btree ("run_id","signal_key");--> statement-breakpoint
CREATE INDEX "ai_news_signal_news_article_id_idx" ON "ai_news_signal" USING btree ("news_article_id");--> statement-breakpoint
CREATE INDEX "ai_news_signal_published_at_idx" ON "ai_news_signal" USING btree ("published_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_portfolio_snapshot_run_id_unique" ON "ai_portfolio_snapshot" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "ai_portfolio_snapshot_as_of_date_idx" ON "ai_portfolio_snapshot" USING btree ("as_of_date");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_prompt_template_key_version_unique" ON "ai_prompt_template" USING btree ("template_key","version");--> statement-breakpoint
CREATE INDEX "ai_prompt_template_active_idx" ON "ai_prompt_template" USING btree ("active");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_recommendation_run_key_unique" ON "ai_recommendation" USING btree ("run_id","recommendation_key");--> statement-breakpoint
CREATE INDEX "ai_recommendation_category_idx" ON "ai_recommendation" USING btree ("category");--> statement-breakpoint
CREATE INDEX "ai_recommendation_priority_idx" ON "ai_recommendation" USING btree ("priority_score");--> statement-breakpoint
CREATE INDEX "ai_recommendation_created_at_idx" ON "ai_recommendation" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_recommendation_challenge_recommendation_unique" ON "ai_recommendation_challenge" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "ai_recommendation_challenge_status_idx" ON "ai_recommendation_challenge" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_request_id_unique" ON "ai_run" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_run_type_started_at_idx" ON "ai_run" USING btree ("run_type","started_at");--> statement-breakpoint
CREATE INDEX "ai_run_status_started_at_idx" ON "ai_run" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "ai_run_trigger_source_idx" ON "ai_run" USING btree ("trigger_source");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_run_step_run_key_unique" ON "ai_run_step" USING btree ("run_id","step_key");--> statement-breakpoint
CREATE INDEX "ai_run_step_status_idx" ON "ai_run_step" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_run_step_provider_model_idx" ON "ai_run_step" USING btree ("provider","model");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_transaction_label_suggestion_run_key_unique" ON "ai_transaction_label_suggestion" USING btree ("run_id","suggestion_key");--> statement-breakpoint
CREATE INDEX "ai_transaction_label_suggestion_transaction_id_idx" ON "ai_transaction_label_suggestion" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "ai_transaction_label_suggestion_status_idx" ON "ai_transaction_label_suggestion" USING btree ("status");