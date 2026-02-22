CREATE TYPE "public"."powens_connection_status" AS ENUM('connected', 'syncing', 'error', 'reconnect_required');--> statement-breakpoint
CREATE TABLE "bank_account" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "bank_account_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"powens_account_id" text NOT NULL,
	"powens_connection_id" text NOT NULL,
	"name" text NOT NULL,
	"iban" text,
	"currency" text NOT NULL,
	"type" text,
	"enabled" boolean DEFAULT true NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "powens_connection" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "powens_connection_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"powens_connection_id" text NOT NULL,
	"access_token_encrypted" text NOT NULL,
	"status" "powens_connection_status" DEFAULT 'connected' NOT NULL,
	"last_sync_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transaction" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "transaction_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"powens_transaction_id" text,
	"powens_connection_id" text NOT NULL,
	"powens_account_id" text NOT NULL,
	"booking_date" date NOT NULL,
	"amount" numeric(18, 2) NOT NULL,
	"currency" text NOT NULL,
	"label" text NOT NULL,
	"label_hash" text NOT NULL,
	"raw" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "bank_account_powens_account_id_unique" ON "bank_account" USING btree ("powens_account_id");--> statement-breakpoint
CREATE INDEX "bank_account_powens_connection_id_idx" ON "bank_account" USING btree ("powens_connection_id");--> statement-breakpoint
CREATE UNIQUE INDEX "powens_connection_powens_connection_id_unique" ON "powens_connection" USING btree ("powens_connection_id");--> statement-breakpoint
CREATE INDEX "transaction_powens_connection_id_idx" ON "transaction" USING btree ("powens_connection_id");--> statement-breakpoint
CREATE INDEX "transaction_powens_account_id_idx" ON "transaction" USING btree ("powens_account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_powens_transaction_unique" ON "transaction" USING btree ("powens_connection_id","powens_transaction_id") WHERE "transaction"."powens_transaction_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "transaction_fallback_unique" ON "transaction" USING btree ("powens_connection_id","powens_account_id","booking_date","amount","label_hash");