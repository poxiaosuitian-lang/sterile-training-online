ALTER TABLE "Player" ADD COLUMN "username" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Player_username_key" ON "Player"("username");
ALTER TABLE "GameSession" ADD COLUMN "receipt" JSONB;
