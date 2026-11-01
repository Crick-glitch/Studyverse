import { BALANCE, DUNGEONS, dungeonStatus, getBoss, type DungeonsDto } from '@studyverse/shared';
import type { PrismaClient } from '../lib/prisma.js';
import { loadUnlockFacts } from './battleUnlocks.js';

/**
 * GET /dungeons: the region map. Everything is DERIVED (unlock rules from raid `Battle` rows, due cards from the
 * player's own cards); nothing is stored and only counts leave the server.
 */
export async function getDungeons(prisma: PrismaClient, userId: string, now: Date): Promise<DungeonsDto> {
  const [facts, progress, active, due] = await Promise.all([
    loadUnlockFacts(prisma, userId),
    prisma.playerProgress.findUnique({ where: { userId }, select: { studyEnergy: true } }),
    // an unfinished battle, or one that ended but whose rewards were never claimed
    prisma.battle.findFirst({
      where: { userId, OR: [{ status: 'active' }, { status: { in: ['victory', 'defeat'] }, rewardsGrantedAt: null }] },
      orderBy: { startedAt: 'desc' },
      select: { id: true },
    }),
    prisma.flashcard.groupBy({ by: ['subject'], where: { userId, dueAt: { lte: now } }, _count: { _all: true } }),
  ]);
  const dueBySubject: Record<string, number> = {};
  for (const g of due) dueBySubject[g.subject] = g._count._all;
  return {
    level: facts.level,
    energy: progress?.studyEnergy ?? 0,
    energyCost: BALANCE.raid.energyCost,
    dungeons: DUNGEONS.map((d) => {
      const st = dungeonStatus(d.tier, facts)!;
      return {
        tier: d.tier, slug: d.slug, name: d.name, background: d.background,
        open: st.dungeon.open, lockedReason: st.dungeon.reason,
        bossSlug: d.bossSlug, bossName: bossName(d.bossSlug),
        bossOpen: st.boss.open, bossLockedReason: st.boss.reason, bossDefeated: st.bossDefeated,
        raidWins: st.raidWins, raidWinsNeeded: st.raidWinsNeeded,
      };
    }),
    dueBySubject,
    activeBattleId: active?.id ?? null,
  };
}

const bossName = (slug: string): string => getBoss(slug)?.name ?? slug;
