import { BALANCE, periodKey, type SummaryDto } from '@studyverse/shared';
import type { StudySession } from '../generated/prisma/client.js';
import type { PrismaClient } from '../lib/prisma.js';
import { ensurePlayer } from './player.js';
import { sessionElapsedSec } from './sessionTime.js';

type OpenSessionRow = Pick<
  StudySession,
  'id' | 'status' | 'startedAt' | 'pausedAt' | 'pausedTotalSec' | 'finishedAt' | 'plannedMinutes'
>;
interface QuestRow {
  progress: number;
  claimedAt: Date | null;
  periodKey: string;
  quest: { period: 'daily' | 'weekly'; target: number };
}

/**
 * Pure part of the summary: turns rows the service has read into the DTO. Kept free of Prisma so a plain
 * unit test can feed it rows (the database parts are covered by the integration test).
 */
export function buildSummary(input: {
  now: Date;
  dueCards: number;
  energy: number;
  skillPoints: number;
  quests: readonly QuestRow[];
  openSession: OpenSessionRow | null;
}): SummaryDto {
  const { now, openSession: s } = input;
  // A quest counts only for the day/week it belongs to now; rows from an earlier period are history.
  const claimableQuests = input.quests.filter(
    (r) =>
      r.claimedAt === null &&
      r.periodKey === periodKey(r.quest.period, now) &&
      r.progress >= r.quest.target,
  ).length;

  const live = s && s.startedAt && (s.status === 'running' || s.status === 'paused');
  const activeSession: SummaryDto['activeSession'] = live
    ? {
        id: s.id,
        status: s.status as 'running' | 'paused',
        startedAt: (s.startedAt as Date).toISOString(),
        pausedAt: s.pausedAt?.toISOString() ?? null,
        plannedSeconds: s.plannedMinutes * 60,
        pausedTotalSec: s.pausedTotalSec,
        remainingSec: Math.max(0, s.plannedMinutes * 60 - sessionElapsedSec(s, now)),
      }
    : null;

  return {
    dueCards: input.dueCards,
    claimableQuests,
    activeSession,
    energy: input.energy,
    unspentSkillPoints: input.skillPoints,
    serverNow: now.toISOString(),
  };
}

/**
 * Counts for the hotbar and HUD. Read-only (no quest rows are created, no stale session is abandoned: a
 * session older than `staleOpenHours` is simply not reported), derived from existing tables, and every
 * query is filtered by the verified user id.
 */
export async function getSummary(prisma: PrismaClient, userId: string, now: Date): Promise<SummaryDto> {
  const { progress } = await ensurePlayer(prisma, userId);
  const staleBefore = new Date(now.getTime() - BALANCE.sessions.staleOpenHours * 3_600_000);
  const [dueCards, quests, openSession] = await Promise.all([
    prisma.flashcard.count({ where: { userId, dueAt: { lte: now } } }),
    prisma.playerQuest.findMany({
      where: {
        userId,
        claimedAt: null,
        periodKey: { in: [periodKey('daily', now), periodKey('weekly', now)] },
      },
      select: { progress: true, claimedAt: true, periodKey: true, quest: { select: { period: true, target: true } } },
    }),
    prisma.studySession.findFirst({
      where: {
        userId,
        status: { in: ['running', 'paused'] },
        // same rule as abandonStale, applied as a filter instead of a write
        OR: [
          { status: 'running', startedAt: { gte: staleBefore } },
          { status: 'paused', pausedAt: { gte: staleBefore } },
        ],
      },
      orderBy: { startedAt: 'desc' },
    }),
  ]);
  return buildSummary({
    now,
    dueCards,
    energy: progress.studyEnergy,
    skillPoints: progress.skillPoints,
    quests,
    openSession,
  });
}
