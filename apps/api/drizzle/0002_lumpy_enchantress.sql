ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider" text DEFAULT 'email' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "provider_user_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "users_provider_provider_user_id_unique" ON "users" USING btree ("provider","provider_user_id");