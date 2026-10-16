ALTER TABLE "users" DROP CONSTRAINT "users_email_unique";
ALTER TABLE "users" ADD COLUMN "provider" text DEFAULT 'email' NOT NULL;
ALTER TABLE "users" ADD COLUMN "provider_user_id" text;
CREATE UNIQUE INDEX "users_provider_provider_user_id_unique" ON "users" ("provider", "provider_user_id");
