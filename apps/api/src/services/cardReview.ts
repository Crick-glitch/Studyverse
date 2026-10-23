import { nextSrsState } from '@studyverse/shared';
import type { Flashcard } from '../generated/prisma/client.js';
import type { Prisma } from '../lib/prisma.js';

export type ReviewContextName = 'review' | 'battle' | 'session';

/**
 * Applies one review to a card: SM-2 scheduling + a FlashcardReview row, in the caller's transaction.
 *
 * Compare-and-set: the update only fires while the card still has the `dueAt` the caller saw, so a
 * double-click, a retry or two tabs schedule the card once. Returns `applied: false` (nothing changed)
 * when that no longer holds.
 */
export async function applyCardReview(
  tx: Prisma.TransactionClient,
  input: {
    userId: string;
    card: Flashcard;
    quality: number;
    now: Date;
    context: ReviewContextName;
    sageMemory: boolean;
  },
): Promise<{ applied: boolean; card: Flashcard; passed: boolean }> {
  const { userId, card, quality, now, context } = input;
  const next = nextSrsState(
    { ease: card.ease, intervalDays: card.intervalDays, repetitions: card.repetitions },
    quality,
    now,
    { sageMemory: input.sageMemory },
  );
  const res = await tx.flashcard.updateMany({
    where: { id: card.id, userId, dueAt: card.dueAt },
    data: {
      ease: next.ease,
      intervalDays: next.intervalDays,
      repetitions: next.repetitions,
      dueAt: next.dueAt,
    },
  });
  if (res.count === 0) {
    const current = await tx.flashcard.findFirst({ where: { id: card.id, userId } });
    return { applied: false, card: current ?? card, passed: next.passed };
  }
  await tx.flashcardReview.create({
    data: {
      cardId: card.id,
      userId,
      quality,
      correct: next.passed,
      reviewedAt: now,
      intervalAfter: next.intervalDays,
      easeAfter: next.ease,
      context,
    },
  });
  const updated = await tx.flashcard.findFirstOrThrow({ where: { id: card.id, userId } });
  return { applied: true, card: updated, passed: next.passed };
}
