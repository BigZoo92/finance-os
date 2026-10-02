-- DATA-01: an unknown valuation is stored as NULL, never as 0.
-- Snapshot rows whose value could not be established keep their status and
-- error code and carry NULL value/price instead of being dropped from the run.
ALTER TABLE "asset_valuation_snapshot" ALTER COLUMN "value_base" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "asset_valuation_snapshot" ALTER COLUMN "price" DROP NOT NULL;--> statement-breakpoint
-- REMOVE-01: retire the legacy credential store. Provider credentials live in
-- the server environment only; the table has had no reader or writer since
-- the external-investments security boundary was introduced.
DROP TABLE IF EXISTS "external_investment_credential" CASCADE;
