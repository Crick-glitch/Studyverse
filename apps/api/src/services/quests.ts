import {
  periodEnd,
  periodKey,
  type ProgressDto,
  type QuestClaimResultDto,
  type QuestDto,
  type QuestMetric,
} from '@studyverse/shared';
import type { PlayerQuest, QuestDefinition } from '../generated/prisma/client.js';
import { grantXp } from '../lib/xp.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import type { Db, Prisma, PrismaClient } from '../lib/prisma.js';
import { toProgressDto } from './player.js';
import { addEnergy, touchStreak } from './streak.js';

type Row = PlayerQuest & { quest: QuestDefinition };

function toQuestDto(r: Row, now: Date): QuestDto {
  const done = r.progress >= r.quest.target;
  return {
    id: r.id,
    slug: r.quest.slug,
    period: r.quest.period,
    periodKey: r.periodKey,
    title: r.quest.title,
    description: r.quest.description,
    metric: r.quest.metric as QuestMetric,
    target: r.quest.target,
    progress: Math.min(r.progress, r.quest.target),
    rewardXp: r.quest.rewardXp,
    rewardEnergy: r.quest.rewardEnergy,
    claimable: done && r.claimedAt === null,
    claimed: r.claimedAt !== null,
    resetsAt: periodEnd(r.quest.period, now).toISOString(),
  };
}

/** Creates this day's / week's instance of every quest definition for the player (idempotent). */
export async function ensureQuestInstances(
  tx: Prisma.TransactionClient,
  userId: string,
  now: Date,
): Promise<void> {
  const defs = await tx.questDefinition.findMany();
  if (defs.length === 0) return;
  await tx.playerQuest.createMany({
    data: defs.map((d) => ({ userId, questId: d.id, periodKey: periodKey(d.period, now) })),
    skipDuplicates: true,
  });
}

/**
 * Adds progress to every current quest that counts `metric`. Called from the real event (a claimed
 * session, a reviewed card, a won battle), inside that event's transaction, so progress is derived from
 * things that actually happened and can never be set by the client.
 */
export async function recordQuestEvent(
  tx: Prisma.TransactionClient,
  userId: string,
  metric: QuestMetric,
  amount: number,
  now: Date,
): Promise<void> {
  if (amount <= 0) return;
  const defs = await tx.questDefinition.findMany({ where: { metric } });
  for (const d of defs) {
    const key = periodKey(d.period, now);
    await tx.playerQuest.createMany({
      data: [{ userId, questId: d.id, periodKey: key }],
      skipDuplicates: true,
    });
    await tx.playerQuest.updateMany({
      where: { userId, questId: d.id, periodKey: key },
      data: { progress: { increment: amount } },
    });
  }
}

export async function listQuests(
  prisma: PrismaClient,
  userId: string,
  now: Date,
): Promise<QuestDto[]> {
  await prisma.$transaction(async (tx) => ensureQuestInstances(tx, userId, now));
  const keys = [periodKey('daily', now), periodKey('weekly', now)];
  const rows = await prisma.playerQuest.findMany({
    where: { userId, periodKey: { in: keys } },
    include: { quest: true },
  });
  return rows
    .filter((r) => r.periodKey === periodKey(r.quest.period, now))
    .sort(
      (a, b) =>
        a.quest.period.localeCompare(b.quest.period) || a.quest.slug.localeCompare(b.quest.slug),
    )
    .map((r) => toQuestDto(r, now));
}

async function progressDto(db: Db, userId: string): Promise<ProgressDto> {
  return toProgressDto(await db.playerProgress.findUniqueOrThrow({ where: { userId } }));
}

/**
 * Claim is idempotent: the claim marker flips once (conditional update), and the XP goes through the
 * ledger with source "quest:<definition>:<period>", so a repeat or a race pays exactly once.
 */
export async function claimQuest(
  prisma: PrismaClient,
  userId: string,
  playerQuestId: string,
  now: Date,
): Promise<QuestClaimResultDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const row = await tx.playerQuest.findFirst({
      where: { id: playerQuestId, userId },
      include: { quest: true },
    });
    if (!row) throw new AppError(404, 'QUEST_NOT_FOUND', 'Quest not found');
    const alreadyClaimed = row.claimedAt !== null;
    if (alreadyClaimed) {
      return {
        quest: toQuestDto(row, now),
        alreadyClaimed: true,
        xp: 0,
        energy: 0,
        levelsGained: 0,
        progress: await progressDto(tx, userId),
      };
    }
    if (row.progress < row.quest.target)
      throw new AppError(409, 'QUEST_NOT_COMPLETE', 'This quest is not finished yet');

    const flipped = await tx.playerQuest.updateMany({
      where: { id: row.id, userId, claimedAt: null },
      data: { claimedAt: now },
    });
    if (flipped.count === 0) {
      const again = await tx.playerQuest.findFirstOrThrow({
        where: { id: row.id, userId },
        include: { quest: true },
      });
      return {
        quest: toQuestDto(again, now),
        alreadyClaimed: true,
        xp: 0,
        energy: 0,
        levelsGained: 0,
        progress: await progressDto(tx, userId),
      };
    }
    const grant = await grantXp(
      {
        userId,
        amount: row.quest.rewardXp,
        reason: `Quest: ${row.quest.title}`.slice(0, 120),
        sourceType: 'quest',
        sourceId: `${row.questId}:${row.periodKey}`,
      },
      tx,
    );
    await addEnergy(tx, userId, row.quest.rewardEnergy);
    await touchStreak(tx, userId, now);
    const fresh = await tx.playerQuest.findFirstOrThrow({
      where: { id: row.id, userId },
      include: { quest: true },
    });
    return {
      quest: toQuestDto(fresh, now),
      alreadyClaimed: false,
      xp: grant.amount,
      energy: row.quest.rewardEnergy,
      levelsGained: grant.levelsGained,
      progress: await progressDto(tx, userId),
    };
  });
}
