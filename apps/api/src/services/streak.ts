import { dayKey } from '@studyverse/shared';
import type { Prisma } from '../lib/prisma.js';

/**
 * Marks "the player did something rewarded today" (UTC day). One atomic UPDATE that only fires on the
 * first activity of a new day: yesterday -> streak + 1, a gap -> streak restarts at 1. Calling it again
 * the same day changes nothing, so it is safe to call from every rewarded action.
 */
export async function touchStreak(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const today = dayKey(now);
  await tx.playerProgress.createMany({ data: [{ userId }], skipDuplicates: true });
  await tx.$executeRaw`
    UPDATE "PlayerProgress" SET
      "streak" = CASE WHEN "lastActiveDate" = ${today}::date - 1 THEN "streak" + 1 ELSE 1 END,
      "lastActiveDate" = ${today}::date,
      "updatedAt" = timezone('UTC', now())
    WHERE "userId" = ${userId}::uuid
      AND ("lastActiveDate" IS NULL OR "lastActiveDate" < ${today}::date)`;
}

/** Atomic energy grant. Callers guard idempotency themselves (status transition / claimedAt). */
export async function addEnergy(
  tx: Prisma.TransactionClient,
  userId: string,
  amount: number,
): Promise<void> {
  if (amount <= 0) return;
  await tx.playerProgress.update({
    where: { userId },
    data: { studyEnergy: { increment: amount } },
  });
}

/** XP-affecting class/skill modifiers for a player (04-rpg-design-spec). */
export async function getModifiers(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<{ scholarClass: boolean; scholarInsight: boolean; sageMemory: boolean }> {
  const [profile, skills] = await Promise.all([
    tx.playerProfile.findUnique({ where: { id: userId }, select: { playerClass: true } }),
    tx.playerSkill.findMany({
      where: { userId, skill: { slug: { in: ['scholar-insight', 'sage-memory'] } } },
      select: { skill: { select: { slug: true } } },
    }),
  ]);
  const slugs = new Set(skills.map((s) => s.skill.slug));
  return {
    scholarClass: profile?.playerClass === 'scholar',
    scholarInsight: slugs.has('scholar-insight'),
    sageMemory: slugs.has('sage-memory'),
  };
}
