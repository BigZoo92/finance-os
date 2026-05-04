CREATE TABLE "advisor_decision_journal" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "advisor_decision_journal_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"recommendation_id" integer,
	"run_id" integer,
	"recommendation_key" text,
	"decision" text NOT NULL,
	"reason_code" text NOT NULL,
	"free_note" text,
	"decided_by" text DEFAULT 'admin' NOT NULL,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expected_outcome_at" timestamp with time zone,
	"scope" text DEFAULT 'admin' NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "advisor_decision_outcome" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "advisor_decision_outcome_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"decision_id" integer NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"outcome_kind" text NOT NULL,
	"delta_metrics" jsonb,
	"learning_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"free_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_decision_journal" ADD CONSTRAINT "advisor_decision_journal_recommendation_id_ai_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ai_recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_decision_journal" ADD CONSTRAINT "advisor_decision_journal_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_decision_outcome" ADD CONSTRAINT "advisor_decision_outcome_decision_id_advisor_decision_journal_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."advisor_decision_journal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_recommendation_id_idx" ON "advisor_decision_journal" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_run_id_idx" ON "advisor_decision_journal" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_recommendation_key_idx" ON "advisor_decision_journal" USING btree ("recommendation_key");--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_decision_idx" ON "advisor_decision_journal" USING btree ("decision");--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_decided_at_idx" ON "advisor_decision_journal" USING btree ("decided_at");--> statement-breakpoint
CREATE INDEX "advisor_decision_journal_scope_idx" ON "advisor_decision_journal" USING btree ("scope");--> statement-breakpoint
CREATE INDEX "advisor_decision_outcome_decision_id_idx" ON "advisor_decision_outcome" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "advisor_decision_outcome_observed_at_idx" ON "advisor_decision_outcome" USING btree ("observed_at");--> statement-breakpoint
CREATE INDEX "advisor_decision_outcome_outcome_kind_idx" ON "advisor_decision_outcome" USING btree ("outcome_kind");