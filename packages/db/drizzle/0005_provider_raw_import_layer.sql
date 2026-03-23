CREATE TYPE "public"."provider_raw_import_status" AS ENUM('imported', 'normalized', 'failed');--> statement-breakpoint
ALTER TABLE "bank_account" ADD COLUMN "balance" numeric(18, 2);--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "category" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "merchant" text;--> statement-breakpoint
CREATE TABLE "provider_raw_import" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "provider_raw_import_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE),
	"source" text NOT NULL,
	"provider" text NOT NULL,
	"provider_connection_id" text NOT NULL,
	"object_type" text NOT NULL,
	"external_object_id" text NOT NULL,
	"parent_external_object_id" text,
	"import_status" "provider_raw_import_status" DEFAULT 'imported' NOT NULL,
	"provider_object_at" timestamp with time zone,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"request_id" text,
	"payload" jsonb NOT NULL,
	"payload_checksum" text NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX "provider_raw_import_provider_object_unique" ON "provider_raw_import" USING btree ("provider","provider_connection_id","object_type","external_object_id");--> statement-breakpoint
CREATE INDEX "provider_raw_import_provider_connection_idx" ON "provider_raw_import" USING btree ("provider","provider_connection_id");--> statement-breakpoint
CREATE INDEX "provider_raw_import_object_type_idx" ON "provider_raw_import" USING btree ("object_type");--> statement-breakpoint
CREATE INDEX "provider_raw_import_last_seen_at_idx" ON "provider_raw_import" USING btree ("last_seen_at");--> statement-breakpoint
UPDATE "bank_account"
SET "balance" = COALESCE(
  CASE
    WHEN COALESCE("raw" ->> 'balance', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" ->> 'balance')::numeric
  END,
  CASE
    WHEN COALESCE("raw" #>> '{balance,value}', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" #>> '{balance,value}')::numeric
  END,
  CASE
    WHEN COALESCE("raw" ->> 'current_balance', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" ->> 'current_balance')::numeric
  END,
  CASE
    WHEN COALESCE("raw" #>> '{current_balance,value}', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" #>> '{current_balance,value}')::numeric
  END,
  CASE
    WHEN COALESCE("raw" ->> 'available_balance', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" ->> 'available_balance')::numeric
  END,
  CASE
    WHEN COALESCE("raw" #>> '{available_balance,value}', '') ~ '^-?[0-9]+(\\.[0-9]+)?$' THEN ("raw" #>> '{available_balance,value}')::numeric
  END
)
WHERE "raw" IS NOT NULL;--> statement-breakpoint
UPDATE "transaction"
SET
  "category" = COALESCE(NULLIF("raw" ->> 'category', ''), NULLIF("raw" ->> 'category_name', ''), 'Unknown'),
  "merchant" = COALESCE(NULLIF("raw" ->> 'original_wording', ''), NULLIF("raw" ->> 'wording', ''), "label")
WHERE "raw" IS NOT NULL;--> statement-breakpoint
INSERT INTO "provider_raw_import" (
  "source",
  "provider",
  "provider_connection_id",
  "object_type",
  "external_object_id",
  "parent_external_object_id",
  "import_status",
  "provider_object_at",
  "imported_at",
  "last_seen_at",
  "payload",
  "payload_checksum"
)
SELECT
  COALESCE(pc."source", 'banking') AS "source",
  COALESCE(pc."provider", 'powens') AS "provider",
  COALESCE(pc."provider_connection_id", ba."powens_connection_id") AS "provider_connection_id",
  'account' AS "object_type",
  ba."powens_account_id" AS "external_object_id",
  NULL AS "parent_external_object_id",
  'normalized'::"provider_raw_import_status" AS "import_status",
  NULL AS "provider_object_at",
  ba."created_at" AS "imported_at",
  ba."updated_at" AS "last_seen_at",
  ba."raw" AS "payload",
  md5(ba."raw"::text) AS "payload_checksum"
FROM "bank_account" ba
LEFT JOIN "powens_connection" pc ON pc."powens_connection_id" = ba."powens_connection_id"
WHERE ba."raw" IS NOT NULL;--> statement-breakpoint
INSERT INTO "provider_raw_import" (
  "source",
  "provider",
  "provider_connection_id",
  "object_type",
  "external_object_id",
  "parent_external_object_id",
  "import_status",
  "provider_object_at",
  "imported_at",
  "last_seen_at",
  "payload",
  "payload_checksum"
)
SELECT
  COALESCE(pc."source", 'banking') AS "source",
  COALESCE(pc."provider", 'powens') AS "provider",
  COALESCE(pc."provider_connection_id", t."powens_connection_id") AS "provider_connection_id",
  'transaction' AS "object_type",
  COALESCE(
    t."powens_transaction_id",
    CONCAT(t."powens_account_id", ':', t."booking_date", ':', t."amount", ':', t."label_hash")
  ) AS "external_object_id",
  t."powens_account_id" AS "parent_external_object_id",
  'normalized'::"provider_raw_import_status" AS "import_status",
  (t."booking_date"::timestamp AT TIME ZONE 'UTC') AS "provider_object_at",
  t."created_at" AS "imported_at",
  t."created_at" AS "last_seen_at",
  t."raw" AS "payload",
  md5(t."raw"::text) AS "payload_checksum"
FROM "transaction" t
LEFT JOIN "powens_connection" pc ON pc."powens_connection_id" = t."powens_connection_id"
WHERE t."raw" IS NOT NULL;--> statement-breakpoint
