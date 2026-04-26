CREATE TABLE "signal_item" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "signal_item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"source_provider" text NOT NULL,
	"source_type" text DEFAULT 'social' NOT NULL,
	"source_account_id" integer,
	"external_id" text NOT NULL,
	"url" text,
	"title" text NOT NULL,
	"body" text,
	"author" text,
	"published_at" timestamp with time zone NOT NULL,
	"fetched_at" timestamp with time zone NOT NULL,
	"language" text DEFAULT 'en' NOT NULL,
	"entities" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tickers" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sectors" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"regions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"topics" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"signal_domain" text DEFAULT 'unknown' NOT NULL,
	"relevance_score" integer DEFAULT 0 NOT NULL,
	"novelty_score" integer DEFAULT 0 NOT NULL,
	"confidence_score" integer DEFAULT 0 NOT NULL,
	"impact_score" integer DEFAULT 0 NOT NULL,
	"urgency_score" integer DEFAULT 0 NOT NULL,
	"requires_attention" boolean DEFAULT false NOT NULL,
	"attention_reason" text,
	"sentiment" double precision,
	"dedupe_key" text NOT NULL,
	"content_hash" text NOT NULL,
	"provenance" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"raw_payload_redacted" jsonb,
	"graph_ingest_status" text DEFAULT 'pending' NOT NULL,
	"advisor_ingest_status" text DEFAULT 'pending' NOT NULL,
	"scope" text DEFAULT 'admin' NOT NULL,
	"ingestion_run_id" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "signal_item_dedupe_key_unique" ON "signal_item" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "signal_item_published_at_idx" ON "signal_item" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "signal_item_signal_domain_idx" ON "signal_item" USING btree ("signal_domain");--> statement-breakpoint
CREATE INDEX "signal_item_source_provider_idx" ON "signal_item" USING btree ("source_provider");--> statement-breakpoint
CREATE INDEX "signal_item_requires_attention_idx" ON "signal_item" USING btree ("requires_attention");--> statement-breakpoint
CREATE INDEX "signal_item_content_hash_idx" ON "signal_item" USING btree ("content_hash");--> statement-breakpoint
CREATE INDEX "signal_item_graph_ingest_status_idx" ON "signal_item" USING btree ("graph_ingest_status");--> statement-breakpoint
CREATE INDEX "signal_item_ingestion_run_id_idx" ON "signal_item" USING btree ("ingestion_run_id");