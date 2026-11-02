import { AppError } from '../lib/errors.js';
import type { PrismaClient } from '../lib/prisma.js';
import { ensurePlayer } from './player.js';

/**
 * "Report this question": one report per player per question (repeat calls update the reason). Reports are
 * stored for the owner to review; they never change a question or any reward by themselves.
 */
export async function reportQuestion(
  prisma: PrismaClient,
  userId: string,
  questionId: string,
  reason: string | undefined,
): Promise<{ reported: true }> {
  await ensurePlayer(prisma, userId);
  const q = await prisma.question.findUnique({ where: { id: questionId }, select: { id: true } });
  if (!q) throw new AppError(404, 'QUESTION_NOT_FOUND', 'Question not found');
  await prisma.questionReport.upsert({
    where: { questionId_userId: { questionId, userId } },
    update: { reason: reason ?? null },
    create: { questionId, userId, reason: reason ?? null },
  });
  return { reported: true };
}
