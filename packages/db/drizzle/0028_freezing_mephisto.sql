ALTER TABLE "powens_connection" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "archived_reason" text;--> statement-breakpoint
CREATE INDEX "powens_connection_active_idx" ON "powens_connection" USING btree ("archived_at");