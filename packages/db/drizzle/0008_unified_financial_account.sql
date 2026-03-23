ALTER TABLE "bank_account" RENAME TO "financial_account";--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN "source" text DEFAULT 'banking' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN "provider" text DEFAULT 'powens' NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN "provider_connection_id" text;--> statement-breakpoint
ALTER TABLE "financial_account" ADD COLUMN "provider_account_id" text;--> statement-breakpoint
UPDATE "financial_account" fa
SET
  "source" = COALESCE(pc."source", 'banking'),
  "provider" = COALESCE(pc."provider", 'powens'),
  "provider_connection_id" = COALESCE(pc."provider_connection_id", fa."powens_connection_id"),
  "provider_account_id" = fa."powens_account_id"
FROM "powens_connection" pc
WHERE pc."powens_connection_id" = fa."powens_connection_id";--> statement-breakpoint
UPDATE "financial_account"
SET
  "provider_connection_id" = COALESCE("provider_connection_id", "powens_connection_id"),
  "provider_account_id" = COALESCE("provider_account_id", "powens_account_id")
WHERE "provider_connection_id" IS NULL OR "provider_account_id" IS NULL;--> statement-breakpoint
ALTER TABLE "financial_account" ALTER COLUMN "provider_connection_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "financial_account" ALTER COLUMN "provider_account_id" SET NOT NULL;--> statement-breakpoint
ALTER SEQUENCE "bank_account_id_seq" RENAME TO "financial_account_id_seq";--> statement-breakpoint
ALTER INDEX "bank_account_powens_account_id_unique" RENAME TO "financial_account_powens_account_id_unique";--> statement-breakpoint
ALTER INDEX "bank_account_powens_connection_id_idx" RENAME TO "financial_account_powens_connection_id_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "financial_account_provider_account_unique" ON "financial_account" USING btree ("provider","provider_connection_id","provider_account_id");--> statement-breakpoint
CREATE INDEX "financial_account_provider_connection_id_idx" ON "financial_account" USING btree ("provider","provider_connection_id");
