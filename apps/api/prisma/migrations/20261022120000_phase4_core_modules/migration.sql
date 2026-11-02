-- Phase 4 (core modules): review sessions, snapshot claim quizzes, question reports.
-- Written by hand (Prisma's schema engine could not be downloaded in the authoring sandbox).
-- Verify with: cd apps/api && npx prisma migrate dev   (it must report no drift / nothing to apply).

-- CreateEnum
CREATE TYPE "SessionKind" AS ENUM ('study', 'review');

-- AlterTable: StudySession
ALTER TABLE "StudySession" ADD COLUMN "kind" "SessionKind" NOT NULL DEFAULT 'study';
ALTER TABLE "StudySession" ADD COLUMN "outcomeReason" VARCHAR(40);

-- AlterTable: SessionClaimQuestion (questions become snapshots; cards may be the source)
ALTER TABLE "SessionClaimQuestion" ALTER COLUMN "questionId" DROP NOT NULL;
ALTER TABLE "SessionClaimQuestion" ADD COLUMN "cardId" UUID;
ALTER TABLE "SessionClaimQuestion" ADD COLUMN "text" TEXT NOT NULL DEFAULT '';
ALTER TABLE "SessionClaimQuestion" ADD COLUMN "choices" TEXT[];
ALTER TABLE "SessionClaimQuestion" ADD COLUMN "correctIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "SessionClaimQuestion" ALTER COLUMN "text" DROP DEFAULT;
ALTER TABLE "SessionClaimQuestion" ALTER COLUMN "correctIndex" DROP DEFAULT;

-- CreateTable
CREATE TABLE "QuestionReport" (
    "id" UUID NOT NULL,
    "questionId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "reason" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuestionReport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionClaimQuestion_cardId_idx" ON "SessionClaimQuestion"("cardId");
CREATE UNIQUE INDEX "QuestionReport_questionId_userId_key" ON "QuestionReport"("questionId","userId");
CREATE INDEX "QuestionReport_userId_idx" ON "QuestionReport"("userId");

-- AddForeignKey
ALTER TABLE "SessionClaimQuestion" ADD CONSTRAINT "SessionClaimQuestion_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "Flashcard"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "QuestionReport" ADD CONSTRAINT "QuestionReport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "PlayerProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Row level security: same rule as every other table (no policies; only the API's privileged role can read).
ALTER TABLE "QuestionReport" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM anon;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
  END IF;
END
$$;
