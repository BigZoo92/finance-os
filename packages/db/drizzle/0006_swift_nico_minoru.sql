CREATE TYPE "public"."asset_origin" AS ENUM('provider', 'manual');--> statement-breakpoint
CREATE TYPE "public"."asset_type" AS ENUM('cash', 'investment', 'manual');--> statement-breakpoint
CREATE TABLE "asset" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "asset_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"asset_type" "asset_type" NOT NULL,
	"origin" "asset_origin" NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"provider" text,
	"provider_connection_id" text,
	"provider_external_asset_id" text,
	"powens_connection_id" text,
	"powens_account_id" text,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"valuation" numeric(18, 2),
	"valuation_as_of" timestamp with time zone,
	"enabled" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "asset_provider_external_unique" ON "asset" USING btree ("provider","provider_connection_id","provider_external_asset_id");--> statement-breakpoint
CREATE INDEX "asset_type_idx" ON "asset" USING btree ("asset_type");--> statement-breakpoint
CREATE INDEX "asset_origin_idx" ON "asset" USING btree ("origin");--> statement-breakpoint
CREATE INDEX "asset_powens_connection_id_idx" ON "asset" USING btree ("powens_connection_id");--> statement-breakpoint
CREATE INDEX "asset_powens_account_id_idx" ON "asset" USING btree ("powens_account_id");--> statement-breakpoint
INSERT INTO "asset" (
	"asset_type",
	"origin",
	"source",
	"provider",
	"provider_connection_id",
	"provider_external_asset_id",
	"powens_connection_id",
	"powens_account_id",
	"name",
	"currency",
	"valuation",
	"valuation_as_of",
	"enabled",
	"raw",
	"created_at",
	"updated_at"
)
SELECT
	'cash'::"asset_type",
	'provider'::"asset_origin",
	'banking',
	'powens',
	ba."powens_connection_id",
	ba."powens_account_id",
	ba."powens_connection_id",
	ba."powens_account_id",
	ba."name",
	ba."currency",
	ba."balance",
	ba."updated_at",
	ba."enabled",
	ba."raw",
	ba."created_at",
	ba."updated_at"
FROM "bank_account" ba
ON CONFLICT ("provider","provider_connection_id","provider_external_asset_id") DO NOTHING;
