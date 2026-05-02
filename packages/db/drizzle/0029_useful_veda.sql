CREATE TABLE "advisor_investment_context_bundle" (
	"singleton" boolean DEFAULT true NOT NULL,
	"schema_version" text NOT NULL,
	"generated_at" timestamp with time zone NOT NULL,
	"request_id" text,
	"bundle" jsonb NOT NULL,
	"stale_after_minutes" integer NOT NULL,
	"provider_coverage" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "advisor_investment_context_bundle_singleton_pk" PRIMARY KEY("singleton")
);
--> statement-breakpoint
CREATE TABLE "external_investment_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer NOT NULL,
	"provider_connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"account_type" text,
	"account_alias" text,
	"base_currency" text,
	"metadata" jsonb,
	"degraded_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"source_confidence" text DEFAULT 'unknown' NOT NULL,
	"raw_import_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_cash_flow" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_cash_flow_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer NOT NULL,
	"provider_connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"cash_flow_key" text NOT NULL,
	"provider_cash_flow_id" text NOT NULL,
	"type" text DEFAULT 'unknown' NOT NULL,
	"asset" text,
	"amount" numeric(30, 12),
	"currency" text,
	"fee_amount" numeric(24, 8),
	"fee_asset" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"metadata" jsonb,
	"source_confidence" text DEFAULT 'unknown' NOT NULL,
	"raw_import_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_connection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"provider_connection_id" text NOT NULL,
	"account_alias" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'configured' NOT NULL,
	"credential_status" text DEFAULT 'missing' NOT NULL,
	"masked_metadata" jsonb,
	"last_sync_status" text,
	"last_sync_reason_code" text,
	"last_sync_attempt_at" timestamp with time zone,
	"last_sync_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_failed_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"sync_metadata" jsonb,
	"archived_at" timestamp with time zone,
	"archived_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_credential" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_credential_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"connection_id" integer NOT NULL,
	"provider" text NOT NULL,
	"kind" text NOT NULL,
	"encrypted_payload" text NOT NULL,
	"masked_metadata" jsonb NOT NULL,
	"version" text DEFAULT 'v1' NOT NULL,
	"rotated_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_instrument" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_instrument_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer NOT NULL,
	"provider_connection_id" text NOT NULL,
	"instrument_key" text NOT NULL,
	"symbol" text,
	"name" text NOT NULL,
	"currency" text,
	"asset_class" text DEFAULT 'unknown' NOT NULL,
	"isin" text,
	"cusip" text,
	"conid" text,
	"binance_asset" text,
	"binance_symbol" text,
	"metadata" jsonb,
	"source_confidence" text DEFAULT 'unknown' NOT NULL,
	"raw_import_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_position" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_position_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer NOT NULL,
	"provider_connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"instrument_key" text NOT NULL,
	"position_key" text NOT NULL,
	"provider_position_id" text NOT NULL,
	"name" text NOT NULL,
	"symbol" text,
	"asset_class" text DEFAULT 'unknown' NOT NULL,
	"quantity" numeric(30, 12),
	"free_quantity" numeric(30, 12),
	"locked_quantity" numeric(30, 12),
	"currency" text,
	"provider_value" numeric(24, 6),
	"normalized_value" numeric(24, 6),
	"value_currency" text,
	"value_source" text DEFAULT 'unknown' NOT NULL,
	"value_as_of" timestamp with time zone,
	"cost_basis" numeric(24, 6),
	"cost_basis_currency" text,
	"realized_pnl" numeric(24, 6),
	"unrealized_pnl" numeric(24, 6),
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"degraded_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"source_confidence" text DEFAULT 'unknown' NOT NULL,
	"raw_import_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_provider_health" (
	"provider" text PRIMARY KEY NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"status" text DEFAULT 'idle' NOT NULL,
	"last_success_at" timestamp with time zone,
	"last_attempt_at" timestamp with time zone,
	"last_failure_at" timestamp with time zone,
	"last_error_code" text,
	"last_error_message" text,
	"last_request_id" text,
	"last_duration_ms" integer,
	"last_raw_import_count" integer,
	"last_normalized_row_count" integer,
	"success_count" integer DEFAULT 0 NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"skipped_count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_raw_import" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_raw_import_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer,
	"provider_connection_id" text NOT NULL,
	"account_external_id" text,
	"object_type" text NOT NULL,
	"external_object_id" text NOT NULL,
	"parent_external_object_id" text,
	"import_status" text DEFAULT 'metadata_only' NOT NULL,
	"provider_object_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"payload_digest" text NOT NULL,
	"payload_bytes" integer DEFAULT 0 NOT NULL,
	"payload_preview" jsonb,
	"raw_storage_policy" text DEFAULT 'metadata_digest_preview' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_sync_run" (
	"id" text PRIMARY KEY NOT NULL,
	"request_id" text,
	"provider" text NOT NULL,
	"connection_id" integer,
	"provider_connection_id" text,
	"trigger_source" text DEFAULT 'manual' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"duration_ms" integer,
	"error_code" text,
	"error_message" text,
	"row_counts" jsonb,
	"degraded_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_trade" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_trade_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer NOT NULL,
	"provider_connection_id" text NOT NULL,
	"account_external_id" text NOT NULL,
	"instrument_key" text NOT NULL,
	"trade_key" text NOT NULL,
	"provider_trade_id" text NOT NULL,
	"symbol" text,
	"side" text DEFAULT 'unknown' NOT NULL,
	"quantity" numeric(30, 12),
	"price" numeric(24, 8),
	"gross_amount" numeric(24, 6),
	"net_amount" numeric(24, 6),
	"currency" text,
	"fee_amount" numeric(24, 8),
	"fee_asset" text,
	"traded_at" timestamp with time zone NOT NULL,
	"metadata" jsonb,
	"source_confidence" text DEFAULT 'unknown' NOT NULL,
	"raw_import_id" integer,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "external_investment_valuation_snapshot" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "external_investment_valuation_snapshot_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"connection_id" integer,
	"provider_connection_id" text NOT NULL,
	"position_key" text NOT NULL,
	"value" numeric(24, 6),
	"currency" text,
	"source" text DEFAULT 'unknown' NOT NULL,
	"confidence" text DEFAULT 'unknown' NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"assumptions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"degraded_reasons" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "external_investment_account" ADD CONSTRAINT "external_investment_account_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_account" ADD CONSTRAINT "external_investment_account_raw_import_id_external_investment_raw_import_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."external_investment_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_cash_flow" ADD CONSTRAINT "external_investment_cash_flow_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_cash_flow" ADD CONSTRAINT "external_investment_cash_flow_raw_import_id_external_investment_raw_import_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."external_investment_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_credential" ADD CONSTRAINT "external_investment_credential_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_instrument" ADD CONSTRAINT "external_investment_instrument_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_instrument" ADD CONSTRAINT "external_investment_instrument_raw_import_id_external_investment_raw_import_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."external_investment_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_position" ADD CONSTRAINT "external_investment_position_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_position" ADD CONSTRAINT "external_investment_position_raw_import_id_external_investment_raw_import_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."external_investment_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_raw_import" ADD CONSTRAINT "external_investment_raw_import_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_sync_run" ADD CONSTRAINT "external_investment_sync_run_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_trade" ADD CONSTRAINT "external_investment_trade_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_trade" ADD CONSTRAINT "external_investment_trade_raw_import_id_external_investment_raw_import_id_fk" FOREIGN KEY ("raw_import_id") REFERENCES "public"."external_investment_raw_import"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "external_investment_valuation_snapshot" ADD CONSTRAINT "external_investment_valuation_snapshot_connection_id_external_investment_connection_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."external_investment_connection"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_account_external_unique" ON "external_investment_account" USING btree ("provider","provider_connection_id","account_external_id");--> statement-breakpoint
CREATE INDEX "external_investment_account_connection_idx" ON "external_investment_account" USING btree ("connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_cash_flow_key_unique" ON "external_investment_cash_flow" USING btree ("cash_flow_key");--> statement-breakpoint
CREATE INDEX "external_investment_cash_flow_connection_idx" ON "external_investment_cash_flow" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "external_investment_cash_flow_occurred_at_idx" ON "external_investment_cash_flow" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "external_investment_cash_flow_type_idx" ON "external_investment_cash_flow" USING btree ("type");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_connection_provider_unique" ON "external_investment_connection" USING btree ("provider","provider_connection_id");--> statement-breakpoint
CREATE INDEX "external_investment_connection_provider_idx" ON "external_investment_connection" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "external_investment_connection_status_idx" ON "external_investment_connection" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_investment_connection_last_sync_idx" ON "external_investment_connection" USING btree ("last_sync_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_credential_active_unique" ON "external_investment_credential" USING btree ("connection_id","provider","kind") WHERE "external_investment_credential"."deleted_at" is null;--> statement-breakpoint
CREATE INDEX "external_investment_credential_provider_idx" ON "external_investment_credential" USING btree ("provider");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_instrument_key_unique" ON "external_investment_instrument" USING btree ("provider","provider_connection_id","instrument_key");--> statement-breakpoint
CREATE INDEX "external_investment_instrument_symbol_idx" ON "external_investment_instrument" USING btree ("symbol");--> statement-breakpoint
CREATE INDEX "external_investment_instrument_asset_class_idx" ON "external_investment_instrument" USING btree ("asset_class");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_position_key_unique" ON "external_investment_position" USING btree ("position_key");--> statement-breakpoint
CREATE INDEX "external_investment_position_connection_idx" ON "external_investment_position" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "external_investment_position_asset_class_idx" ON "external_investment_position" USING btree ("asset_class");--> statement-breakpoint
CREATE INDEX "external_investment_position_value_as_of_idx" ON "external_investment_position" USING btree ("value_as_of");--> statement-breakpoint
CREATE INDEX "external_investment_provider_health_attempt_idx" ON "external_investment_provider_health" USING btree ("last_attempt_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_raw_import_object_unique" ON "external_investment_raw_import" USING btree ("provider","provider_connection_id","object_type","external_object_id");--> statement-breakpoint
CREATE INDEX "external_investment_raw_import_provider_idx" ON "external_investment_raw_import" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "external_investment_raw_import_last_seen_idx" ON "external_investment_raw_import" USING btree ("last_seen_at");--> statement-breakpoint
CREATE INDEX "external_investment_sync_run_provider_started_idx" ON "external_investment_sync_run" USING btree ("provider","started_at");--> statement-breakpoint
CREATE INDEX "external_investment_sync_run_status_idx" ON "external_investment_sync_run" USING btree ("status");--> statement-breakpoint
CREATE INDEX "external_investment_sync_run_request_id_idx" ON "external_investment_sync_run" USING btree ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_trade_key_unique" ON "external_investment_trade" USING btree ("trade_key");--> statement-breakpoint
CREATE INDEX "external_investment_trade_connection_idx" ON "external_investment_trade" USING btree ("connection_id");--> statement-breakpoint
CREATE INDEX "external_investment_trade_traded_at_idx" ON "external_investment_trade" USING btree ("traded_at");--> statement-breakpoint
CREATE UNIQUE INDEX "external_investment_valuation_snapshot_unique" ON "external_investment_valuation_snapshot" USING btree ("position_key","as_of","source");--> statement-breakpoint
CREATE INDEX "external_investment_valuation_snapshot_as_of_idx" ON "external_investment_valuation_snapshot" USING btree ("as_of");