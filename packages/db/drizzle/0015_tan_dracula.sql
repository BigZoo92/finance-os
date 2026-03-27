CREATE TYPE "public"."powens_last_sync_reason_code" AS ENUM('SUCCESS', 'PARTIAL_IMPORT', 'SYNC_FAILED', 'RECONNECT_REQUIRED');--> statement-breakpoint
CREATE TYPE "public"."powens_last_sync_status" AS ENUM('OK', 'KO');--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "last_sync_status" "powens_last_sync_status";--> statement-breakpoint
ALTER TABLE "powens_connection" ADD COLUMN "last_sync_reason_code" "powens_last_sync_reason_code";