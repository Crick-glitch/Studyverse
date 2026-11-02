-- CreateEnum
CREATE TYPE "PlayerClass" AS ENUM ('warrior', 'tank', 'scholar');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('easy', 'medium', 'hard');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('open', 'completed');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('created', 'running', 'paused', 'finished', 'claimed', 'abandoned');

-- CreateEnum
CREATE TYPE "BattleMode" AS ENUM ('raid', 'practice');

-- CreateEnum
CREATE TYPE "BattleStatus" AS ENUM ('active', 'victory', 'defeat', 'retreated');

-- CreateEnum
CREATE TYPE "ItemSlot" AS ENUM ('weapon', 'armor');

-- CreateEnum
CREATE TYPE "Rarity" AS ENUM ('common', 'uncommon', 'rare');

-- CreateEnum
CREATE TYPE "SkillBranch" AS ENUM ('might', 'guard', 'mind');

-- CreateEnum
CREATE TYPE "ReviewContext" AS ENUM ('review', 'battle', 'session');

-- CreateEnum
CREATE TYPE "QuestPeriod" AS ENUM ('daily', 'weekly');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateTable
CREATE TABLE "PlayerProfile" (
    "id" UUID NOT NULL,
    "displayName" VARCHAR(20) NOT NULL,
    "displayNameKey" VARCHAR(20) NOT NULL,
    "avatarKey" VARCHAR(64),
    "avatarUrl" TEXT,
    "playerClass" "PlayerClass",
    "showOnLeaderboard" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerProgress" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "level" INTEGER NOT NULL DEFAULT 1,
    "totalXp" INTEGER NOT NULL DEFAULT 0,
    "currentLevelXp" INTEGER NOT NULL DEFAULT 0,
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE,
    "studyEnergy" INTEGER NOT NULL DEFAULT 0,
    "skillPoints" INTEGER NOT NULL DEFAULT 0,
    "raidWins" INTEGER NOT NULL DEFAULT 0,
    "raidLosses" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerProgress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "XpTransaction" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" VARCHAR(120) NOT NULL,
    "sourceType" VARCHAR(40) NOT NULL,
    "sourceId" VARCHAR(120) NOT NULL,
    "leaderboardEligible" BOOLEAN NOT NULL DEFAULT true,
    "levelAfter" INTEGER NOT NULL,
    "levelsGained" INTEGER NOT NULL DEFAULT 0,
    "skillPointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "subject" VARCHAR(40) NOT NULL DEFAULT 'Other',
    "status" "TaskStatus" NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "rewardedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudySession" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "subject" VARCHAR(40) NOT NULL,
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "plannedMinutes" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL DEFAULT 'created',
    "startedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "pausedTotalSec" INTEGER NOT NULL DEFAULT 0,
    "finishedAt" TIMESTAMP(3),
    "focusRatioReported" DOUBLE PRECISION,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "energyAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "StudySession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" UUID NOT NULL,
    "legacyId" VARCHAR(40),
    "subject" VARCHAR(40) NOT NULL,
    "difficulty" "Difficulty" NOT NULL,
    "text" TEXT NOT NULL,
    "choices" TEXT[],
    "correctIndex" INTEGER NOT NULL,
    "explanation" TEXT,
    "needsReview" BOOLEAN NOT NULL DEFAULT false,
    "source" VARCHAR(20) NOT NULL DEFAULT 'builtin',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionClaimQuestion" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "presentedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "selectedIndex" INTEGER,
    "correct" BOOLEAN,
    CONSTRAINT "SessionClaimQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardDeck" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "subject" VARCHAR(40) NOT NULL DEFAULT 'Other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FlashcardDeck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Flashcard" (
    "id" UUID NOT NULL,
    "deckId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "subject" VARCHAR(40) NOT NULL DEFAULT 'Other',
    "difficulty" "Difficulty" NOT NULL DEFAULT 'medium',
    "distractors" TEXT[],
    "ease" DOUBLE PRECISION NOT NULL DEFAULT 2.5,
    "intervalDays" INTEGER NOT NULL DEFAULT 0,
    "repetitions" INTEGER NOT NULL DEFAULT 0,
    "dueAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Flashcard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FlashcardReview" (
    "id" UUID NOT NULL,
    "cardId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "quality" INTEGER NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "intervalAfter" INTEGER NOT NULL,
    "easeAfter" DOUBLE PRECISION NOT NULL,
    "context" "ReviewContext" NOT NULL DEFAULT 'review',
    CONSTRAINT "FlashcardReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ItemDefinition" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slot" "ItemSlot" NOT NULL,
    "rarity" "Rarity" NOT NULL,
    "atk" INTEGER NOT NULL DEFAULT 0,
    "def" INTEGER NOT NULL DEFAULT 0,
    "effectKey" VARCHAR(60),
    "spriteKey" VARCHAR(80) NOT NULL,
    CONSTRAINT "ItemDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerItem" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "itemDefinitionId" UUID NOT NULL,
    "acquiredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" VARCHAR(40) NOT NULL,
    CONSTRAINT "PlayerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "weaponItemId" UUID,
    "armorItemId" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillDefinition" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "branch" "SkillBranch" NOT NULL,
    "cost" INTEGER NOT NULL,
    "prerequisites" TEXT[],
    "effectKey" VARCHAR(60) NOT NULL,
    CONSTRAINT "SkillDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerSkill" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "skillId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerSkill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Battle" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "status" "BattleStatus" NOT NULL DEFAULT 'active',
    "mode" "BattleMode" NOT NULL,
    "subject" VARCHAR(40) NOT NULL,
    "tier" INTEGER NOT NULL DEFAULT 1,
    "enemySlug" VARCHAR(60) NOT NULL,
    "enemyMaxHp" INTEGER NOT NULL,
    "enemyHp" INTEGER NOT NULL,
    "playerMaxHp" INTEGER NOT NULL,
    "playerHp" INTEGER NOT NULL,
    "turn" INTEGER NOT NULL DEFAULT 1,
    "comboStreak" INTEGER NOT NULL DEFAULT 0,
    "focus" INTEGER NOT NULL DEFAULT 0,
    "seed" INTEGER NOT NULL,
    "engineState" JSONB NOT NULL DEFAULT '{}',
    "idempotencyKey" VARCHAR(80),
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "rewardsGrantedAt" TIMESTAMP(3),
    CONSTRAINT "Battle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BattleTurn" (
    "id" UUID NOT NULL,
    "battleId" UUID NOT NULL,
    "turnNumber" INTEGER NOT NULL,
    "questionId" UUID NOT NULL,
    "intent" VARCHAR(20) NOT NULL,
    "selectedIndex" INTEGER,
    "correct" BOOLEAN,
    "damageDealt" INTEGER NOT NULL DEFAULT 0,
    "damageTaken" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "answeredAt" TIMESTAMP(3),
    CONSTRAINT "BattleTurn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Achievement" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "description" TEXT NOT NULL,
    "spriteKey" VARCHAR(80),
    CONSTRAINT "Achievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerAchievement" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "achievementId" UUID NOT NULL,
    "unlockedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlayerAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestDefinition" (
    "id" UUID NOT NULL,
    "slug" VARCHAR(60) NOT NULL,
    "period" "QuestPeriod" NOT NULL,
    "title" VARCHAR(120) NOT NULL,
    "description" TEXT NOT NULL,
    "metric" VARCHAR(40) NOT NULL,
    "target" INTEGER NOT NULL,
    "rewardXp" INTEGER NOT NULL,
    "rewardEnergy" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "QuestDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlayerQuest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "questId" UUID NOT NULL,
    "periodKey" VARCHAR(20) NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PlayerQuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportBatch" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "payloadHash" VARCHAR(64) NOT NULL,
    "status" "ImportStatus" NOT NULL DEFAULT 'pending',
    "report" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ImportBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerProfile_displayNameKey_key" ON "PlayerProfile"("displayNameKey");
CREATE UNIQUE INDEX "PlayerProgress_userId_key" ON "PlayerProgress"("userId");
CREATE UNIQUE INDEX "XpTransaction_userId_sourceType_sourceId_key" ON "XpTransaction"("userId","sourceType","sourceId");
CREATE INDEX "XpTransaction_leaderboardEligible_createdAt_userId_idx" ON "XpTransaction"("leaderboardEligible","createdAt","userId");
CREATE INDEX "XpTransaction_userId_createdAt_idx" ON "XpTransaction"("userId","createdAt");
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId","status");
CREATE INDEX "StudySession_userId_status_idx" ON "StudySession"("userId","status");
CREATE INDEX "StudySession_userId_createdAt_idx" ON "StudySession"("userId","createdAt");
CREATE UNIQUE INDEX "Question_legacyId_key" ON "Question"("legacyId");
CREATE INDEX "Question_subject_difficulty_idx" ON "Question"("subject","difficulty");
CREATE UNIQUE INDEX "SessionClaimQuestion_sessionId_position_key" ON "SessionClaimQuestion"("sessionId","position");
CREATE INDEX "SessionClaimQuestion_questionId_idx" ON "SessionClaimQuestion"("questionId");
CREATE INDEX "FlashcardDeck_userId_idx" ON "FlashcardDeck"("userId");
CREATE INDEX "Flashcard_deckId_idx" ON "Flashcard"("deckId");
CREATE INDEX "Flashcard_userId_dueAt_idx" ON "Flashcard"("userId","dueAt");
CREATE INDEX "FlashcardReview_cardId_idx" ON "FlashcardReview"("cardId");
CREATE INDEX "FlashcardReview_userId_reviewedAt_idx" ON "FlashcardReview"("userId","reviewedAt");
CREATE UNIQUE INDEX "ItemDefinition_slug_key" ON "ItemDefinition"("slug");
CREATE UNIQUE INDEX "PlayerItem_id_userId_key" ON "PlayerItem"("id","userId");
CREATE INDEX "PlayerItem_userId_idx" ON "PlayerItem"("userId");
CREATE INDEX "PlayerItem_itemDefinitionId_idx" ON "PlayerItem"("itemDefinitionId");
CREATE UNIQUE INDEX "Equipment_userId_key" ON "Equipment"("userId");
CREATE INDEX "Equipment_weaponItemId_idx" ON "Equipment"("weaponItemId");
CREATE INDEX "Equipment_armorItemId_idx" ON "Equipment"("armorItemId");
CREATE UNIQUE INDEX "SkillDefinition_slug_key" ON "SkillDefinition"("slug");
CREATE UNIQUE INDEX "PlayerSkill_userId_skillId_key" ON "PlayerSkill"("userId","skillId");
CREATE INDEX "PlayerSkill_skillId_idx" ON "PlayerSkill"("skillId");
CREATE UNIQUE INDEX "Battle_userId_idempotencyKey_key" ON "Battle"("userId","idempotencyKey");
CREATE INDEX "Battle_userId_status_idx" ON "Battle"("userId","status");
CREATE INDEX "Battle_userId_startedAt_idx" ON "Battle"("userId","startedAt");
CREATE UNIQUE INDEX "BattleTurn_battleId_turnNumber_key" ON "BattleTurn"("battleId","turnNumber");
CREATE INDEX "BattleTurn_questionId_idx" ON "BattleTurn"("questionId");
CREATE UNIQUE INDEX "Achievement_slug_key" ON "Achievement"("slug");
CREATE UNIQUE INDEX "PlayerAchievement_userId_achievementId_key" ON "PlayerAchievement"("userId","achievementId");
CREATE INDEX "PlayerAchievement_achievementId_idx" ON "PlayerAchievement"("achievementId");
CREATE UNIQUE INDEX "QuestDefinition_slug_key" ON "QuestDefinition"("slug");
CREATE UNIQUE INDEX "PlayerQuest_userId_questId_periodKey_key" ON "PlayerQuest"("userId","questId","periodKey");
CREATE INDEX "PlayerQuest_questId_idx" ON "PlayerQuest"("questId");
CREATE UNIQUE INDEX "ImportBatch_userId_payloadHash_key" ON "ImportBatch"("userId","payloadHash");

-- AddForeignKey
ALTER TABLE "PlayerProgress" ADD CONSTRAINT "PlayerProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "XpTransaction" ADD CONSTRAINT "XpTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StudySession" ADD CONSTRAINT "StudySession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionClaimQuestion" ADD CONSTRAINT "SessionClaimQuestion_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "StudySession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SessionClaimQuestion" ADD CONSTRAINT "SessionClaimQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FlashcardDeck" ADD CONSTRAINT "FlashcardDeck_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_deckId_fkey" FOREIGN KEY ("deckId") REFERENCES "FlashcardDeck"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Flashcard" ADD CONSTRAINT "Flashcard_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FlashcardReview" ADD CONSTRAINT "FlashcardReview_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerItem" ADD CONSTRAINT "PlayerItem_itemDefinitionId_fkey" FOREIGN KEY ("itemDefinitionId") REFERENCES "ItemDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_weaponItemId_userId_fkey" FOREIGN KEY ("weaponItemId","userId") REFERENCES "PlayerItem"("id","userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "Equipment" ADD CONSTRAINT "Equipment_armorItemId_userId_fkey" FOREIGN KEY ("armorItemId","userId") REFERENCES "PlayerItem"("id","userId") ON DELETE NO ACTION ON UPDATE CASCADE;
ALTER TABLE "PlayerSkill" ADD CONSTRAINT "PlayerSkill_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerSkill" ADD CONSTRAINT "PlayerSkill_skillId_fkey" FOREIGN KEY ("skillId") REFERENCES "SkillDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Battle" ADD CONSTRAINT "Battle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleTurn" ADD CONSTRAINT "BattleTurn_battleId_fkey" FOREIGN KEY ("battleId") REFERENCES "Battle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "BattleTurn" ADD CONSTRAINT "BattleTurn_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerAchievement" ADD CONSTRAINT "PlayerAchievement_achievementId_fkey" FOREIGN KEY ("achievementId") REFERENCES "Achievement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlayerQuest" ADD CONSTRAINT "PlayerQuest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PlayerQuest" ADD CONSTRAINT "PlayerQuest_questId_fkey" FOREIGN KEY ("questId") REFERENCES "QuestDefinition"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ImportBatch" ADD CONSTRAINT "ImportBatch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row Level Security: enabled on every table with NO policies, so the Supabase client
-- (anon / authenticated roles) cannot read or write game tables directly. Only the API,
-- which connects with a privileged database role, can. Authorization lives in the API.
ALTER TABLE "PlayerProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerProgress" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "XpTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Task" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StudySession" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Question" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SessionClaimQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardDeck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Flashcard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FlashcardReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ItemDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Equipment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SkillDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerSkill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Battle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BattleTurn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Achievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerAchievement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestDefinition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PlayerQuest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ImportBatch" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF to_regclass('public."_prisma_migrations"') IS NOT NULL THEN
    ALTER TABLE "_prisma_migrations" ENABLE ROW LEVEL SECURITY;
  END IF;
  -- Belt and braces: remove any default grants Supabase gives the client roles on public tables.
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
  END IF;
END
$$;

