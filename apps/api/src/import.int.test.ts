import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import { LEGACY_EMOJI_TO_PRESET } from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { canonicalJson, payloadHash } from './services/importMap.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const MAGE = Object.keys(LEGACY_EMOJI_TO_PRESET).find((k) => LEGACY_EMOJI_TO_PRESET[k] === 'mage')!;

/** What the old app saved in localStorage['studyverse-data'] (shape taken from app.js). */
const oldData = () => ({
  level: 3,
  totalXP: 260,
  currentLevelXP: 10,
  streak: 9,
  lastActivityDate: 'Thu Oct 22 2026',
  totalTasksCompleted: 1,
  studyEnergy: 50,
  skillPoints: 40,
  raidWins: 12,
  raidLosses: 1,
  playerClass: 'warrior',
  avatarName: 'Hero One',
  avatarEmoji: MAGE,
  avatarImage: null,
  unlockedSkills: { power_strike: true, berserk: true, iron_skin: false },
  equipment: { weapon: { name: 'Iron Sword', attack: 3 }, armor: { name: 'Mystery Plate' } },
  tasks: [
    {
      id: '1',
      title: '  Read   ch 4 ',
      difficulty: 'hard',
      completed: true,
      createdDate: 'Wed Oct 21 2026',
    },
    {
      id: '2',
      title: 'Write essay',
      difficulty: 'easy',
      completed: false,
      createdDate: 'Thu Oct 22 2026',
    },
    { title: '', difficulty: 'easy', completed: false },
    'garbage',
  ],
  sessions: [
    {
      title: 'Calc',
      subject: 'Math',
      duration: 25,
      difficulty: 'medium',
      validated: true,
      xpEarned: 25,
      energyEarned: 2,
      completedDate: '2026-10-20T10:00:00.000Z',
      focusRatio: 0.9,
    },
    {
      title: 'Nap',
      subject: 'Other',
      duration: 10,
      difficulty: 'easy',
      validated: false,
      xpEarned: 0,
      energyEarned: 0,
      completedDate: null,
      focusRatio: 0.2,
    },
    { title: 'Bad', duration: -5 },
  ],
  flashcards: [
    {
      id: 'f1',
      question: 'Capital of Peru?',
      correct: 'Lima',
      answers: ['Lima', 'N/A', 'N/A'],
      subject: 'Other',
      ease: 2.5,
      interval: 0,
      repetitions: 0,
      nextReview: '2026-10-22T00:00:00.000Z',
    },
    {
      id: 'f2',
      question: 'Capital of Chile?',
      correct: 'Santiago',
      answers: ['Santiago', 'Quito', ''],
      subject: 'Other',
      ease: 2.1,
      interval: 6,
      repetitions: 2,
      nextReview: '2027-01-01T00:00:00.000Z',
    },
    { id: 'f3', question: '', correct: 'x', answers: [] },
  ],
  raidHistory: [{ boss: 'Orc Warlord', victory: true, date: '10/20/2026', level: 2 }],
});

describe.skipIf(!hasTestDb)('local-data import (PostgreSQL)', () => {
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

  it('imports into an empty account: XP once (not leaderboard-eligible), history, cards, skills, gear, profile', async () => {
    const { id: userId, api } = await player();
    expect((await api.get('/import/local/preflight')).body).toMatchObject({ hasProgress: false });
    const res = await api.post('/import/local', { payload: oldData() });
    expect(res.status).toBe(200);
    const r = res.body.report;
    expect(r.alreadyImported).toBe(false);
    expect(r.imported).toMatchObject({
      xp: 260,
      tasks: 2,
      sessions: 2,
      flashcards: 2,
      skills: 1,
      items: 1,
    });
    expect(r.imported.profileFields.sort()).toEqual(['avatar', 'class', 'name']);

    // XP: one ledger row, flagged out of the leaderboard; level recalculated by the new curve (260 >= 250)
    const ledger = await prisma.xpTransaction.findMany({ where: { userId } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({
      sourceType: 'legacy_import',
      amount: 260,
      leaderboardEligible: false,
    });
    expect(r.progress).toMatchObject({ level: 3, totalXp: 260 });
    // not trusted / not imported: energy, raid counters, skill points, streak
    const p = await prisma.playerProgress.findUniqueOrThrow({ where: { userId } });
    expect(p).toMatchObject({ studyEnergy: 0, raidWins: 0, raidLosses: 0, streak: 0 });
    // skill points re-derived: level 3 = 2 points; Power Strike (1) fits, Berserk (3) does not
    expect(p.skillPoints).toBe(1);
    const skills = await prisma.playerSkill.findMany({
      where: { userId },
      include: { skill: true },
    });
    expect(skills.map((s) => s.skill.slug)).toEqual(['power-strike']);
    expect(r.skipped.find((s: { what: string }) => s.what === 'skills')).toBeTruthy();

    // tasks: cleaned, bad ones skipped, completed one is already "rewarded"
    const tasks = await prisma.task.findMany({ where: { userId }, orderBy: { title: 'asc' } });
    expect(tasks.map((t) => t.title)).toEqual(['Read ch 4', 'Write essay']);
    expect(tasks[0]).toMatchObject({ status: 'completed' });
    expect(tasks[0]?.rewardedAt).not.toBeNull();
    const done = await api.post(`/tasks/${tasks[0]!.id}/complete`);
    expect(done.body.reward).toMatchObject({ xp: 0, note: 'already_paid' }); // no XP re-awarded

    // sessions: history only, no XP/energy
    const sessions = await prisma.studySession.findMany({ where: { userId } });
    expect(sessions).toHaveLength(2);
    expect(
      sessions.every(
        (s) => s.xpAwarded === 0 && s.energyAwarded === 0 && s.outcomeReason === 'imported',
      ),
    ).toBe(true);
    expect(sessions.map((s) => s.status).sort()).toEqual(['abandoned', 'claimed']);

    // flashcards: one deck, placeholders gone, schedule kept
    const deck = await prisma.flashcardDeck.findFirstOrThrow({ where: { userId } });
    expect(deck.name).toBe('Imported flashcards');
    const cards = await prisma.flashcard.findMany({
      where: { deckId: deck.id },
      orderBy: { question: 'asc' },
    });
    expect(cards.map((c) => c.distractors)).toEqual([[], ['Quito']].reverse());
    expect(cards.find((c) => c.answer === 'Santiago')).toMatchObject({
      intervalDays: 6,
      repetitions: 2,
      ease: 2.1,
    });
    expect(JSON.stringify(cards)).not.toMatch(/N\/A/);

    // gear and profile
    const eq = await prisma.equipment.findUniqueOrThrow({
      where: { userId },
      include: { weapon: { include: { itemDefinition: true } } },
    });
    expect(eq.weapon?.itemDefinition.slug).toBe('iron-sword');
    expect(eq.armorItemId).toBeNull();
    expect(r.skipped.some((s: { reason: string }) => /not an item/.test(s.reason))).toBe(true);
    const profile = await prisma.playerProfile.findUniqueOrThrow({ where: { id: userId } });
    expect(profile).toMatchObject({
      displayName: 'Hero One',
      playerClass: 'warrior',
      avatarKey: 'mage',
    });
    expect(profile.avatarUrl).toBeNull(); // images are not imported
    expect(r.notImported.join(' ')).toMatch(/Avatar images/);
    // the archive keeps the raid history out of the game but not lost
    const batch = await prisma.importBatch.findFirstOrThrow({ where: { userId } });
    expect(
      (batch.report as { archive: { raidHistory: unknown[] } }).archive.raidHistory,
    ).toHaveLength(1);
  });

  it('a retry of the same payload returns the earlier report and changes nothing (also when racing)', async () => {
    const { id: userId, api } = await player();
    const body = { payload: oldData() };
    const results = await Promise.all(
      Array.from({ length: 4 }, () => api.post('/import/local', body)),
    );
    expect(results.every((r) => r.status === 200)).toBe(true);
    expect(results.filter((r) => r.body.report.alreadyImported === false)).toHaveLength(1);
    const again = await api.post('/import/local', { payload: { ...oldData() } });
    expect(again.body.report.alreadyImported).toBe(true);
    expect(await prisma.task.count({ where: { userId } })).toBe(2);
    expect(await prisma.flashcard.count({ where: { userId } })).toBe(2);
    expect(await prisma.studySession.count({ where: { userId } })).toBe(2);
    expect(await prisma.xpTransaction.count({ where: { userId } })).toBe(1);
    expect(await prisma.importBatch.count({ where: { userId } })).toBe(1);
  });

  it('key order does not change the payload hash', () => {
    expect(payloadHash({ a: 1, b: { c: 2, d: [1, 2] } })).toBe(
      payloadHash({ b: { d: [1, 2], c: 2 }, a: 1 }),
    );
    expect(canonicalJson({ b: 1, a: undefined })).toBe('{"a":null,"b":1}');
  });

  it('an account with progress needs an explicit merge; never a silent overwrite', async () => {
    const { id: userId, api } = await player();
    await api.post('/tasks', { title: 'My own task' });
    expect((await api.get('/import/local/preflight')).body).toMatchObject({
      hasProgress: true,
      existing: { tasks: 1 },
    });
    const refused = await api.post('/import/local', { payload: oldData() });
    expect(refused.status).toBe(409);
    expect(refused.body.error.code).toBe('EXISTING_PROGRESS');
    expect(await prisma.task.count({ where: { userId } })).toBe(1);
    expect(await prisma.xpTransaction.count({ where: { userId } })).toBe(0);
    const merged = await api.post('/import/local', {
      payload: oldData(),
      onExistingProgress: 'merge',
    });
    expect(merged.status).toBe(200);
    expect(await prisma.task.count({ where: { userId } })).toBe(3); // existing kept + 2 imported
    expect(
      (await prisma.task.findMany({ where: { userId } })).some((t) => t.title === 'My own task'),
    ).toBe(true);
    expect(
      (await api.post('/import/local', { payload: oldData(), onExistingProgress: 'overwrite' }))
        .status,
    ).toBe(400);
  });

  it('legacy XP can be imported only once per account (editing the file and importing again pays nothing)', async () => {
    const { id: userId, api } = await player();
    await api.post('/import/local', { payload: oldData() });
    const edited = { ...oldData(), totalXP: 400_000, tasks: [] };
    const res = await api.post('/import/local', { payload: edited, onExistingProgress: 'merge' });
    expect(res.body.report.imported.xp).toBe(0);
    expect(res.body.report.skipped.some((s: { what: string }) => s.what === 'XP')).toBe(true);
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId } })).totalXp).toBe(
      260,
    );
  });

  it('absurd XP is capped, and a duplicate-name request does not steal another player’s name', async () => {
    const a = await player();
    const res = await a.api.post('/import/local', {
      payload: { totalXP: 99_999_999, avatarName: 'Hero One' },
    });
    expect(res.body.report.imported.xp).toBe(500_000);
    const b = await player();
    const res2 = await b.api.post('/import/local', { payload: { avatarName: 'Hero One' } });
    expect(res2.status).toBe(200);
    expect(res2.body.report.skipped.some((s: { what: string }) => s.what === 'profile')).toBe(true);
    expect(
      (await prisma.playerProfile.findUniqueOrThrow({ where: { id: b.id } })).displayName,
    ).toMatch(/^Adventurer-/);
  });

  it('validates the payload shape and bounds; unknown top-level keys are dropped, never stored', async () => {
    const { api } = await player();
    expect((await api.post('/import/local', { payload: { totalXP: 'lots' } })).status).toBe(400);
    expect(
      (
        await api.post('/import/local', {
          payload: { tasks: Array.from({ length: 1001 }, () => ({})) },
        })
      ).status,
    ).toBe(400);
    expect((await api.post('/import/local', { payload: {}, extra: 1 })).status).toBe(400);
    const ok = await api.post('/import/local', { payload: { totalXP: 10, evil: '<script>' } });
    expect(ok.status).toBe(200);
    expect(JSON.stringify(ok.body)).not.toMatch(/<script>/);
  });

  it('is private: needs a token, and only ever touches the caller’s own account', async () => {
    expect((await request(app).post('/api/v1/import/local').send({ payload: {} })).status).toBe(
      401,
    );
    const alice = await player();
    const bob = await player();
    await alice.api.post('/import/local', { payload: oldData() });
    expect(await prisma.task.count({ where: { userId: bob.id } })).toBe(0);
    expect((await bob.api.get('/import/local/preflight')).body.hasProgress).toBe(false);
  });

  it('accepts a large payload (bigger than the 100 KB default) on this route only', async () => {
    const { api } = await player();
    const flashcards = Array.from({ length: 900 }, (_, i) => ({
      question: `Question number ${i} ${'x'.repeat(120)}`,
      correct: 'a',
      answers: ['a', 'b', 'c'],
    }));
    const res = await api.post('/import/local', { payload: { flashcards } });
    expect(res.status).toBe(200);
    expect(res.body.report.imported.flashcards).toBe(900);
  });
});
