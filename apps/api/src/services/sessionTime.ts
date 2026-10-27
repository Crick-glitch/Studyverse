import type { StudySession } from '../generated/prisma/client.js';

export type TimedSession = Pick<
  StudySession,
  'status' | 'startedAt' | 'pausedAt' | 'pausedTotalSec' | 'finishedAt' | 'plannedMinutes'
>;

/**
 * Seconds of focus time so far, measured with SERVER timestamps only: (end - start) minus paused time,
 * capped at the plan. `end` is now while running, the pause moment while paused, finishedAt afterwards.
 * (Kept in its own module so the summary can use it without importing the whole sessions service.)
 */
export function sessionElapsedSec(s: TimedSession, now: Date): number {
  if (!s.startedAt) return 0;
  const endMs =
    s.status === 'running'
      ? now.getTime()
      : s.status === 'paused'
        ? (s.pausedAt ?? now).getTime()
        : (s.finishedAt ?? now).getTime();
  const raw = Math.floor((endMs - s.startedAt.getTime()) / 1000) - s.pausedTotalSec;
  return Math.max(0, Math.min(s.plannedMinutes * 60, raw));
}
