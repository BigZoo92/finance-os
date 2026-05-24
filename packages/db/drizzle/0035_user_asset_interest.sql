CREATE TABLE IF NOT EXISTS "user_asset_interest" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
	"normalized_symbol" text NOT NULL,
	"symbol" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" text NOT NULL,
	"provider_symbols_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"icon_url" text,
	"logo_url" text,
	"isin" text,
	"exchange" text,
	"currency" text NOT NULL DEFAULT 'EUR',
	"user_interest_level" text NOT NULL DEFAULT 'watching',
	"user_intent" text NOT NULL DEFAULT 'watch',
	"note" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "user_asset_interest_symbol_asset_class_unique"
	ON "user_asset_interest" ("normalized_symbol", "asset_class");
CREATE INDEX IF NOT EXISTS "user_asset_interest_symbol_idx"
	ON "user_asset_interest" ("normalized_symbol");
CREATE INDEX IF NOT EXISTS "user_asset_interest_intent_idx"
	ON "user_asset_interest" ("user_intent");
CREATE INDEX IF NOT EXISTS "user_asset_interest_level_idx"
	ON "user_asset_interest" ("user_interest_level");
