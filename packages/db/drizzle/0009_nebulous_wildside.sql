CREATE TYPE "public"."investment_position_cost_basis_source" AS ENUM('minimal', 'provider', 'manual', 'unknown');--> statement-breakpoint
CREATE TABLE "investment_position" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "investment_position_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"position_key" text NOT NULL,
	"asset_id" integer,
	"powens_account_id" text,
	"powens_connection_id" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"provider" text,
	"provider_connection_id" text,
	"provider_position_id" text,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"quantity" numeric(24, 8),
	"cost_basis" numeric(18, 2),
	"cost_basis_source" "investment_position_cost_basis_source" DEFAULT 'unknown' NOT NULL,
	"current_value" numeric(18, 2),
	"last_known_value" numeric(18, 2),
	"opened_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"valued_at" timestamp with time zone,
	"last_synced_at" timestamp with time zone,
	"metadata" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "investment_position" ADD CONSTRAINT "investment_position_asset_id_asset_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."asset"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "investment_position_key_unique" ON "investment_position" USING btree ("position_key");--> statement-breakpoint
CREATE INDEX "investment_position_asset_id_idx" ON "investment_position" USING btree ("asset_id");--> statement-breakpoint
CREATE INDEX "investment_position_powens_account_id_idx" ON "investment_position" USING btree ("powens_account_id");--> statement-breakpoint
CREATE INDEX "investment_position_powens_connection_id_idx" ON "investment_position" USING btree ("powens_connection_id");--> statement-breakpoint
CREATE INDEX "investment_position_provider_position_idx" ON "investment_position" USING btree ("provider","provider_connection_id","provider_position_id");--> statement-breakpoint
CREATE INDEX "investment_position_valued_at_idx" ON "investment_position" USING btree ("valued_at");