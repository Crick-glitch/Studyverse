import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { BALANCE } from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { recordQuestEvent } from './services/quests.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

describe.skipIf(!hasTestDb)('tasks and quests (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  let now = new Date('2026-10-23T10:00:00.000Z');

  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    ({ app, keys } = await buildTestApp(prisma, {}, () => now));
  });
  afterAll(() => prisma.$disconnect());
  const player = async () => {
    const id = await newPlayer(prisma);
    return { id, api: client(app, keys, id) };
  };
  type Api = Awaited<ReturnType<typeof player>>['api'];
  const mk = async (api: Api, title = 'Read chapter 4', difficulty = 'medium') =>
    (await api.post('/tasks', { title, difficulty })).body.task.id as string;

  describe('tasks', () => {
    it('creates, lists with filters, and shows the reward BEFORE completion', async () => {
      const { api } = await player();
      await mk(api, 'a', 'easy');
      await mk(api, 'b', 'hard');
      const all = (await api.get('/tasks')).body.tasks;
      expect(all.map((t: { rewardXp: number }) => t.rewardXp).sort()).toEqual([10, 50]);
      expect((await api.get('/tasks?difficulty=hard')).body.tasks).toHaveLength(1);
      expect((await api.get('/tasks?status=completed')).body.tasks).toHaveLength(0);
    });

    it('completing pays once through the ledger; repeat, reopen and re-complete pay nothing', async () => {
      const { id: userId, api } = await player();
      const id = await mk(api);
      const first = await api.post(`/tasks/${id}/complete`);
      expect(first.body.reward).toMatchObject({ xp: 25, note: 'paid' });
      expect(first.body.progress.totalXp).toBe(25);
      expect((await api.post(`/tasks/${id}/complete`)).body.reward).toMatchObject({
        xp: 0,
        note: 'already_paid',
      });
      expect((await api.post(`/tasks/${id}/reopen`)).body.task.status).toBe('open');
      const again = await api.post(`/tasks/${id}/complete`);
      expect(again.body.reward).toMatchObject({ xp: 0, note: 'already_paid' });
      expect(again.body.progress.totalXp).toBe(25);
      expect(await prisma.xpTransaction.count({ where: { userId, sourceType: 'task' } })).toBe(1);
    });

    it('concurrent completions pay once', async () => {
      const { id: userId, api } = await player();
      const id = await mk(api, 'race', 'hard');
      const res = await Promise.all(
        Array.from({ length: 6 }, () => api.post(`/tasks/${id}/complete`)),
      );
      expect(res.every((r) => r.status === 200)).toBe(true);
      expect(res.filter((r) => r.body.reward.note === 'paid')).toHaveLength(1);
      expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId } })).totalXp).toBe(
        50,
      );
    });

    it(`only ${BALANCE.tasks.dailyRewardedCompletions} completions per UTC day pay (anti-farming); the rest still complete`, async () => {
      const { api } = await player();
      const notes: string[] = [];
      for (let i = 0; i < BALANCE.tasks.dailyRewardedCompletions + 2; i++) {
        const id = await mk(api, `t${i}`, 'easy');
        notes.push((await api.post(`/tasks/${id}/complete`)).body.reward.note);
      }
      expect(notes.filter((n) => n === 'paid')).toHaveLength(
        BALANCE.tasks.dailyRewardedCompletions,
      );
      expect(notes.slice(-2)).toEqual(['daily_cap_reached', 'daily_cap_reached']);
      expect((await api.get('/tasks?status=completed')).body.tasks).toHaveLength(
        BALANCE.tasks.dailyRewardedCompletions + 2,
      );
      // next UTC day: a task that did not pay can pay now
      const unpaid = (await api.get('/tasks?status=completed')).body.tasks.find(
        (t: { rewarded: boolean }) => !t.rewarded,
      );
      now = new Date(now.getTime() + 24 * 3600_000);
      await api.post(`/tasks/${unpaid.id}/reopen`);
      expect((await api.post(`/tasks/${unpaid.id}/complete`)).body.reward.note).toBe('paid');
    });

    it('a task that paid cannot change difficulty (no XP laundering)', async () => {
      const { api } = await player();
      const id = await mk(api, 'x', 'easy');
      await api.post(`/tasks/${id}/complete`);
      expect((await api.patch(`/tasks/${id}`, { difficulty: 'hard' })).status).toBe(409);
      expect((await api.patch(`/tasks/${id}`, { title: 'renamed' })).status).toBe(200);
    });

    it("someone else's task is 404 for every action, and ids/owners cannot be injected", async () => {
      const alice = await player();
      const bob = await player();
      const id = await mk(alice.api);
      expect((await bob.api.post(`/tasks/${id}/complete`)).status).toBe(404);
      expect((await bob.api.post(`/tasks/${id}/reopen`)).status).toBe(404);
      expect((await bob.api.patch(`/tasks/${id}`, { title: 'hax' })).status).toBe(404);
      expect((await bob.api.del(`/tasks/${id}`)).status).toBe(404);
      expect((await bob.api.get('/tasks')).body.tasks).toHaveLength(0);
      expect((await bob.api.post('/tasks', { title: 'x', userId: alice.id })).status).toBe(400);
      expect((await alice.api.get('/tasks')).body.tasks[0].title).toBe('Read chapter 4');
    });

    it('validates input and escapes nothing server-side (text is stored as plain text)', async () => {
      const { api } = await player();
      expect((await api.post('/tasks', { title: '   ' })).status).toBe(400);
      expect((await api.post('/tasks', { title: 'x', difficulty: 'epic' })).status).toBe(400);
      const t = (await api.post('/tasks', { title: '<img src=x onerror=alert(1)>' })).body.task;
      expect(t.title).toBe('<img src=x onerror=alert(1)>');
    });

    it('delete removes only the owner’s task', async () => {
      const { api } = await player();
      const id = await mk(api);
      expect((await api.del(`/tasks/${id}`)).status).toBe(204);
      expect((await api.get('/tasks')).body.tasks).toHaveLength(0);
    });
  });

  describe('quests', () => {
    it('lists this day’s and week’s quests with real progress (starts at 0)', async () => {
      const { api } = await player();
      const { quests } = (await api.get('/quests')).body;
      expect(quests.map((q: { slug: string }) => q.slug).sort()).toEqual([
        'daily-finish-session',
        'daily-review-cards',
        'daily-win-battle',
        'weekly-study-minutes',
        'weekly-win-battles',
      ]);
      expect(
        quests.every(
          (q: { progress: number; claimable: boolean }) => q.progress === 0 && !q.claimable,
        ),
      ).toBe(true);
    });

    const finishDailyBattle = async (userId: string) =>
      prisma.$transaction((tx) => recordQuestEvent(tx, userId, 'battles_won', 1, now));

    it('cannot claim before it is complete; claims pay once (XP via the ledger, plus energy)', async () => {
      const { id: userId, api } = await player();
      const q = (await api.get('/quests')).body.quests.find(
        (x: { slug: string }) => x.slug === 'daily-win-battle',
      );
      expect((await api.post(`/quests/${q.id}/claim`)).status).toBe(409);
      await finishDailyBattle(userId);
      const listed = (await api.get('/quests')).body.quests.find(
        (x: { slug: string }) => x.slug === 'daily-win-battle',
      );
      expect(listed).toMatchObject({ progress: 1, claimable: true, claimed: false });
      const claim = await api.post(`/quests/${q.id}/claim`);
      expect(claim.body).toMatchObject({ alreadyClaimed: false, xp: 30 });
      expect(claim.body.progress.totalXp).toBe(30);
      const again = await api.post(`/quests/${q.id}/claim`);
      expect(again.body).toMatchObject({ alreadyClaimed: true, xp: 0 });
      expect(again.body.progress.totalXp).toBe(30);
      expect(await prisma.xpTransaction.count({ where: { userId, sourceType: 'quest' } })).toBe(1);
    });

    it('concurrent claims pay once; the session quest also pays its energy once', async () => {
      const { id: userId, api } = await player();
      await prisma.$transaction((tx) => recordQuestEvent(tx, userId, 'sessions_claimed', 1, now));
      const q = (await api.get('/quests')).body.quests.find(
        (x: { slug: string }) => x.slug === 'daily-finish-session',
      );
      const res = await Promise.all(
        Array.from({ length: 5 }, () => api.post(`/quests/${q.id}/claim`)),
      );
      expect(res.filter((r) => r.body.alreadyClaimed === false)).toHaveLength(1);
      const p = await prisma.playerProgress.findUniqueOrThrow({ where: { userId } });
      expect(p).toMatchObject({ totalXp: 30, studyEnergy: 1 });
    });

    it('progress never exceeds the target in the display, and cannot be set by the client', async () => {
      const { id: userId, api } = await player();
      for (let i = 0; i < 3; i++) await finishDailyBattle(userId);
      const q = (await api.get('/quests')).body.quests.find(
        (x: { slug: string }) => x.slug === 'daily-win-battle',
      );
      expect(q.progress).toBe(1);
      expect((await api.patch(`/quests/${q.id}`, { progress: 99 })).status).toBe(404);
    });

    it('a new day brings a fresh daily instance; the weekly one carries on', async () => {
      const { id: userId, api } = await player();
      await finishDailyBattle(userId);
      const before = (await api.get('/quests')).body.quests;
      now = new Date(now.getTime() + 24 * 3600_000);
      const after = (await api.get('/quests')).body.quests;
      const daily = (qs: { slug: string; progress: number }[]) =>
        qs.find((x) => x.slug === 'daily-win-battle');
      expect(daily(before)?.progress).toBe(1);
      expect(daily(after)?.progress).toBe(0);
      const weekly = (qs: { slug: string; progress: number }[]) =>
        qs.find((x) => x.slug === 'weekly-win-battles');
      // Oct 23 2026 is a Friday and Oct 24 a Saturday: same ISO week, so weekly progress is kept.
      expect(weekly(after)?.progress).toBe(weekly(before)?.progress);
      expect(weekly(after)?.progress).toBe(1);
    });

    it("another player's quest cannot be claimed", async () => {
      const alice = await player();
      const bob = await player();
      await finishDailyBattle(alice.id);
      const q = (await alice.api.get('/quests')).body.quests.find(
        (x: { slug: string }) => x.slug === 'daily-win-battle',
      );
      expect((await bob.api.post(`/quests/${q.id}/claim`)).status).toBe(404);
    });
  });

  it('POST /questions/:id/report stores one report per player and question', async () => {
    const { id: userId, api } = await player();
    const q = await prisma.question.findFirstOrThrow({ where: { legacyId: 'hist-h-007' } });
    expect(q.needsReview).toBe(true);
    expect(
      (await api.post(`/questions/${q.id}/report`, { reason: 'choices do not answer it' })).status,
    ).toBe(201);
    expect((await api.post(`/questions/${q.id}/report`, { reason: 'still wrong' })).status).toBe(
      201,
    );
    const rows = await prisma.questionReport.findMany({ where: { userId } });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.reason).toBe('still wrong');
    expect((await api.post(`/questions/${crypto.randomUUID()}/report`, {})).status).toBe(404);
  });
});
