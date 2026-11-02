-- Session 06 (battle screen), Step 0: one ADDITIVE migration. Nothing is dropped or renamed.
-- Written by hand (Prisma's schema engine could not be downloaded in the authoring sandbox).
-- Verify with: cd apps/api && npx prisma migrate dev   (it must report no drift / nothing to apply).

-- AlterTable: Battle (reward summary stored once so `finish` can return it again unchanged)
ALTER TABLE "Battle" ADD COLUMN "rewardSummary" JSONB;

-- AlterTable: BattleTurn. The row now exists when the turn opens (intent known); the question is assigned
-- when a move is chosen, so questionId becomes nullable and the question is snapshotted on the turn.
ALTER TABLE "BattleTurn" ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE "BattleTurn" ADD COLUMN "cardId" UUID;
ALTER TABLE "BattleTurn" ADD COLUMN "move" VARCHAR(10);
ALTER TABLE "BattleTurn" ADD COLUMN "questionDifficulty" "Difficulty";
ALTER TABLE "BattleTurn" ADD COLUMN "questionSubject" VARCHAR(40);
ALTER TABLE "BattleTurn" ADD COLUMN "questionText" TEXT;
ALTER TABLE "BattleTurn" ADD COLUMN "choices" TEXT[];
ALTER TABLE "BattleTurn" ADD COLUMN "correctIndex" INTEGER;
ALTER TABLE "BattleTurn" ADD COLUMN "explanation" TEXT;
ALTER TABLE "BattleTurn" ADD COLUMN "armedAbility" VARCHAR(20);
ALTER TABLE "BattleTurn" ADD COLUMN "removedIndex" INTEGER;
ALTER TABLE "BattleTurn" ADD COLUMN "result" JSONB;

-- CreateIndex
CREATE INDEX "BattleTurn_cardId_idx" ON "BattleTurn"("cardId");
CREATE INDEX "Battle_userId_status_mode_enemySlug_idx" ON "Battle"("userId", "status", "mode", "enemySlug");
CREATE INDEX "XpTransaction_userId_sourceType_createdAt_idx" ON "XpTransaction"("userId", "sourceType", "createdAt");

-- AddForeignKey
ALTER TABLE "BattleTurn" ADD CONSTRAINT "BattleTurn_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Row level security: no new tables, so nothing to enable; the existing "Battle" / "BattleTurn" policies
-- (RLS on, no public policies) cover the new columns.
