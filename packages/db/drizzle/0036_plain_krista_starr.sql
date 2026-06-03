CREATE TABLE "user_categorization_rule" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "user_categorization_rule_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"name" text NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 100 NOT NULL,
	"matcher_type" text NOT NULL,
	"matcher_value" text NOT NULL,
	"amount_sign" text,
	"min_amount" numeric(18, 2),
	"max_amount" numeric(18, 2),
	"category" text NOT NULL,
	"subcategory" text,
	"income_type" text,
	"valid_from" date,
	"valid_to" date,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_by" text DEFAULT 'admin' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_provider_cost" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "recurring_provider_cost_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"provider" text NOT NULL,
	"label" text NOT NULL,
	"amount" numeric(18, 6) NOT NULL,
	"currency" text DEFAULT 'EUR' NOT NULL,
	"cadence" text DEFAULT 'monthly' NOT NULL,
	"start_date" date,
	"end_date" date,
	"active" boolean DEFAULT true NOT NULL,
	"category" text DEFAULT 'provider_subscription' NOT NULL,
	"source" text DEFAULT 'manual_admin' NOT NULL,
	"owner" text DEFAULT 'admin' NOT NULL,
	"notes" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "user_categorization_rule_enabled_priority_idx" ON "user_categorization_rule" USING btree ("enabled","priority");
--> statement-breakpoint
CREATE INDEX "user_categorization_rule_matcher_idx" ON "user_categorization_rule" USING btree ("matcher_type","matcher_value");
--> statement-breakpoint
CREATE INDEX "user_categorization_rule_validity_idx" ON "user_categorization_rule" USING btree ("valid_from","valid_to");
--> statement-breakpoint
CREATE INDEX "recurring_provider_cost_active_idx" ON "recurring_provider_cost" USING btree ("active");
--> statement-breakpoint
CREATE INDEX "recurring_provider_cost_provider_idx" ON "recurring_provider_cost" USING btree ("provider");
--> statement-breakpoint
CREATE INDEX "recurring_provider_cost_category_idx" ON "recurring_provider_cost" USING btree ("category");
