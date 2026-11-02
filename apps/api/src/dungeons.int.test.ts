import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { BALANCE, type DungeonsDto } from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const NOW = new Date('2026-10-30T12:00:00.000Z');

describe.skipIf(!hasTestDb)('GET /dungeons (region map, derived from Battle rows)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    ({ app, keys } = await buildTestApp(prisma, {}, () => NOW));
  });
  afterAll(() => prisma.$disconnect());

  const player = async (totalXp = 0, energy = 4) => {
    const id = await newPlayer(prisma);
    await prisma.playerProgress.update({ where: { userId: id }, data: { totalXp, studyEnergy: energy } });
    return { id, api: client(app, keys, id) };
  };
  const map = async (api: ReturnType<typeof client>): Promise<DungeonsDto> => {
    const res = await api.get('/dungeons');
    expect(res.status).toBe(200);
    return res.body as DungeonsDto;
  };
  const won = (userId: string, o: { mode: 'raid' | 'practice'; enemySlug?: string; tier?: number; status?: 'victory' | 'defeat' }) =>
    prisma.battle.create({
      data: {
        userId, mode: o.mode, status: o.status ?? 'victory', subject: 'Math', tier: o.tier ?? 1, enemySlug: o.enemySlug ?? 'goblin-chieftain',
        enemyMaxHp: 72, enemyHp: 0, playerMaxHp: 100, playerHp: 40, seed: 1, engineState: {}, startedAt: NOW, endedAt: NOW,
        rewardsGrantedAt: NOW, rewardSummary: {}, idempotencyKey: randomUUID(),
      },
    });

  it('a new player: the Archive is open; the others and every boss are locked, each with its reason', async () => {
    const { api } = await player();
    const m = await map(api);
    expect(m).toMatchObject({ level: 1, energy: 4, energyCost: BALANCE.raid.energyCost, activeBattleId: null });
    expect(m.dungeons.map((d) => [d.tier, d.open])).toEqual([[1, true], [2, false], [3, false]]);
    expect(m.dungeons[0]).toMatchObject({ slug: 'archive', name: 'The Whispering Archive', background: 'dungeon.archive', bossSlug: 'procrastination-wyrm', bossOpen: false, bossDefeated: false, raidWins: 0, raidWinsNeeded: 3 });
    expect(m.dungeons[0]!.bossLockedReason).toMatch(/level 3/i);
    expect(m.dungeons[0]!.bossLockedReason).toMatch(/3 more raids/);
    expect(m.dungeons[1]!.lockedReason).toMatch(/level 5/i);
    expect(m.dungeons[1]!.lockedReason).toMatch(/Procrastination Wyrm/);
    expect(m.dungeons[2]!.lockedReason).toMatch(/level 9.*Archivist Lich/i);
  });

  it('only RAID victories count: practice wins never open a boss gate', async () => {
    const { id, api } = await player(400);
    for (let i = 0; i < 3; i += 1) await won(id, { mode: 'practice' });
    expect((await map(api)).dungeons[0]).toMatchObject({ raidWins: 0, bossOpen: false });
    for (let i = 0; i < 3; i += 1) await won(id, { mode: 'raid' });
    expect((await map(api)).dungeons[0]).toMatchObject({ raidWins: 3, bossOpen: true, bossLockedReason: null });
  });

  it('a raid defeat is not a win, and a boss victory is not one of the three regular wins', async () => {
    const { id, api } = await player(400);
    await won(id, { mode: 'raid', status: 'defeat' });
    await won(id, { mode: 'raid', enemySlug: 'procrastination-wyrm' });
    expect((await map(api)).dungeons[0]).toMatchObject({ raidWins: 0, bossDefeated: true });
  });

  it('defeating the Tier 1 boss (raid) plus level 5 opens the Sunken Library', async () => {
    const { id, api } = await player(1000);
    expect((await map(api)).dungeons[1]).toMatchObject({ open: false });
    await won(id, { mode: 'raid', enemySlug: 'procrastination-wyrm' });
    expect((await map(api)).dungeons[1]).toMatchObject({ open: true, lockedReason: null });
  });

  it('counts due cards by CARD subject, only the caller\'s, only those due now', async () => {
    const { id, api } = await player();
    const other = await player();
    const deck = await prisma.flashcardDeck.create({ data: { userId: id, name: 'Mixed', subject: 'Other' } });
    const card = (subject: string, due: boolean, userId = id, deckId = deck.id) => ({
      deckId, userId, question: `${subject} ${due} ${randomUUID()}?`, answer: 'A', distractors: ['B', 'C'], subject, difficulty: 'medium' as const,
      dueAt: new Date(NOW.getTime() + (due ? -60_000 : 86_400_000)),
    });
    const otherDeck = await prisma.flashcardDeck.create({ data: { userId: other.id, name: 'Theirs', subject: 'Math' } });
    await prisma.flashcard.createMany({ data: [card('Math', true), card('Math', true), card('Math', false), card('Biology', true), card('Math', true, other.id, otherDeck.id)] });
    expect((await map(api)).dueBySubject).toEqual({ Math: 2, Biology: 1 });
    expect((await map(other.api)).dueBySubject).toEqual({ Math: 1 });
  });

  it('offers the unfinished battle to resume, and nothing about anyone else', async () => {
    const a = await player(0, 9);
    const b = await player();
    const started = await a.api.post('/battles', { mode: 'raid', subject: 'Math', tier: 1 }, { 'Idempotency-Key': randomUUID() });
    expect((await map(a.api)).activeBattleId).toBe(started.body.battle.id);
    expect((await map(b.api)).activeBattleId).toBeNull();
  });

  it('requires a signed-in player', async () => {
    const request = (await import('supertest')).default;
    expect((await request(app).get('/api/v1/dungeons')).status).toBe(401);
  });
});
