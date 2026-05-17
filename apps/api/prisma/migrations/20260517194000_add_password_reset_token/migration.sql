ALTER TABLE "users"
ADD COLUMN "password_reset_token" TEXT,
ADD COLUMN "password_reset_token_exp" TIMESTAMP(3);

CREATE UNIQUE INDEX "users_password_reset_token_key" ON "users"("password_reset_token");
