CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'FAILED', 'EXPIRED');

CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "nickname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "GameSession" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "levelVersion" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
    "challenge" JSONB NOT NULL,
    "submission" JSONB,
    "score" INTEGER,
    "stars" INTEGER,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "GameSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LevelProgress" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "unlocked" BOOLEAN NOT NULL DEFAULT false,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "bestScore" INTEGER NOT NULL DEFAULT 0,
    "bestStars" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "LevelProgress_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScoreEvent" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "stars" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ScoreEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Player_deviceId_key" ON "Player"("deviceId");
CREATE INDEX "GameSession_playerId_status_idx" ON "GameSession"("playerId", "status");
CREATE INDEX "GameSession_levelId_score_idx" ON "GameSession"("levelId", "score");
CREATE UNIQUE INDEX "LevelProgress_playerId_levelId_key" ON "LevelProgress"("playerId", "levelId");
CREATE INDEX "LevelProgress_levelId_bestScore_idx" ON "LevelProgress"("levelId", "bestScore");
CREATE INDEX "ScoreEvent_levelId_score_idx" ON "ScoreEvent"("levelId", "score");
CREATE INDEX "ScoreEvent_playerId_createdAt_idx" ON "ScoreEvent"("playerId", "createdAt");

ALTER TABLE "GameSession"
ADD CONSTRAINT "GameSession_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "LevelProgress"
ADD CONSTRAINT "LevelProgress_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ScoreEvent"
ADD CONSTRAINT "ScoreEvent_playerId_fkey"
FOREIGN KEY ("playerId") REFERENCES "Player"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
