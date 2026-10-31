import { allDungeonStatuses, isBossSlug, levelFromTotalXp, type UnlockFacts } from '@studyverse/shared';
import type { Db } from '../lib/prisma.js';

/**
 * Unlock progress is DERIVED from `Battle` rows (04 "unlock rules"): a boss counts as defeated when the player
 * has a RAID victory over it, and the boss gate counts raid victories over regular enemies in that dungeon.
 * Practice never counts. Nothing about unlocks is stored.
 */
export async function loadUnlockFacts(db: Db, userId: string): Promise<UnlockFacts> {
  const [progress, groups] = await Promise.all([
    db.playerProgress.findUnique({ where: { userId }, select: { totalXp: true } }),
    db.battle.groupBy({
      by: ['enemySlug', 'tier'],
      where: { userId, mode: 'raid', status: 'victory' },
      _count: { _all: true },
    }),
  ]);
  const defeatedBosses: string[] = [];
  const raidWinsByTier: Record<number, number> = {};
  for (const g of groups) {
    if (isBossSlug(g.enemySlug)) defeatedBosses.push(g.enemySlug);
    else raidWinsByTier[g.tier] = (raidWinsByTier[g.tier] ?? 0) + g._count._all;
  }
  return { level: levelFromTotalXp(progress?.totalXp ?? 0).level, defeatedBosses, raidWinsByTier };
}

export { allDungeonStatuses };
