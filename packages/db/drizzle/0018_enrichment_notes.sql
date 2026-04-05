CREATE TYPE "public"."enrichment_triage_status" AS ENUM('pending', 'accepted', 'rejected', 'needs_review');--> statement-breakpoint
CREATE TABLE "enrichment_note" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "enrichment_note_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"item_key" text NOT NULL,
	"note" text,
	"triage_status" "enrichment_triage_status" DEFAULT 'pending' NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "enrichment_note_item_key_unique" ON "enrichment_note" USING btree ("item_key");--> statement-breakpoint
CREATE INDEX "enrichment_note_status_idx" ON "enrichment_note" USING btree ("triage_status");--> statement-breakpoint
CREATE INDEX "enrichment_note_updated_at_idx" ON "enrichment_note" USING btree ("updated_at");
