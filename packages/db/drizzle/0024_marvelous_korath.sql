CREATE TABLE "signal_ingestion_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "signal_ingestion_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"run_type" text DEFAULT 'scheduled' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	"status" text DEFAULT 'running' NOT NULL,
	"fetched_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"deduped_count" integer DEFAULT 0 NOT NULL,
	"classified_count" integer DEFAULT 0 NOT NULL,
	"graph_ingested_count" integer DEFAULT 0 NOT NULL,
	"failed_count" integer DEFAULT 0 NOT NULL,
	"error_summary" text,
	"request_id" text,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "signal_source" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "signal_source_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"handle" text NOT NULL,
	"display_name" text NOT NULL,
	"url" text,
	"group" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 50 NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"include_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"exclude_patterns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"min_relevance_score" integer DEFAULT 0 NOT NULL,
	"requires_attention_policy" text DEFAULT 'auto' NOT NULL,
	"last_fetched_at" timestamp with time zone,
	"last_cursor" text,
	"last_error" text,
	"last_fetched_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "signal_ingestion_run_provider_idx" ON "signal_ingestion_run" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "signal_ingestion_run_started_at_idx" ON "signal_ingestion_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "signal_ingestion_run_status_idx" ON "signal_ingestion_run" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "signal_source_provider_handle_unique" ON "signal_source" USING btree ("provider","handle");--> statement-breakpoint
CREATE INDEX "signal_source_group_idx" ON "signal_source" USING btree ("group");--> statement-breakpoint
CREATE INDEX "signal_source_enabled_idx" ON "signal_source" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "signal_source_provider_idx" ON "signal_source" USING btree ("provider");