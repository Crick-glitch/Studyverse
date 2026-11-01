import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { Express } from 'express';
import { BATTLE, FIRST_CLEAR_XP, battleXp, type BattleDto, type BattleSummaryDto } from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

// The hook session 07 will attach cosmetics to: here we only count how often it is called.
const firstClear = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('./services/battleHooks.js', () => ({ onFirstClear: firstClear }));

const NOW = new Date('2026-10-30T12:00:00.000Z');
type Api = ReturnType<typeof client>;

describe.skipIf(!hasTestDb)('boss first clear (PostgreSQL)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    ({ app, keys } = await buildTestApp(prisma, {}, () => NOW));
  });
  afterAll(() => prisma.$disconnect());

  /** A level-4 player with the boss gate open (3 raid wins in the Archive) and plenty of energy. */
  const ready = async () => {
    const id = await newPlayer(prisma);
    await prisma.playerProgress.update({ where: { userId: id }, data: { totalXp: 400, studyEnergy: 30 } });
    for (let i = 0; i < 3; i += 1) {
      await prisma.battle.create({
        data: {
          userId: id, mode: 'raid', status: 'victory', subject: 'Math', tier: 1, enemySlug: 'goblin-chieftain', enemyMaxHp: 72, enemyHp: 0,
          playerMaxHp: 100, playerHp: 40, seed: 1, engineState: {}, startedAt: NOW, endedAt: NOW, rewardsGrantedAt: NOW, rewardSummary: {}, idempotencyKey: randomUUID(),
        },
      });
    }
    return { id, api: client(app, keys, id) };
  };
  const winBoss = async (api: Api): Promise<BattleDto> => {
    const start = await api.post('/battles', { mode: 'raid', subject: 'Math', tier: 1, boss: true }, { 'Idempotency-Key': randomUUID() });
    expect(start.status).toBe(201);
    let b = start.body.battle as BattleDto;
    expect(b.enemy).toMatchObject({ isBoss: true, slug: 'procrastination-wyrm' });
    for (let i = 0; i < 80 && b.phase !== 'ended'; i += 1) {
      await api.post(`/battles/${b.id}/move`, { turnNumber: b.turn, move: 'steady' });
      const t = await prisma.battleTurn.findUniqueOrThrow({ where: { battleId_turnNumber: { battleId: b.id, turnNumber: b.turn } } });
      b = (await api.post(`/battles/${b.id}/answer`, { turnNumber: b.turn, selectedIndex: t.correctIndex })).body.battle;
    }
    expect(b.status).toBe('victory');
    return b;
  };
  const finish = async (api: Api, id: string) => (await api.post(`/battles/${id}/finish`)).body.summary as BattleSummaryDto;

  it('pays the first-clear bonus once across two victories and repeated finish calls, and calls the hook once', async () => {
    firstClear.mockClear();
    const { id, api } = await ready();
    const one = await winBoss(api);
    const s1 = await finish(api, one.id);
    expect(s1.firstClear).toEqual({ bossSlug: 'procrastination-wyrm', xp: FIRST_CLEAR_XP[1], awarded: true });
    expect((await finish(api, one.id)).firstClear).toEqual(s1.firstClear); // same stored summary
    const two = await winBoss(api);
    const s2 = await finish(api, two.id);
    await finish(api, two.id);
    expect(s2.firstClear).toEqual({ bossSlug: 'procrastination-wyrm', xp: FIRST_CLEAR_XP[1], awarded: false });

    const ledger = await prisma.xpTransaction.findMany({ where: { userId: id, sourceType: 'first_clear' } });
    expect(ledger).toHaveLength(1);
    expect(ledger[0]).toMatchObject({ sourceId: 'procrastination-wyrm', amount: FIRST_CLEAR_XP[1], leaderboardEligible: true });
    expect(await prisma.xpTransaction.count({ where: { userId: id, sourceType: 'battle' } })).toBe(2); // each battle paid once
    expect(firstClear).toHaveBeenCalledTimes(1);
    expect(firstClear).toHaveBeenCalledWith(id, 'procrastination-wyrm', expect.anything());
  });

  it('a boss victory pays the boss multiplier, and the first clear is on top of it', async () => {
    const { id, api } = await ready();
    const battle = await winBoss(api);
    const s = await finish(api, battle.id);
    const base = { level: battle.hero.level, accuracy: 1, mode: 'raid' as const, victory: true, scholar: false, gearXpMult: 1, ...(s.loot?.duplicate && { duplicateXp: s.loot.duplicateXp }) };
    expect(s.xp.requested).toBe(battleXp({ ...base, isBoss: true }));
    expect(s.xp.requested).toBeGreaterThan(battleXp({ ...base, isBoss: false }));
    expect(BATTLE.rewards.bossMult).toBeGreaterThan(1);
    const total = await prisma.xpTransaction.aggregate({ where: { userId: id }, _sum: { amount: true } });
    expect(total._sum.amount).toBe(s.xp.awarded + FIRST_CLEAR_XP[1]);
    expect(s.progress.raidWins).toBe(1); // the counter moves on finish; the 3 seeded rows only feed the derived unlock facts
  });

  it('losing to the boss never pays the first clear', async () => {
    firstClear.mockClear();
    const { id, api } = await ready();
    const start = await api.post('/battles', { mode: 'raid', subject: 'Math', tier: 1, boss: true }, { 'Idempotency-Key': randomUUID() });
    let b = start.body.battle as BattleDto;
    for (let i = 0; i < 80 && b.phase !== 'ended'; i += 1) {
      await api.post(`/battles/${b.id}/move`, { turnNumber: b.turn, move: 'steady' });
      const t = await prisma.battleTurn.findUniqueOrThrow({ where: { battleId_turnNumber: { battleId: b.id, turnNumber: b.turn } } });
      b = (await api.post(`/battles/${b.id}/answer`, { turnNumber: b.turn, selectedIndex: [0, 1, 2].find((x) => x !== t.correctIndex) })).body.battle;
    }
    expect(b.status).toBe('defeat');
    const s = await finish(api, b.id);
    expect(s.firstClear).toBeNull();
    expect(await prisma.xpTransaction.count({ where: { userId: id, sourceType: 'first_clear' } })).toBe(0);
    expect(firstClear).not.toHaveBeenCalled();
  });
});
