CREATE TYPE "public"."recurring_commitment_kind" AS ENUM('fixed_charge', 'subscription');--> statement-breakpoint
CREATE TYPE "public"."recurring_commitment_periodicity" AS ENUM('weekly', 'monthly', 'quarterly', 'yearly', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."recurring_commitment_validation_status" AS ENUM('suggested', 'validated', 'rejected');--> statement-breakpoint
CREATE TABLE "recurring_commitment" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recurring_commitment_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" "recurring_commitment_kind" NOT NULL,
	"canonical_label" text NOT NULL,
	"merchant" text,
	"currency" text NOT NULL,
	"estimated_periodicity" "recurring_commitment_periodicity" DEFAULT 'unknown' NOT NULL,
	"last_amount" numeric(18, 2),
	"last_observed_at" timestamp with time zone,
	"active" boolean DEFAULT true NOT NULL,
	"validation_status" "recurring_commitment_validation_status" DEFAULT 'suggested' NOT NULL,
	"validated_at" timestamp with time zone,
	"rejected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_commitment_transaction_link" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recurring_commitment_transaction_link_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recurring_commitment_id" integer NOT NULL,
	"transaction_id" integer NOT NULL,
	"link_type" text DEFAULT 'transaction' NOT NULL,
	"confidence" numeric(5, 2),
	"source" text DEFAULT 'auto_detection' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recurring_commitment_transaction_link" ADD CONSTRAINT "recurring_commitment_transaction_link_recurring_commitment_id_recurring_commitment_id_fk" FOREIGN KEY ("recurring_commitment_id") REFERENCES "public"."recurring_commitment"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_commitment_transaction_link" ADD CONSTRAINT "recurring_commitment_transaction_link_transaction_id_transaction_id_fk" FOREIGN KEY ("transaction_id") REFERENCES "public"."transaction"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_commitment_kind_label_currency_unique" ON "recurring_commitment" USING btree ("kind","canonical_label","currency");--> statement-breakpoint
CREATE INDEX "recurring_commitment_status_active_idx" ON "recurring_commitment" USING btree ("validation_status","active");--> statement-breakpoint
CREATE UNIQUE INDEX "recurring_commitment_transaction_link_unique" ON "recurring_commitment_transaction_link" USING btree ("recurring_commitment_id","transaction_id");--> statement-breakpoint
CREATE INDEX "recurring_commitment_link_transaction_idx" ON "recurring_commitment_transaction_link" USING btree ("transaction_id");
