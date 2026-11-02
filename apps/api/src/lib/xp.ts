import { BALANCE, levelFromTotalXp, startOfUtcDay } from '@studyverse/shared';
import { AppError } from './errors.js';
import { Prisma, type Db, type PrismaClient } from './prisma.js';

export interface GrantXpInput {
  userId: string;
  /** Positive whole number. */
  amount: number;
  reason: string;
  /** What paid out: 'task', 'session', 'battle', 'quest', 'legacy_import' ... */
  sourceType: string;
  /** Id of the thing that paid out. (userId, sourceType, sourceId) is unique in the ledger. */
  sourceId: string;
  /** Imported/legacy/self-reported/practice XP is not verified and must not rank on the leaderboard. */
  leaderboardEligible?: boolean;
  /**
   * Optional daily cap shared by the `group` of source types: today's (UTC) ledger amounts over the group are
   * summed under the player lock and only the remainder is awarded. The ledger row is written even for 0 XP.
   */
  dailyCap?: { group: readonly string[]; amount: number };
  /** Clock for the cap's UTC day and the ledger timestamp (tests); defaults to the real time. */
  now?: Date;
}

export interface GrantXpResult {
  /** false when this source had already been paid (nothing changed). */
  granted: boolean;
  /** XP actually awarded (can be 0 when a daily cap was already reached). */
  amount: number;
  /** XP that was asked for. Equals `amount` unless `capped`. */
  requested: number;
  /** true when the daily cap reduced the award. */
  capped: boolean;
  levelsGained: number;
  skillPointsAwarded: number;
  /** Player progress after the call (the current state, also when the grant was a repeat). */
  progress: {
    level: number;
    totalXp: number;
    currentLevelXp: number;
    skillPoints: number;
  };
}

/**
 * THE only way XP is ever added (00-master-context hard rule 2).
 *
 * In one transaction: lock the player's progress row (serialises that player's grants), insert the
 * ledger row (unique source), update progress, handle level-ups, award skill points. If the source was
 * already paid, nothing changes and the ORIGINAL outcome is returned with `granted: false`.
 *
 * Pass a transaction client as `db` to make the grant part of a larger transaction (e.g. battle finish).
 */
export async function grantXp(input: GrantXpInput, db: Db): Promise<GrantXpResult> {
  if (!Number.isInteger(input.amount) || input.amount <= 0) {
    throw new AppError(500, 'INVALID_XP_AMOUNT', 'XP amount must be a positive whole number');
  }
  const run = (tx: Prisma.TransactionClient) => grantInTransaction(input, tx);
  return '$transaction' in db ? (db as PrismaClient).$transaction(run) : run(db);
}

async function grantInTransaction(
  input: GrantXpInput,
  tx: Prisma.TransactionClient,
): Promise<GrantXpResult> {
  const { userId, amount: requested, reason, sourceType, sourceId } = input;

  // Make sure the progress row exists, then lock it. Locking first means two concurrent grants for the
  // same player queue up instead of overwriting each other's totals.
  await tx.playerProgress.createMany({ data: [{ userId }], skipDuplicates: true });
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "PlayerProgress" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
  if (locked.length === 0) {
    // Only possible if the profile row itself does not exist (FK would have rejected the insert).
    throw new AppError(404, 'PROFILE_NOT_FOUND', 'Player profile not found');
  }

  const before = await tx.playerProgress.findUniqueOrThrow({ where: { userId } });
  const now = input.now ?? new Date();

  // Daily cap: the player row is locked, so this sum cannot race with another grant for the same player.
  let amount = requested;
  if (input.dailyCap) {
    const dayStart = startOfUtcDay(now);
    const used = await tx.xpTransaction.aggregate({
      where: {
        userId,
        sourceType: { in: [...input.dailyCap.group] },
        createdAt: { gte: dayStart, lt: new Date(dayStart.getTime() + 86_400_000) },
      },
      _sum: { amount: true },
    });
    amount = Math.min(requested, Math.max(0, input.dailyCap.amount - (used._sum.amount ?? 0)));
  }
  const capped = amount < requested;
  const after = levelFromTotalXp(before.totalXp + amount);
  const levelsGained = Math.max(0, after.level - before.level);
  const skillPointsAwarded = levelsGained * BALANCE.levels.skillPointsPerLevel;

  // ON CONFLICT DO NOTHING on (userId, sourceType, sourceId): count 0 means "already paid".
  const inserted = await tx.xpTransaction.createMany({
    data: [
      {
        userId,
        amount,
        reason,
        sourceType,
        sourceId,
        leaderboardEligible: input.leaderboardEligible ?? true,
        createdAt: now,
        levelAfter: after.level,
        levelsGained,
        skillPointsAwarded,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count === 0) {
    const existing = await tx.xpTransaction.findUniqueOrThrow({
      where: { userId_sourceType_sourceId: { userId, sourceType, sourceId } },
    });
    return {
      granted: false,
      amount: existing.amount,
      requested: existing.amount,
      capped: false,
      levelsGained: existing.levelsGained,
      skillPointsAwarded: existing.skillPointsAwarded,
      progress: {
        level: before.level,
        totalXp: before.totalXp,
        currentLevelXp: before.currentLevelXp,
        skillPoints: before.skillPoints,
      },
    };
  }

  if (amount === 0) {
    // Capped to nothing: the ledger row above is the whole effect.
    return {
      granted: true,
      amount: 0,
      requested,
      capped,
      levelsGained: 0,
      skillPointsAwarded: 0,
      progress: {
        level: before.level,
        totalXp: before.totalXp,
        currentLevelXp: before.currentLevelXp,
        skillPoints: before.skillPoints,
      },
    };
  }

  const updated = await tx.playerProgress.update({
    where: { userId },
    data: {
      totalXp: before.totalXp + amount,
      level: after.level,
      currentLevelXp: after.currentLevelXp,
      skillPoints: { increment: skillPointsAwarded },
    },
  });

  return {
    granted: true,
    amount,
    requested,
    capped,
    levelsGained,
    skillPointsAwarded,
    progress: {
      level: updated.level,
      totalXp: updated.totalXp,
      currentLevelXp: updated.currentLevelXp,
      skillPoints: updated.skillPoints,
    },
  };
}
