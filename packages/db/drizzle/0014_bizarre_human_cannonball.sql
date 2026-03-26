CREATE TYPE "public"."derived_recompute_run_status" AS ENUM('running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."derived_recompute_trigger_source" AS ENUM('admin', 'internal');--> statement-breakpoint
CREATE TABLE "derived_recompute_run" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "derived_recompute_run_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"snapshot_version" text NOT NULL,
	"status" "derived_recompute_run_status" DEFAULT 'running' NOT NULL,
	"trigger_source" "derived_recompute_trigger_source" NOT NULL,
	"request_id" text NOT NULL,
	"stage" text,
	"row_counts" jsonb,
	"safe_error_code" text,
	"safe_error_message" text,
	"is_current_snapshot" boolean DEFAULT false NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer
);
--> statement-breakpoint
CREATE TABLE "derived_transaction_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "derived_transaction_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"provider_raw_import_id" integer,
	"label" text NOT NULL,
	"label_hash" text NOT NULL,
	"category" text,
	"merchant" text,
	"provider_object_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "derived_transaction_snapshot" ADD CONSTRAINT "derived_transaction_snapshot_run_id_derived_recompute_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."derived_recompute_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_transaction_snapshot" ADD CONSTRAINT "derived_transaction_snapshot_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "derived_transaction_snapshot" ADD CONSTRAINT "derived_transaction_snapshot_provider_raw_import_id_provider_raw_import_id_fk" FOREIGN KEY ("provider_raw_import_id") REFERENCES "public"."provider_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "derived_recompute_run_snapshot_version_unique" ON "derived_recompute_run" USING btree ("snapshot_version");--> statement-breakpoint
CREATE INDEX "derived_recompute_run_status_idx" ON "derived_recompute_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "derived_recompute_run_started_at_idx" ON "derived_recompute_run" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "derived_recompute_run_current_snapshot_idx" ON "derived_recompute_run" USING btree ("is_current_snapshot");--> statement-breakpoint
CREATE UNIQUE INDEX "derived_transaction_snapshot_run_transaction_unique" ON "derived_transaction_snapshot" USING btree ("run_id","transaction_id");--> statement-breakpoint
CREATE INDEX "derived_transaction_snapshot_transaction_idx" ON "derived_transaction_snapshot" USING btree ("transaction_id");--> statement-breakpoint
CREATE INDEX "derived_transaction_snapshot_provider_raw_import_idx" ON "derived_transaction_snapshot" USING btree ("provider_raw_import_id");
