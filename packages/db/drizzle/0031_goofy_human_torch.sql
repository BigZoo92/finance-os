CREATE TABLE "advisor_post_mortem" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "advisor_post_mortem_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"run_id" integer,
	"recommendation_id" integer,
	"decision_id" integer,
	"recommendation_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"horizon_days" integer,
	"evaluated_at" timestamp with time zone,
	"expected_outcome_at" timestamp with time zone,
	"input_summary" jsonb,
	"findings" jsonb,
	"learning_actions" jsonb,
	"calibration" jsonb,
	"risk_notes" jsonb,
	"skipped_reason" text,
	"error_code" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "advisor_post_mortem" ADD CONSTRAINT "advisor_post_mortem_run_id_ai_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."ai_run"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_post_mortem" ADD CONSTRAINT "advisor_post_mortem_recommendation_id_ai_recommendation_id_fk" FOREIGN KEY ("recommendation_id") REFERENCES "public"."ai_recommendation"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "advisor_post_mortem" ADD CONSTRAINT "advisor_post_mortem_decision_id_advisor_decision_journal_id_fk" FOREIGN KEY ("decision_id") REFERENCES "public"."advisor_decision_journal"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_status_idx" ON "advisor_post_mortem" USING btree ("status");--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_recommendation_id_idx" ON "advisor_post_mortem" USING btree ("recommendation_id");--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_decision_id_idx" ON "advisor_post_mortem" USING btree ("decision_id");--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_recommendation_key_idx" ON "advisor_post_mortem" USING btree ("recommendation_key");--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_expected_outcome_at_idx" ON "advisor_post_mortem" USING btree ("expected_outcome_at");--> statement-breakpoint
CREATE INDEX "advisor_post_mortem_evaluated_at_idx" ON "advisor_post_mortem" USING btree ("evaluated_at");