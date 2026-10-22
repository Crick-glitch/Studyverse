import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import type { PrismaClient } from './lib/prisma.js';
import { grantXp } from './lib/xp.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import type { TestKeys } from './test/jwt.js';

describe.skipIf(!hasTestDb)('player routes (PostgreSQL + signed test tokens)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  beforeAll(async () => {
    prisma = createTestPrisma();
    ({ app, keys } = await buildTestApp(prisma));
  });
  afterAll(() => prisma.$disconnect());

  const as = async (sub: string, email = 'p@example.com') =>
    `Bearer ${await keys.sign({ sub, email })}`;

  it('GET /me creates the profile once, even when called in parallel', async () => {
    const sub = crypto.randomUUID();
    const auth = await as(sub);
    const responses = await Promise.all(
      Array.from({ length: 10 }, () => request(app).get('/api/v1/me').set('Authorization', auth)),
    );
    expect(responses.every((r) => r.status === 200)).toBe(true);
    expect(new Set(responses.map((r) => r.body.profile.id))).toEqual(new Set([sub]));
    expect(new Set(responses.map((r) => r.body.profile.displayName)).size).toBe(1);
    expect(await prisma.playerProfile.count({ where: { id: sub } })).toBe(1);
    expect(await prisma.playerProgress.count({ where: { userId: sub } })).toBe(1);
    const body = responses[0]?.body;
    expect(body.user).toEqual({ id: sub, email: 'p@example.com' });
    expect(body.progress).toMatchObject({
      level: 1,
      totalXp: 0,
      currentLevelXp: 0,
      xpForNextLevel: 100,
    });
    expect(body.profile.showOnLeaderboard).toBe(false);
  });

  it('a later /me keeps the same profile (idempotent)', async () => {
    const sub = crypto.randomUUID();
    const a = await request(app)
      .get('/api/v1/me')
      .set('Authorization', await as(sub));
    const b = await request(app)
      .get('/api/v1/me')
      .set('Authorization', await as(sub));
    expect(b.body.profile).toEqual(a.body.profile);
  });

  it('GET /progress reflects XP granted through the ledger', async () => {
    const sub = await newPlayer(prisma);
    await grantXp(
      { userId: sub, amount: 260, reason: 't', sourceType: 'task', sourceId: 'x' },
      prisma,
    );
    const res = await request(app)
      .get('/api/v1/progress')
      .set('Authorization', await as(sub));
    expect(res.status).toBe(200);
    expect(res.body.progress).toMatchObject({
      level: 3,
      totalXp: 260,
      currentLevelXp: 10,
      xpForNextLevel: 200,
      skillPoints: 2,
    });
  });

  it('PATCH /profile updates allowed fields', async () => {
    const sub = await newPlayer(prisma);
    const res = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', await as(sub))
      .send({
        displayName: '  Ada   Byron ',
        playerClass: 'scholar',
        showOnLeaderboard: true,
        avatarKey: 'hero.owl',
      });
    expect(res.status).toBe(200);
    expect(res.body.profile).toMatchObject({
      id: sub,
      displayName: 'Ada Byron',
      playerClass: 'scholar',
      showOnLeaderboard: true,
      avatarKey: 'hero.owl',
    });
    const got = await request(app)
      .get('/api/v1/profile')
      .set('Authorization', await as(sub));
    expect(got.body.profile.displayName).toBe('Ada Byron');
  });

  it('rejects invalid input with the single error shape and changes nothing', async () => {
    const sub = await newPlayer(prisma);
    const before = await prisma.playerProfile.findUniqueOrThrow({ where: { id: sub } });
    for (const body of [
      { displayName: 'a@b.co' },
      { displayName: 'x' },
      { playerClass: 'wizard' },
      {},
      { showOnLeaderboard: 'yes' },
    ]) {
      const res = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', await as(sub))
        .send(body);
      expect(res.status, JSON.stringify(body)).toBe(400);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    }
    const after = await prisma.playerProfile.findUniqueOrThrow({ where: { id: sub } });
    expect(after.displayName).toBe(before.displayName);
  });

  it('display names are unique, case-insensitively (409)', async () => {
    const a = await newPlayer(prisma);
    const b = await newPlayer(prisma);
    const name = `Uniq${Math.floor(Math.random() * 1e6)}`;
    expect(
      (
        await request(app)
          .patch('/api/v1/profile')
          .set('Authorization', await as(a))
          .send({ displayName: name })
      ).status,
    ).toBe(200);
    const clash = await request(app)
      .patch('/api/v1/profile')
      .set('Authorization', await as(b))
      .send({ displayName: name.toUpperCase() });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe('DISPLAY_NAME_TAKEN');
  });

  describe('a user cannot reach another user’s private data by supplying a different id', () => {
    it('ignores ids in query, headers and body; the token decides', async () => {
      const alice = await newPlayer(prisma);
      const bob = await newPlayer(prisma);
      await prisma.playerProfile.update({
        where: { id: bob },
        data: { displayName: 'BobSecret', displayNameKey: 'bobsecret' },
      });
      const res = await request(app)
        .get(`/api/v1/profile?userId=${bob}&id=${bob}`)
        .set('Authorization', await as(alice))
        .set('X-User-Id', bob);
      expect(res.status).toBe(200);
      expect(res.body.profile.id).toBe(alice);
      expect(JSON.stringify(res.body)).not.toContain('BobSecret');
    });
    it('PATCH cannot target someone else (id in body is rejected; params do not exist)', async () => {
      const alice = await newPlayer(prisma);
      const bob = await newPlayer(prisma);
      const bobBefore = await prisma.playerProfile.findUniqueOrThrow({ where: { id: bob } });
      const viaBody = await request(app)
        .patch('/api/v1/profile')
        .set('Authorization', await as(alice))
        .send({ id: bob, displayName: 'Hijack' });
      expect(viaBody.status).toBe(400);
      const viaPath = await request(app)
        .patch(`/api/v1/profile/${bob}`)
        .set('Authorization', await as(alice))
        .send({ displayName: 'Hijack' });
      expect(viaPath.status).toBe(404);
      const bobAfter = await prisma.playerProfile.findUniqueOrThrow({ where: { id: bob } });
      expect(bobAfter.displayName).toBe(bobBefore.displayName);
    });
    it('/me exposes email only for the caller', async () => {
      const alice = await newPlayer(prisma);
      const res = await request(app)
        .get('/api/v1/me')
        .set('Authorization', await as(alice, 'alice@example.com'));
      expect(res.body.user.email).toBe('alice@example.com');
      expect(res.body.profile.email).toBeUndefined();
    });
  });
});
