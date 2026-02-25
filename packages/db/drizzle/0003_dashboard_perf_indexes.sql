CREATE INDEX IF NOT EXISTS "transaction_booking_date_idx" ON "transaction" USING btree ("booking_date");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "transaction_booking_date_id_idx" ON "transaction" USING btree ("booking_date","id");
