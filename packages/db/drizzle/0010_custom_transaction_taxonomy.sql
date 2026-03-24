ALTER TABLE "transaction" ADD COLUMN "custom_category" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "custom_subcategory" text;--> statement-breakpoint
ALTER TABLE "transaction" ADD COLUMN "custom_tags" jsonb;
