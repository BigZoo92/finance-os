CREATE TYPE "public"."personal_goal_type" AS ENUM('emergency_fund', 'travel', 'home', 'education', 'retirement', 'custom');--> statement-breakpoint
CREATE TABLE "personal_goal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "personal_goal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"goal_type" "personal_goal_type" DEFAULT 'custom' NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"target_amount" numeric(18, 2) NOT NULL,
	"current_amount" numeric(18, 2) DEFAULT '0' NOT NULL,
	"target_date" date,
	"note" text,
	"progress_snapshots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "personal_goal_archived_at_idx" ON "personal_goal" USING btree ("archived_at");--> statement-breakpoint
CREATE INDEX "personal_goal_goal_type_idx" ON "personal_goal" USING btree ("goal_type");--> statement-breakpoint
CREATE INDEX "personal_goal_target_date_idx" ON "personal_goal" USING btree ("target_date");
