import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { levelFromTotalXp } from '@studyverse/shared';
import { grantXp } from './lib/xp.js';
import type { PrismaClient } from './lib/prisma.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';

describe.skipIf(!hasTestDb)('grantXp (PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createTestPrisma();
  });
  afterAll(() => prisma.$disconnect());

  const grant = (userId: string, sourceId: string, amount = 25, extra: object = {}) =>
    grantXp({ userId, amount, reason: 'test', sourceType: 'task', sourceId, ...extra }, prisma);

  it('pays a source once; a repeat returns the original outcome and changes nothing', async () => {
    const u = await newPlayer(prisma);
    const first = await grant(u, 't1', 25);
    const again = await grant(u, 't1', 25);
    expect(first.granted).toBe(true);
    expect(again.granted).toBe(false);
    expect(again.amount).toBe(25);
    expect(again.progress.totalXp).toBe(25);
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(1);
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } })).totalXp).toBe(
      25,
    );
  });

  it('a repeat with a different amount still does not pay again (the source is what is unique)', async () => {
    const u = await newPlayer(prisma);
    await grant(u, 't1', 10);
    const again = await grant(u, 't1', 50);
    expect(again.granted).toBe(false);
    expect(again.amount).toBe(10);
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } })).totalXp).toBe(
      10,
    );
  });

  it('concurrent calls for the same source pay exactly once', async () => {
    const u = await newPlayer(prisma);
    const results = await Promise.all(Array.from({ length: 12 }, () => grant(u, 'same', 40)));
    expect(results.filter((r) => r.granted)).toHaveLength(1);
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(1);
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } })).totalXp).toBe(
      40,
    );
  });

  it('concurrent grants from different sources all count (no lost updates)', async () => {
    const u = await newPlayer(prisma);
    await Promise.all(Array.from({ length: 15 }, (_, i) => grant(u, `src-${i}`, 10)));
    const p = await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } });
    expect(p.totalXp).toBe(150);
    const info = levelFromTotalXp(150);
    expect(p.level).toBe(info.level);
    expect(p.currentLevelXp).toBe(info.currentLevelXp);
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(15);
  });

  it('levels up once and awards one skill point', async () => {
    const u = await newPlayer(prisma);
    const r = await grant(u, 'a', 100);
    expect(r.levelsGained).toBe(1);
    expect(r.skillPointsAwarded).toBe(1);
    expect(r.progress).toMatchObject({ level: 2, totalXp: 100, currentLevelXp: 0, skillPoints: 1 });
  });

  it('crosses several levels from a single large grant', async () => {
    const u = await newPlayer(prisma);
    const r = await grant(u, 'big', 1000);
    expect(r.levelsGained).toBe(5);
    expect(r.progress).toMatchObject({ level: 6, currentLevelXp: 0, skillPoints: 5 });
    const more = await grant(u, 'more', 400);
    expect(more.progress).toMatchObject({
      level: 7,
      totalXp: 1400,
      currentLevelXp: 50,
      skillPoints: 6,
    });
  });

  it('repeating a level-up grant does not pay skill points twice', async () => {
    const u = await newPlayer(prisma);
    await grant(u, 'lvl', 250);
    const again = await grant(u, 'lvl', 250);
    expect(again.levelsGained).toBe(2);
    expect(again.progress.skillPoints).toBe(2);
  });

  it('records leaderboardEligible=false for legacy imports', async () => {
    const u = await newPlayer(prisma);
    await grantXp(
      {
        userId: u,
        amount: 500,
        reason: 'legacy',
        sourceType: 'legacy_import',
        sourceId: 'b1',
        leaderboardEligible: false,
      },
      prisma,
    );
    const row = await prisma.xpTransaction.findFirstOrThrow({ where: { userId: u } });
    expect(row.leaderboardEligible).toBe(false);
  });

  it('rejects zero, negative and fractional amounts', async () => {
    const u = await newPlayer(prisma);
    for (const amount of [0, -5, 1.5])
      await expect(grant(u, `bad-${amount}`, amount)).rejects.toThrow();
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(0);
  });

  it('is atomic: a failure after the ledger insert rolls the grant back when part of a larger transaction', async () => {
    const u = await newPlayer(prisma);
    await expect(
      prisma.$transaction(async (tx) => {
        await grantXp(
          { userId: u, amount: 25, reason: 'x', sourceType: 'battle', sourceId: 'rollback' },
          tx,
        );
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(0);
    expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } })).totalXp).toBe(
      0,
    );
  });

  it('fails cleanly for a player that does not exist', async () => {
    await expect(grant(crypto.randomUUID(), 'x')).rejects.toThrow();
  });
});
