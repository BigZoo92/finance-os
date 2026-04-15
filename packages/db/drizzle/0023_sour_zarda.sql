CREATE TYPE "public"."ai_manual_operation_status" AS ENUM('queued', 'running', 'completed', 'failed', 'degraded');--> statement-breakpoint
CREATE TYPE "public"."ai_manual_operation_step_status" AS ENUM('queued', 'running', 'completed', 'failed', 'degraded', 'skipped');--> statement-breakpoint
CREATE TABLE "ai_manual_operation" (
	"id" text PRIMARY KEY NOT NULL,
	"status" "ai_manual_operation_status" DEFAULT 'queued' NOT NULL,
	"mode" text DEFAULT 'admin' NOT NULL,
	"trigger_source" text DEFAULT 'manual' NOT NULL,
	"request_id" text NOT NULL,
	"current_stage" text,
	"status_message" text,
	"degraded" boolean DEFAULT false NOT NULL,
	"error_code" text,
	"error_message" text,
	"advisor_run_id" integer,
	"input_digest" jsonb,
	"output_digest" jsonb,
	"metadata" jsonb,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_manual_operation_step" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "ai_manual_operation_step_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"operation_id" text NOT NULL,
	"step_key" text NOT NULL,
	"label" text NOT NULL,
	"status" "ai_manual_operation_step_status" DEFAULT 'queued' NOT NULL,
	"started_at" timestamp with time zone,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_code" text,
	"error_message" text,
	"details" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_manual_operation" ADD CONSTRAINT "ai_manual_operation_advisor_run_id_ai_run_id_fk" FOREIGN KEY ("advisor_run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_manual_operation_step" ADD CONSTRAINT "ai_manual_operation_step_operation_id_ai_manual_operation_id_fk" FOREIGN KEY ("operation_id") REFERENCES "public"."ai_manual_operation"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "ai_manual_operation_request_id_unique" ON "ai_manual_operation" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "ai_manual_operation_status_started_at_idx" ON "ai_manual_operation" USING btree ("status","started_at");--> statement-breakpoint
CREATE INDEX "ai_manual_operation_trigger_source_idx" ON "ai_manual_operation" USING btree ("trigger_source");--> statement-breakpoint
CREATE INDEX "ai_manual_operation_advisor_run_id_idx" ON "ai_manual_operation" USING btree ("advisor_run_id");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_manual_operation_step_operation_key_unique" ON "ai_manual_operation_step" USING btree ("operation_id","step_key");--> statement-breakpoint
CREATE INDEX "ai_manual_operation_step_status_idx" ON "ai_manual_operation_step" USING btree ("status");--> statement-breakpoint
CREATE INDEX "ai_manual_operation_step_operation_id_idx" ON "ai_manual_operation_step" USING btree ("operation_id");