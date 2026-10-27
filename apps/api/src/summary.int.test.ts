import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const MIN = 60_000;
/** The only keys a summary may contain: counts and one session timer. Nothing that names or describes content. */
const SUMMARY_KEYS = ['activeSession', 'claimableQuests', 'dueCards', 'energy', 'serverNow', 'unspentSkillPoints'];

describe.skipIf(!hasTestDb)('GET /summary (PostgreSQL, injected clock)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  const now = new Date('2026-10-23T10:00:00.000Z');

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
  const addCards = async (userId: string, due: number, notDue: number) => {
    const deck = await prisma.flashcardDeck.create({ data: { userId, name: 'Summary deck', subject: 'Math' } });
    const mk = (dueAt: Date, n: number) =>
      Array.from({ length: n }, (_, i) => ({ deckId: deck.id, userId, question: `q${i}`, answer: 'a', subject: 'Math', dueAt }));
    await prisma.flashcard.createMany({ data: [...mk(new Date(now.getTime() - MIN), due), ...mk(new Date(now.getTime() + 24 * 60 * MIN), notDue)] });
  };

  it('a brand-new player gets zeros and no session, with exactly the public count keys', async () => {
    const { api } = await player();
    const res = await api.get('/summary');
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual(SUMMARY_KEYS);
    expect(res.body).toMatchObject({ dueCards: 0, claimableQuests: 0, activeSession: null, energy: 0, unspentSkillPoints: 0 });
  });

  it('counts due cards only (not future ones) and reads energy and skill points', async () => {
    const { id, api } = await player();
    await addCards(id, 3, 4);
    await prisma.playerProgress.update({ where: { userId: id }, data: { studyEnergy: 5, skillPoints: 2 } });
    const body = (await api.get('/summary')).body;
    expect(body).toMatchObject({ dueCards: 3, energy: 5, unspentSkillPoints: 2 });
  });

  it('counts a completed, unclaimed quest, and stops counting it after the claim', async () => {
    const { api } = await player();
    const quests = (await api.get('/quests')).body.quests as { id: string; target: number; slug: string }[];
    const daily = quests.find((q) => q.slug === 'daily-finish-session');
    expect(daily).toBeTruthy();
    const q = await prisma.playerQuest.findUniqueOrThrow({ where: { id: daily!.id } });
    await prisma.playerQuest.update({ where: { id: q.id }, data: { progress: daily!.target } });
    expect((await api.get('/summary')).body.claimableQuests).toBe(1);
    await api.post(`/quests/${daily!.id}/claim`);
    expect((await api.get('/summary')).body.claimableQuests).toBe(0);
  });

  it('shows a running session with its remaining time, and nothing once it is finished or abandoned', async () => {
    const { api } = await player();
    const created = await api.post('/sessions', { title: 'Calc', subject: 'Math', difficulty: 'medium', plannedMinutes: 25 });
    const id = created.body.session.id as string;
    expect((await api.get('/summary')).body.activeSession).toBeNull(); // created, not started
    await api.post(`/sessions/${id}/start`);
    const live = (await api.get('/summary')).body.activeSession;
    expect(live).toMatchObject({ id, status: 'running', plannedSeconds: 1500, remainingSec: 1500, pausedAt: null });
    await api.post(`/sessions/${id}/abandon`);
    expect((await api.get('/summary')).body.activeSession).toBeNull();
  });

  it('does not report a session left open longer than the stale limit, and does not change it', async () => {
    const { id: userId, api } = await player();
    const created = await api.post('/sessions', { title: 'Old', subject: 'Math', difficulty: 'easy', plannedMinutes: 10 });
    const id = created.body.session.id as string;
    await api.post(`/sessions/${id}/start`);
    await prisma.studySession.update({ where: { id }, data: { startedAt: new Date(now.getTime() - 30 * 60 * MIN) } });
    expect((await api.get('/summary')).body.activeSession).toBeNull();
    expect((await prisma.studySession.findUniqueOrThrow({ where: { id } })).status).toBe('running'); // read-only
    expect(userId).toBeTruthy();
  });

  it("never includes another player's data", async () => {
    const a = await player();
    const b = await player();
    await addCards(a.id, 5, 0);
    await prisma.playerProgress.update({ where: { userId: a.id }, data: { studyEnergy: 9, skillPoints: 4 } });
    const created = await a.api.post('/sessions', { title: 'Mine', subject: 'Math', difficulty: 'medium', plannedMinutes: 10 });
    await a.api.post(`/sessions/${created.body.session.id}/start`);
    expect((await a.api.get('/summary')).body).toMatchObject({ dueCards: 5, energy: 9 });
    const theirs = (await b.api.get('/summary')).body;
    expect(theirs).toMatchObject({ dueCards: 0, claimableQuests: 0, activeSession: null, energy: 0, unspentSkillPoints: 0 });
  });
});
