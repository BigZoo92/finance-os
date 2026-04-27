CREATE TABLE "market_ohlcv_bar" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "market_ohlcv_bar_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"symbol" text NOT NULL,
	"exchange" text,
	"interval" text DEFAULT '1d' NOT NULL,
	"bar_date" text NOT NULL,
	"open" numeric(18, 6) NOT NULL,
	"high" numeric(18, 6) NOT NULL,
	"low" numeric(18, 6) NOT NULL,
	"close" numeric(18, 6) NOT NULL,
	"volume" numeric(24, 4),
	"adjusted_close" numeric(18, 6),
	"currency" text,
	"source_ref" text,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"data_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "market_ohlcv_bar_pk_unique" ON "market_ohlcv_bar" USING btree ("provider","symbol","interval","bar_date");--> statement-breakpoint
CREATE INDEX "market_ohlcv_bar_symbol_date_idx" ON "market_ohlcv_bar" USING btree ("symbol","bar_date");--> statement-breakpoint
CREATE INDEX "market_ohlcv_bar_provider_fetched_idx" ON "market_ohlcv_bar" USING btree ("provider","fetched_at");
