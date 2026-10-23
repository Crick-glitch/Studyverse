import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { sessionBaseXp } from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const MIN = 60_000;

describe.skipIf(!hasTestDb)('study sessions (PostgreSQL, injected clock)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  let now = new Date('2026-10-23T10:00:00.000Z');
  const advance = (ms: number) => {
    now = new Date(now.getTime() + ms);
  };

  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    ({ app, keys } = await buildTestApp(prisma, {}, () => now));
  });
  afterAll(() => prisma.$disconnect());

  async function player() {
    const id = await newPlayer(prisma);
    return { id, api: client(app, keys, id) };
  }
  type Api = Awaited<ReturnType<typeof player>>['api'];

  async function newSession(api: Api, minutes = 10, difficulty = 'medium', subject = 'Math') {
    const res = await api.post('/sessions', { title: 'Calc', subject, difficulty, plannedMinutes: minutes });
    expect(res.status).toBe(201);
    return res.body.session.id as string;
  }
  async function runToFinish(api: Api, id: string, minutes: number, focusRatio?: number) {
    expect((await api.post(`/sessions/${id}/start`)).status).toBe(200);
    advance(minutes * MIN);
    return api.post(`/sessions/${id}/finish`, focusRatio === undefined ? {} : { focusRatio });
  }
  /** The test reads the answers from the DB; the browser never can before submitting. */
  async function answerKey(sessionId: string) {
    return prisma.sessionClaimQuestion.findMany({ where: { sessionId }, orderBy: { position: 'asc' } });
  }
  const answers = (key: { position: number; correctIndex: number; choices: string[] }[], right: number) =>
    key.map((q, i) => ({
      position: q.position,
      selectedIndex: i < right ? q.correctIndex : (q.correctIndex + 1) % q.choices.length,
    }));

  it('full lifecycle: create, start, finish, claim quiz, claim pays once through the ledger', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api);
    const fin = await runToFinish(api, id, 11);
    expect(fin.status).toBe(200);
    expect(fin.body).toMatchObject({ claimable: true, ineligibleReason: null });
    expect(fin.body.session.status).toBe('finished');

    const key = await answerKey(id);
    expect(key).toHaveLength(5);
    const res = await api.post(`/sessions/${id}/claim`, { answers: answers(key, 5) });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ passed: true, correct: 5, total: 5, alreadyClaimed: false });
    expect(res.body.xpAwarded).toBe(sessionBaseXp(10, 'medium', 0));
    expect(res.body.energyAwarded).toBe(1);
    expect(res.body.session.status).toBe('claimed');
    expect(res.body.progress.totalXp).toBe(res.body.xpAwarded);
    expect(res.body.progress.studyEnergy).toBe(1);
    expect(res.body.progress.streak).toBe(1);
    const ledger = await prisma.xpTransaction.findMany({ where: { userId, sourceType: 'session' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]?.sourceId).toBe(id);
  });

  it('server elapsed time decides: under 80% of the plan pays nothing and says why', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api, 10);
    const fin = await runToFinish(api, id, 7); // 70%
    expect(fin.body).toMatchObject({ claimable: false, ineligibleReason: 'not_enough_time' });
    expect(fin.body.session).toMatchObject({ status: 'abandoned', outcomeReason: 'not_enough_time', xpAwarded: 0 });
    expect((await api.post(`/sessions/${id}/claim`, { answers: [] })).status).toBe(409);
    expect(await prisma.xpTransaction.count({ where: { userId } })).toBe(0);
  });

  it('exactly 80% of the plan is enough', async () => {
    const { api } = await player();
    const id = await newSession(api, 10);
    const fin = await runToFinish(api, id, 8);
    expect(fin.body.claimable).toBe(true);
  });

  it('paused time does not count, and a long pause cannot be used to cheat the timer', async () => {
    const { api } = await player();
    const id = await newSession(api, 10);
    await api.post(`/sessions/${id}/start`);
    advance(5 * MIN);
    expect((await api.post(`/sessions/${id}/pause`)).body.session.status).toBe('paused');
    advance(60 * MIN);
    const paused = (await api.get(`/sessions/${id}`)).body.session;
    expect(paused.elapsedSec).toBe(300); // frozen while paused
    await api.post(`/sessions/${id}/resume`);
    advance(1 * MIN);
    const fin = await api.post(`/sessions/${id}/finish`, {}); // 6 min of 10
    expect(fin.body.ineligibleReason).toBe('not_enough_time');
  });

  it('pause then resume then enough focus time is eligible', async () => {
    const { api } = await player();
    const id = await newSession(api, 10);
    await api.post(`/sessions/${id}/start`);
    advance(5 * MIN);
    await api.post(`/sessions/${id}/pause`);
    advance(30 * MIN);
    await api.post(`/sessions/${id}/resume`);
    advance(4 * MIN);
    const fin = await api.post(`/sessions/${id}/finish`, {});
    expect(fin.body.claimable).toBe(true);
    expect(fin.body.session.elapsedSec).toBe(540);
  });

  it('finish while paused ends the pause cleanly', async () => {
    const { api } = await player();
    const id = await newSession(api, 10);
    await api.post(`/sessions/${id}/start`);
    advance(9 * MIN);
    await api.post(`/sessions/${id}/pause`);
    advance(20 * MIN);
    const fin = await api.post(`/sessions/${id}/finish`, {});
    expect(fin.body.claimable).toBe(true);
    expect(fin.body.session.elapsedSec).toBe(540);
  });

  it('a client cannot claim a duration: unknown fields are rejected and the plan caps elapsed time', async () => {
    const { api } = await player();
    const id = await newSession(api, 10);
    await api.post(`/sessions/${id}/start`);
    advance(500 * MIN);
    const bad = await api.post(`/sessions/${id}/finish`, { elapsedSec: 99999 });
    expect(bad.status).toBe(400);
    const fin = await api.post(`/sessions/${id}/finish`, {});
    expect(fin.body.session.elapsedSec).toBe(600);
  });

  it('focus is advisory but clamped: below 0.5 pays nothing, 0.5-0.8 pays 75%, above 1 is clamped', async () => {
    const low = await player();
    const lowId = await newSession(low.api);
    expect((await runToFinish(low.api, lowId, 10, 0.3)).body.ineligibleReason).toBe('not_enough_focus');

    const mid = await player();
    const midId = await newSession(mid.api);
    await runToFinish(mid.api, midId, 10, 0.6);
    const key = await answerKey(midId);
    const res = await mid.api.post(`/sessions/${midId}/claim`, { answers: answers(key, 5) });
    expect(res.body.xpAwarded).toBe(Math.ceil(sessionBaseXp(10, 'medium', 0) * 0.75));

    const high = await player();
    const highId = await newSession(high.api);
    const fin = await runToFinish(high.api, highId, 10, 7);
    expect(fin.body.session.focusRatioReported).toBe(1);
  });

  it('pass needs 4 of 5; a fail still pays 50%', async () => {
    const pass = await player();
    const passId = await newSession(pass.api, 25);
    await runToFinish(pass.api, passId, 25);
    const k1 = await answerKey(passId);
    const r1 = await pass.api.post(`/sessions/${passId}/claim`, { answers: answers(k1, 4) });
    expect(r1.body).toMatchObject({ passed: true, correct: 4 });
    expect(r1.body.xpAwarded).toBe(sessionBaseXp(25, 'medium', 0));

    const fail = await player();
    const failId = await newSession(fail.api, 25);
    await runToFinish(fail.api, failId, 25);
    const k2 = await answerKey(failId);
    const r2 = await fail.api.post(`/sessions/${failId}/claim`, { answers: answers(k2, 3) });
    expect(r2.body).toMatchObject({ passed: false, correct: 3 });
    expect(r2.body.xpAwarded).toBe(Math.floor(sessionBaseXp(25, 'medium', 0) * 0.5));
    expect(r2.body.energyAwarded).toBe(1); // floor(2 * 0.5) = 1
  });

  it('skipping the quiz (no answers) counts as a fail, not as a cancel that keeps the session open', async () => {
    const { api } = await player();
    const id = await newSession(api);
    await runToFinish(api, id, 10);
    const res = await api.post(`/sessions/${id}/claim`, { answers: [] });
    expect(res.body).toMatchObject({ passed: false, correct: 0, alreadyClaimed: false });
    expect(res.body.xpAwarded).toBe(Math.floor(sessionBaseXp(10, 'medium', 0) * 0.5));
  });

  it('claiming twice pays once and returns the stored result', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api);
    await runToFinish(api, id, 10);
    const key = await answerKey(id);
    const first = await api.post(`/sessions/${id}/claim`, { answers: answers(key, 5) });
    // The second call tries different (wrong) answers: it must not re-grade or re-pay.
    const second = await api.post(`/sessions/${id}/claim`, { answers: answers(key, 0) });
    expect(second.status).toBe(200);
    expect(second.body.alreadyClaimed).toBe(true);
    expect(second.body.xpAwarded).toBe(first.body.xpAwarded);
    expect(second.body.correct).toBe(5);
    expect(second.body.progress.totalXp).toBe(first.body.progress.totalXp);
    expect(await prisma.xpTransaction.count({ where: { userId, sourceType: 'session' } })).toBe(1);
  });

  it('concurrent claims pay exactly once', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api);
    await runToFinish(api, id, 10);
    const key = await answerKey(id);
    const body = { answers: answers(key, 5) };
    const results = await Promise.all(Array.from({ length: 6 }, () => api.post(`/sessions/${id}/claim`, body)));
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.alreadyClaimed === false)).toHaveLength(1);
    expect(await prisma.xpTransaction.count({ where: { userId, sourceType: 'session' } })).toBe(1);
    const progress = await prisma.playerProgress.findUniqueOrThrow({ where: { userId } });
    expect(progress.totalXp).toBe(sessionBaseXp(10, 'medium', 0));
    expect(progress.studyEnergy).toBe(1);
  });

  it('the claim quiz never leaks answers before it is submitted', async () => {
    const { api } = await player();
    const id = await newSession(api);
    const fin = await runToFinish(api, id, 10);
    const quiz = await api.get(`/sessions/${id}/claim`);
    expect(quiz.status).toBe(200);
    expect(quiz.body.questions).toHaveLength(5);
    const everything = JSON.stringify([fin.body, quiz.body, (await api.get(`/sessions/${id}`)).body, (await api.get('/sessions/active')).body]);
    expect(everything).not.toMatch(/correctIndex|correct"|explanation|selectedIndex/);
    for (const q of quiz.body.questions) {
      expect(Object.keys(q).sort()).toEqual(['choices', 'position', 'text']);
      expect(q.choices).toHaveLength(3);
    }
    // After submitting, the result DOES reveal them.
    const key = await answerKey(id);
    const res = await api.post(`/sessions/${id}/claim`, { answers: answers(key, 5) });
    expect(res.body.questions[0]).toHaveProperty('correctIndex');
  });

  it('the quiz is stable across refreshes (a snapshot), choices are shuffled copies of bank questions', async () => {
    const { api } = await player();
    const id = await newSession(api, 10, 'hard', 'Science');
    await runToFinish(api, id, 10);
    const a = await api.get(`/sessions/${id}/claim`);
    const b = await api.get(`/sessions/${id}/claim`);
    expect(b.body.questions).toEqual(a.body.questions);
    const rows = await answerKey(id);
    for (const r of rows) {
      const q = await prisma.question.findUniqueOrThrow({ where: { id: r.questionId as string } });
      expect(r.choices.slice().sort()).toEqual(q.choices.slice().sort());
      expect(r.choices[r.correctIndex]).toBe(q.choices[q.correctIndex]);
    }
  });

  it("another player's session is not addressable (404 everywhere)", async () => {
    const alice = await player();
    const bob = await player();
    const id = await newSession(alice.api);
    for (const [m, p] of [
      ['get', `/sessions/${id}`],
      ['post', `/sessions/${id}/start`],
      ['post', `/sessions/${id}/pause`],
      ['post', `/sessions/${id}/finish`],
      ['get', `/sessions/${id}/claim`],
      ['post', `/sessions/${id}/abandon`],
      ['delete', `/sessions/${id}`],
    ] as const) {
      const res = await (m === 'get' ? bob.api.get(p) : m === 'delete' ? bob.api.del(p) : bob.api.post(p, {}));
      expect(res.status, `${m} ${p}`).toBe(404);
    }
    const claim = await bob.api.post(`/sessions/${id}/claim`, { answers: [] });
    expect(claim.status).toBe(404);
    expect((await alice.api.get(`/sessions/${id}`)).status).toBe(200);
  });

  it('only one session runs at a time; a stale one is abandoned automatically', async () => {
    const { api } = await player();
    const a = await newSession(api);
    const b = await newSession(api);
    await api.post(`/sessions/${a}/start`);
    const blocked = await api.post(`/sessions/${b}/start`);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('SESSION_ALREADY_RUNNING');
    advance(25 * 60 * MIN); // 25 hours of nobody touching it
    const ok = await api.post(`/sessions/${b}/start`);
    expect(ok.status).toBe(200);
    const first = (await api.get(`/sessions/${a}`)).body.session;
    expect(first).toMatchObject({ status: 'abandoned', outcomeReason: 'stale' });
  });

  it('starting twice (double click) is harmless', async () => {
    const { api } = await player();
    const id = await newSession(api);
    const [x, y] = await Promise.all([api.post(`/sessions/${id}/start`), api.post(`/sessions/${id}/start`)]);
    expect([x.status, y.status]).toEqual([200, 200]);
    expect(x.body.session.startedAt).toBe(y.body.session.startedAt);
  });

  it('after a refresh GET /sessions/active resumes the countdown from SERVER time', async () => {
    const { api } = await player();
    const id = await newSession(api, 25);
    await api.post(`/sessions/${id}/start`);
    advance(10 * MIN);
    const active = await api.get('/sessions/active');
    expect(active.body.session).toMatchObject({ id, status: 'running', elapsedSec: 600, remainingSec: 900 });
    expect(active.body.serverNow).toBe(now.toISOString());
    // finished-but-unclaimed sessions are offered too, so a refresh during the quiz does not lose it
    advance(15 * MIN);
    await api.post(`/sessions/${id}/finish`, {});
    const again = await api.get('/sessions/active');
    expect(again.body.session).toMatchObject({ id, status: 'finished' });
    const key = await answerKey(id);
    await api.post(`/sessions/${id}/claim`, { answers: answers(key, 5) });
    expect((await api.get('/sessions/active')).body.session).toBeNull();
  });

  it('abandon closes a session without reward; a claimed session cannot be abandoned', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api);
    await api.post(`/sessions/${id}/start`);
    const res = await api.post(`/sessions/${id}/abandon`);
    expect(res.body.session).toMatchObject({ status: 'abandoned' });
    expect(await prisma.xpTransaction.count({ where: { userId } })).toBe(0);

    const done = await newSession(api);
    await runToFinish(api, done, 10);
    await api.post(`/sessions/${done}/claim`, { answers: [] });
    expect((await api.post(`/sessions/${done}/abandon`)).status).toBe(409);
  });

  it('only a not-yet-started session can be deleted', async () => {
    const { api } = await player();
    const waiting = await newSession(api);
    expect((await api.del(`/sessions/${waiting}`)).status).toBe(204);
    const started = await newSession(api);
    await api.post(`/sessions/${started}/start`);
    expect((await api.del(`/sessions/${started}`)).status).toBe(409);
  });

  it('validates the plan: only 10/25/50 minutes, known subjects', async () => {
    const { api } = await player();
    expect((await api.post('/sessions', { plannedMinutes: 7 })).status).toBe(400);
    expect((await api.post('/sessions', { plannedMinutes: 10, subject: 'Astrology' })).status).toBe(400);
    expect((await api.post('/sessions', { plannedMinutes: 10, userId: 'x' })).status).toBe(400);
    const ok = await api.post('/sessions', { plannedMinutes: 25 });
    expect(ok.body.session).toMatchObject({ title: 'Study session', subject: 'Other', difficulty: 'medium', plannedMinutes: 25 });
  });

  it('a claimed session advances the daily and weekly quests it counts for', async () => {
    const { id: userId, api } = await player();
    const id = await newSession(api, 25);
    await runToFinish(api, id, 25);
    const key = await answerKey(id);
    await api.post(`/sessions/${id}/claim`, { answers: answers(key, 5) });
    const rows = await prisma.playerQuest.findMany({ where: { userId }, include: { quest: true } });
    const byMetric = Object.fromEntries(rows.map((r) => [r.quest.slug, r.progress]));
    expect(byMetric['daily-finish-session']).toBe(1);
    expect(byMetric['weekly-study-minutes']).toBe(25);
    expect(byMetric['daily-review-cards']).toBeUndefined();
  });

  it('the streak grows once per UTC day, not per session', async () => {
    const { id: userId, api } = await player();
    for (let i = 0; i < 2; i++) {
      const id = await newSession(api);
      await runToFinish(api, id, 10);
      await api.post(`/sessions/${id}/claim`, { answers: [] });
    }
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId } })).streak).toBe(1);
    advance(24 * 60 * MIN);
    const id = await newSession(api);
    await runToFinish(api, id, 10);
    const res = await api.post(`/sessions/${id}/claim`, { answers: [] });
    expect(res.body.progress.streak).toBe(2);
  });

  describe('review sessions from due flashcards', () => {
    async function seedCards(userId: string, n: number) {
      const deck = await prisma.flashcardDeck.create({ data: { userId, name: 'Capitals', subject: 'Other' } });
      const cities = ['Paris', 'Rome', 'Madrid', 'Lisbon', 'Berlin', 'Vienna', 'Oslo', 'Prague'];
      const countries = ['France', 'Italy', 'Spain', 'Portugal', 'Germany', 'Austria', 'Norway', 'Czechia'];
      for (let i = 0; i < n; i++)
        await prisma.flashcard.create({
          data: { deckId: deck.id, userId, question: `Capital of ${countries[i]}?`, answer: cities[i] as string, subject: 'Other', dueAt: new Date(now.getTime() - 1000) },
        });
      return deck;
    }

    it('needs due cards', async () => {
      const { api } = await player();
      const res = await api.post('/sessions/review', {});
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NO_DUE_CARDS');
    });

    it('builds the quiz from the due cards (3 choices, no placeholders), claims, and schedules the cards', async () => {
      const { id: userId, api } = await player();
      await seedCards(userId, 8);
      const created = await api.post('/sessions/review', { startNow: true });
      expect(created.status).toBe(201);
      const s = created.body.session;
      expect(s).toMatchObject({ kind: 'review', status: 'running', subject: 'Flashcards', plannedMinutes: 5 });

      const rows = await answerKey(s.id);
      expect(rows).toHaveLength(5);
      for (const r of rows) {
        expect(r.cardId).not.toBeNull();
        expect(r.choices).toHaveLength(3);
        expect(r.choices.every((c) => c.trim() !== '' && !/^n\/?a$/i.test(c))).toBe(true);
        expect(new Set(r.choices).size).toBe(3);
      }
      advance(5 * MIN);
      expect((await api.post(`/sessions/${s.id}/finish`, {})).body.claimable).toBe(true);
      const res = await api.post(`/sessions/${s.id}/claim`, { answers: answers(rows, 4) });
      expect(res.body).toMatchObject({ passed: true, correct: 4 });

      const reviews = await prisma.flashcardReview.findMany({ where: { userId } });
      expect(reviews).toHaveLength(5);
      expect(reviews.every((r) => r.context === 'session')).toBe(true);
      expect(reviews.filter((r) => r.correct)).toHaveLength(4);
      const cardIds = rows.map((r) => r.cardId as string);
      const cards = await prisma.flashcard.findMany({ where: { id: { in: cardIds } } });
      expect(cards.every((c) => c.dueAt.getTime() > now.getTime())).toBe(true);
      const q = await prisma.playerQuest.findFirst({ where: { userId, quest: { slug: 'daily-review-cards' } } });
      expect(q?.progress).toBe(5);

      // claiming again does not schedule the cards a second time
      await api.post(`/sessions/${s.id}/claim`, { answers: [] });
      expect(await prisma.flashcardReview.count({ where: { userId } })).toBe(5);
    });

    it('only the named deck is used, and another player cannot use your deck', async () => {
      const alice = await player();
      const bob = await player();
      const deck = await seedCards(alice.id, 6);
      expect((await bob.api.post('/sessions/review', { deckId: deck.id })).status).toBe(404);
      const own = await alice.api.post('/sessions/review', { deckId: deck.id });
      expect(own.status).toBe(201);
      expect(own.body.session.title).toBe('Review: Capitals');
    });

    it('cards that cannot form 3 plausible choices are skipped and the quiz is topped up from the bank', async () => {
      const { id: userId, api } = await player();
      const deck = await prisma.flashcardDeck.create({ data: { userId, name: 'Tiny', subject: 'Math' } });
      // Only ONE card in the whole account: it has no wrong answers to borrow, so it cannot be a quiz item.
      await prisma.flashcard.create({
        data: { deckId: deck.id, userId, question: 'Lonely?', answer: 'yes', subject: 'Math', distractors: ['N/A', ''], dueAt: new Date(now.getTime() - 1000) },
      });
      const res = await api.post('/sessions/review', {});
      expect(res.status).toBe(201);
      const rows = await answerKey(res.body.session.id);
      expect(rows).toHaveLength(5);
      expect(rows.every((r) => r.cardId === null && r.questionId !== null)).toBe(true);
    });
  });
});
