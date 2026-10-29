import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DAILY_XP_CAPS, levelFromTotalXp } from '@studyverse/shared';
import { grantXp, type GrantXpInput } from './lib/xp.js';
import type { PrismaClient } from './lib/prisma.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';

/** Step 0 of session 06: grantXp gets an optional daily cap group and a leaderboard flag. */
describe.skipIf(!hasTestDb)('grantXp daily caps (PostgreSQL)', () => {
  let prisma: PrismaClient;
  beforeAll(() => {
    prisma = createTestPrisma();
  });
  afterAll(() => prisma.$disconnect());

  const cap = { group: ['battle_practice'], amount: DAILY_XP_CAPS.battle_practice };
  const practice = (
    userId: string,
    sourceId: string,
    amount: number,
    now: Date,
    extra: Partial<GrantXpInput> = {},
  ) =>
    grantXp(
      {
        userId,
        amount,
        reason: 'practice',
        sourceType: 'battle_practice',
        sourceId,
        dailyCap: cap,
        leaderboardEligible: false,
        now,
        ...extra,
      },
      prisma,
    );
  const totalXp = async (u: string) =>
    (await prisma.playerProgress.findUniqueOrThrow({ where: { userId: u } })).totalXp;
  const day1 = new Date('2027-02-10T10:00:00Z');

  it('has the documented cap values', () => {
    expect(DAILY_XP_CAPS).toEqual({ task: 100, battle_practice: 60 });
  });

  it('pays up to the cap, then 0, and reports requested / awarded / capped', async () => {
    const u = await newPlayer(prisma);
    const a = await practice(u, 'b1', 40, day1);
    expect(a).toMatchObject({ granted: true, amount: 40, requested: 40, capped: false });
    const b = await practice(u, 'b2', 40, day1);
    expect(b).toMatchObject({ granted: true, amount: 20, requested: 40, capped: true });
    const c = await practice(u, 'b3', 40, day1);
    expect(c).toMatchObject({ granted: true, amount: 0, requested: 40, capped: true });
    expect(await totalXp(u)).toBe(60);
  });

  it('always writes the ledger row, even for 0 XP, so a capped source can never pay later', async () => {
    const u = await newPlayer(prisma);
    await practice(u, 'fill', 60, day1);
    const capped = await practice(u, 'late', 30, day1);
    expect(capped.amount).toBe(0);
    expect(await prisma.xpTransaction.count({ where: { userId: u, sourceId: 'late' } })).toBe(1);
    // Next day the same source id tries again: it is already in the ledger, so it pays nothing.
    const day2 = new Date('2027-02-11T10:00:00Z');
    const retry = await practice(u, 'late', 30, day2);
    expect(retry.granted).toBe(false);
    expect(retry.amount).toBe(0);
    expect(await totalXp(u)).toBe(60);
  });

  it('parallel grants cannot exceed the cap', async () => {
    const u = await newPlayer(prisma);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => practice(u, `par-${i}`, 15, day1)),
    );
    expect(await totalXp(u)).toBe(DAILY_XP_CAPS.battle_practice);
    expect(results.reduce((s, r) => s + r.amount, 0)).toBe(DAILY_XP_CAPS.battle_practice);
    expect(await prisma.xpTransaction.count({ where: { userId: u } })).toBe(12);
  });

  it('the cap resets on the next UTC day (fake clock, boundary at midnight UTC)', async () => {
    const u = await newPlayer(prisma);
    await practice(u, 'd1', 60, new Date('2027-02-10T23:59:59Z'));
    expect((await practice(u, 'd1b', 10, new Date('2027-02-10T23:59:59Z'))).amount).toBe(0);
    const next = await practice(u, 'd2', 25, new Date('2027-02-11T00:00:00Z'));
    expect(next).toMatchObject({ amount: 25, capped: false });
    expect(await totalXp(u)).toBe(85);
  });

  it('a cap group sums all of its source types; other sources are not counted', async () => {
    const u = await newPlayer(prisma);
    const group = { group: ['task', 'battle_practice'], amount: 50 };
    await grantXp(
      { userId: u, amount: 30, reason: 't', sourceType: 'task', sourceId: 't1', dailyCap: group, now: day1 },
      prisma,
    );
    await grantXp(
      { userId: u, amount: 500, reason: 'session', sourceType: 'session', sourceId: 's1', now: day1 },
      prisma,
    );
    const r = await grantXp(
      { userId: u, amount: 40, reason: 'p', sourceType: 'battle_practice', sourceId: 'p1', dailyCap: group, now: day1 },
      prisma,
    );
    expect(r.amount).toBe(20);
  });

  it('uncapped behaviour is unchanged (no cap, default leaderboard flag, amount must still be positive)', async () => {
    const u = await newPlayer(prisma);
    const r = await grantXp(
      { userId: u, amount: 120, reason: 'x', sourceType: 'session', sourceId: 'x1' },
      prisma,
    );
    expect(r).toMatchObject({ granted: true, amount: 120, requested: 120, capped: false });
    const row = await prisma.xpTransaction.findFirstOrThrow({ where: { userId: u } });
    expect(row.leaderboardEligible).toBe(true);
    await expect(
      grantXp({ userId: u, amount: 0, reason: 'x', sourceType: 'session', sourceId: 'x2' }, prisma),
    ).rejects.toMatchObject({ code: 'INVALID_XP_AMOUNT' });
  });

  it('levels up on a partly capped grant using only the awarded amount', async () => {
    const u = await newPlayer(prisma);
    await grantXp(
      { userId: u, amount: 200, reason: 's', sourceType: 'session', sourceId: 's1', now: day1 },
      prisma,
    );
    await practice(u, 'p0', 40, day1); // 240 XP: still level 2 (level 3 starts at 250)
    const r = await practice(u, 'p1', 50, day1); // only 20 of 50 fits: 260 XP -> level 3
    expect(r).toMatchObject({ amount: 20, requested: 50, capped: true, levelsGained: 1 });
    expect(r.progress.level).toBe(levelFromTotalXp(260).level);
    expect(r.progress.level).toBe(3);
    expect(await totalXp(u)).toBe(260);
  });

  it('stores leaderboardEligible=false when asked', async () => {
    const u = await newPlayer(prisma);
    await practice(u, 'lb', 10, day1);
    const row = await prisma.xpTransaction.findFirstOrThrow({ where: { userId: u, sourceId: 'lb' } });
    expect(row.leaderboardEligible).toBe(false);
  });
});
