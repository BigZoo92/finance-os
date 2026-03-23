ALTER TABLE "powens_connection" ADD COLUMN "source" text DEFAULT 'banking' NOT NULL;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "provider" text DEFAULT 'powens' NOT NULL;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "provider_connection_id" text;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "provider_institution_id" text;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "provider_institution_name" text;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "last_sync_attempt_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "last_failed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "sync_metadata" jsonb;--> statement-breakpoint
UPDATE "powens_connection"
SET
  "provider_connection_id" = "powens_connection_id",
  "last_sync_attempt_at" = COALESCE("last_sync_at", "updated_at");--> statement-breakpoint
ALTER TABLE "powens_connection" ALTER COLUMN "provider_connection_id" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "powens_connection_provider_connection_unique" ON "powens_connection" USING btree ("provider","provider_connection_id");
