CREATE TABLE "ocr_jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"receiptId" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"scheduledFor" timestamp DEFAULT now() NOT NULL,
	"lastError" text
);
--> statement-breakpoint
ALTER TABLE "ocr_jobs" ADD CONSTRAINT "ocr_jobs_receiptId_receipts_id_fk" FOREIGN KEY ("receiptId") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;