import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { buildSummary } from './services/summary.js';
import { buildTestApp, noDb } from './test/app.js';

const now = new Date('2026-10-23T10:00:00.000Z'); // a Friday; ISO week 2026-W43
const base = { now, dueCards: 0, energy: 0, skillPoints: 0, quests: [], openSession: null };
const quest = (over: Partial<{ progress: number; claimedAt: Date | null; periodKey: string; period: 'daily' | 'weekly'; target: number }> = {}) => ({
  progress: over.progress ?? 3,
  claimedAt: over.claimedAt ?? null,
  periodKey: over.periodKey ?? '2026-10-23',
  quest: { period: over.period ?? 'daily', target: over.target ?? 3 },
});
const session = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  status: 'running' as const,
  startedAt: new Date(now.getTime() - 5 * 60_000),
  pausedAt: null,
  pausedTotalSec: 0,
  finishedAt: null,
  plannedMinutes: 25,
  ...over,
});

describe('buildSummary (pure)', () => {
  it('passes the plain counts through and stamps the server time', () => {
    const s = buildSummary({ ...base, dueCards: 12, energy: 4, skillPoints: 2 });
    expect(s).toEqual({
      dueCards: 12,
      claimableQuests: 0,
      activeSession: null,
      energy: 4,
      unspentSkillPoints: 2,
      serverNow: now.toISOString(),
    });
  });

  it('counts only finished, unclaimed quests of the current day or week', () => {
    const s = buildSummary({
      ...base,
      quests: [
        quest(), // complete, unclaimed, today: counts
        quest({ progress: 2 }), // not finished yet
        quest({ claimedAt: new Date(now) }), // already claimed
        quest({ periodKey: '2026-10-22' }), // yesterday's instance
        quest({ period: 'weekly', periodKey: '2026-W43', target: 5, progress: 5 }), // counts
        quest({ period: 'weekly', periodKey: '2026-W42', target: 5, progress: 5 }), // last week
      ],
    });
    expect(s.claimableQuests).toBe(2);
  });

  it('reports a running session with the seconds left, from server timestamps only', () => {
    const s = buildSummary({ ...base, openSession: session() });
    expect(s.activeSession).toEqual({
      id: 's1',
      status: 'running',
      startedAt: new Date(now.getTime() - 5 * 60_000).toISOString(),
      pausedAt: null,
      plannedSeconds: 1500,
      pausedTotalSec: 0,
      remainingSec: 1200,
    });
  });

  it('takes paused time out of the elapsed time, and freezes a paused session at the pause moment', () => {
    const running = buildSummary({ ...base, openSession: session({ pausedTotalSec: 60 }) });
    expect(running.activeSession?.remainingSec).toBe(1260);
    const paused = buildSummary({
      ...base,
      openSession: session({ status: 'paused', pausedAt: new Date(now.getTime() - 2 * 60_000) }),
    });
    expect(paused.activeSession).toMatchObject({ status: 'paused', remainingSec: 1320 });
    // a minute later the paused session has not moved
    const later = buildSummary({
      ...base,
      now: new Date(now.getTime() + 60_000),
      openSession: session({ status: 'paused', pausedAt: new Date(now.getTime() - 2 * 60_000) }),
    });
    expect(later.activeSession?.remainingSec).toBe(1320);
  });

  it('never reports a negative time, and ignores sessions that are not live', () => {
    const over = buildSummary({ ...base, openSession: session({ startedAt: new Date(now.getTime() - 40 * 60_000) }) });
    expect(over.activeSession?.remainingSec).toBe(0);
    expect(buildSummary({ ...base, openSession: session({ status: 'finished' }) }).activeSession).toBeNull();
    expect(buildSummary({ ...base, openSession: session({ startedAt: null }) }).activeSession).toBeNull();
  });
});

describe('GET /summary requires sign-in (before any database access)', () => {
  let app: Express;
  beforeAll(async () => {
    ({ app } = await buildTestApp(noDb));
  });
  it('rejects a missing token with 401', async () => {
    const res = await request(app).get('/api/v1/summary');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });
});
