import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import request from 'supertest';
import {
  BALANCE,
  BATTLE,
  DAILY_XP_CAPS,
  battleXp,
  type AnswerResultDto,
  type BattleDto,
  type BattleSummaryDto,
  type Move,
} from '@studyverse/shared';
import type { PrismaClient } from './lib/prisma.js';
import { runSeed } from './seed/run.js';
import { buildTestApp } from './test/app.js';
import { createTestPrisma, hasTestDb, newPlayer } from './test/db.js';
import { client } from './test/http.js';
import type { TestKeys } from './test/jwt.js';

const NOW = new Date('2026-10-30T12:00:00.000Z');
const RAID = { mode: 'raid', subject: 'Math', tier: 1 } as const;
const PRACTICE = { mode: 'practice', subject: 'Math', tier: 1 } as const;

type Api = ReturnType<typeof client>;

describe.skipIf(!hasTestDb)('battles API (PostgreSQL, injected clock)', () => {
  let prisma: PrismaClient;
  let app: Express;
  let keys: TestKeys;
  let bankTexts: string[] = [];

  beforeAll(async () => {
    prisma = createTestPrisma();
    await runSeed(prisma);
    bankTexts = (await prisma.question.findMany({ select: { text: true } })).map((q) => q.text);
    ({ app, keys } = await buildTestApp(prisma, {}, () => NOW));
  });
  afterAll(() => prisma.$disconnect());

  const player = async (energy = 9) => {
    const id = await newPlayer(prisma);
    await prisma.playerProgress.update({ where: { userId: id }, data: { studyEnergy: energy } });
    return { id, api: client(app, keys, id) };
  };
  const start = (api: Api, body: object = RAID, key: string = randomUUID()) =>
    api.post('/battles', body, { 'Idempotency-Key': key });
  const begin = async (api: Api, body: object = RAID): Promise<BattleDto> => {
    const res = await start(api, body);
    expect(res.status).toBe(201);
    return res.body.battle as BattleDto;
  };
  const turnRow = (battleId: string, turnNumber: number) =>
    prisma.battleTurn.findUniqueOrThrow({ where: { battleId_turnNumber: { battleId, turnNumber } } });
  /** Picks a move, then answers right or wrong. The test reads the stored snapshot; the API never shows it. */
  const play = async (api: Api, b: { id: string; turn: number }, correct: boolean, move: Move = 'steady') => {
    const mv = await api.post(`/battles/${b.id}/move`, { turnNumber: b.turn, move });
    expect(mv.status).toBe(200);
    const t = await turnRow(b.id, b.turn);
    const wrong = [0, 1, 2].find((i) => i !== t.correctIndex)!;
    const res = await api.post(`/battles/${b.id}/answer`, { turnNumber: b.turn, selectedIndex: correct ? t.correctIndex! : wrong });
    expect(res.status).toBe(200);
    return res.body as { result: AnswerResultDto; battle: BattleDto };
  };
  const playOut = async (api: Api, b: BattleDto, correct: boolean): Promise<BattleDto> => {
    let cur = b;
    for (let i = 0; i < 80 && cur.phase !== 'ended'; i += 1) cur = (await play(api, cur, correct)).battle;
    expect(cur.phase).toBe('ended');
    return cur;
  };
  const finish = async (api: Api, id: string) => {
    const res = await api.post(`/battles/${id}/finish`);
    expect(res.status).toBe(200);
    return res.body.summary as BattleSummaryDto;
  };
  const keysDeep = (v: unknown, out: string[] = []): string[] => {
    if (Array.isArray(v)) v.forEach((x) => keysDeep(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { out.push(k); keysDeep(x, out); }
    return out;
  };

  describe('starting', () => {
    it('requires an Idempotency-Key', async () => {
      const { api } = await player();
      const res = await api.post('/battles', RAID);
      expect(res.status).toBe(400);
      const short = await api.post('/battles', RAID, { 'Idempotency-Key': 'x' });
      expect(short.status).toBe(400);
    });

    it('returns state at awaitingMove with NO question, answer or explanation anywhere in the JSON', async () => {
      const { api } = await player();
      const res = await start(api);
      const text = JSON.stringify(res.body);
      expect(res.body.battle).toMatchObject({ phase: 'awaitingMove', status: 'active', move: null, question: null, turn: 1 });
      expect(keysDeep(res.body)).not.toContain('correctIndex');
      expect(keysDeep(res.body)).not.toContain('explanation');
      // no bank question text exists in the response before a move is chosen
      for (const q of bankTexts) expect(text.includes(q)).toBe(false);
      const get = await api.get(`/battles/${res.body.battle.id}`);
      expect(get.status).toBe(200);
      for (const q of bankTexts) expect(JSON.stringify(get.body).includes(q)).toBe(false);
      expect(keysDeep(get.body)).not.toContain('correctIndex');
      expect((await turnRow(res.body.battle.id, 1)).questionText).toBeNull();
    });

    it('a raid costs 3 energy; two clicks with the same key charge once and return the same battle', async () => {
      const { id, api } = await player(10);
      const key = randomUUID();
      const [a, b] = await Promise.all([start(api, RAID, key), start(api, RAID, key)]);
      expect([a.status, b.status].sort()).toEqual([200, 201]);
      expect(a.body.battle.id).toBe(b.body.battle.id);
      expect([a.body.created, b.body.created].sort()).toEqual([false, true]);
      expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } })).studyEnergy).toBe(10 - BALANCE.raid.energyCost);
      expect(await prisma.battle.count({ where: { userId: id } })).toBe(1);
    });

    it('refuses a raid without enough energy, with a reason, and creates nothing', async () => {
      const { id, api } = await player(2);
      const res = await start(api);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_ENOUGH_ENERGY');
      expect(res.body.error.message).toMatch(/3 energy/);
      expect(await prisma.battle.count({ where: { userId: id } })).toBe(0);
      expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } })).studyEnergy).toBe(2);
    });

    it('practice costs no energy', async () => {
      const { id, api } = await player(0);
      await begin(api, PRACTICE);
      expect((await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } })).studyEnergy).toBe(0);
    });

    it('only one active battle at a time (a different key is refused, naming the battle)', async () => {
      const { api } = await player();
      const first = await begin(api);
      const res = await start(api);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BATTLE_IN_PROGRESS');
      expect(res.body.error.details).toMatchObject({ battleId: first.id });
    });

    it('refuses locked dungeons with the reason: tier 2 needs level 5 and the tier 1 boss', async () => {
      const { api } = await player();
      const res = await start(api, { mode: 'raid', subject: 'Math', tier: 2 });
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('DUNGEON_LOCKED');
      expect(res.body.error.message).toMatch(/level 5|Procrastination Wyrm/);
    });

    it('the boss gate needs level 3 and 3 RAID wins here; practice wins never count', async () => {
      const { id, api } = await player();
      await prisma.playerProgress.update({ where: { userId: id }, data: { totalXp: 400, level: 4 } });
      const noWins = await start(api, { ...RAID, boss: true });
      expect(noWins.status).toBe(403);
      expect(noWins.body.error.code).toBe('BOSS_LOCKED');
      expect(noWins.body.error.message).toMatch(/3 more raids/i);
      for (let i = 0; i < 3; i += 1) await seedFinished(id, { mode: 'practice', status: 'victory' });
      expect((await start(api, { ...RAID, boss: true })).status).toBe(403);
      for (let i = 0; i < 3; i += 1) await seedFinished(id, { mode: 'raid', status: 'victory' });
      const ok = await start(api, { ...RAID, boss: true });
      expect(ok.status).toBe(201);
      expect(ok.body.battle.enemy.isBoss).toBe(true);
    });

    it('bosses are raid-only', async () => {
      const { api } = await player();
      const res = await start(api, { ...PRACTICE, boss: true });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('BOSS_RAID_ONLY');
    });
  });

  describe('turns: move, question, answer', () => {
    it('answering before choosing a move is refused (409), and nothing changes', async () => {
      const { api } = await player();
      const b = await begin(api);
      const res = await api.post(`/battles/${b.id}/answer`, { turnNumber: 1, selectedIndex: 0 });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MOVE_REQUIRED');
      expect((await api.get(`/battles/${b.id}`)).body.battle).toMatchObject({ phase: 'awaitingMove', questionsAsked: 0 });
    });

    it('a move returns text and choices only; the SAME move again returns the SAME question', async () => {
      const { api } = await player();
      const b = await begin(api);
      const first = await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'bold' });
      expect(first.status).toBe(200);
      expect(Object.keys(first.body.question).sort()).toEqual(['choices', 'text']);
      expect(first.body.question.choices).toHaveLength(3);
      expect(first.body.battle.move).toBe('bold');
      expect(keysDeep(first.body)).not.toContain('correctIndex');
      expect(keysDeep(first.body)).not.toContain('explanation');
      const before = await turnRow(b.id, 1);
      const again = await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'bold' });
      expect(again.status).toBe(200);
      expect(again.body.question).toEqual(first.body.question);
      const after = await turnRow(b.id, 1);
      expect(after.questionText).toBe(before.questionText);
      expect(after.choices).toEqual(before.choices);
    });

    it('a DIFFERENT move for an already-chosen turn is 409 and reports the stored choice', async () => {
      const { api } = await player();
      const b = await begin(api);
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'brace' });
      const res = await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'bold' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('MOVE_ALREADY_CHOSEN');
      expect(res.body.error.details).toEqual({ move: 'brace' });
    });

    it('stale and future turn numbers are rejected', async () => {
      const { api } = await player();
      const b = await begin(api);
      const future = await api.post(`/battles/${b.id}/move`, { turnNumber: 2, move: 'steady' });
      expect(future.status).toBe(409);
      expect(future.body.error.code).toBe('STALE_TURN');
      const futureAnswer = await api.post(`/battles/${b.id}/answer`, { turnNumber: 5, selectedIndex: 0 });
      expect(futureAnswer.status).toBe(409);
      await play(api, b, true);
      const stale = await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      expect(stale.status).toBe(409);
      expect(stale.body.error.code).toBe('STALE_TURN');
      const ab = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'cleave' });
      expect(ab.status).toBe(409);
    });

    it('the server decides: correct answers deal damage, wrong ones hurt, and the result carries the answer', async () => {
      const { api } = await player();
      const b = await begin(api);
      const ok = await play(api, b, true);
      expect(ok.result.correct).toBe(true);
      expect(ok.result.damageDealt).toBeGreaterThan(0);
      expect(ok.battle.enemy.hp).toBeLessThan(b.enemy.maxHp);
      expect(ok.battle.turn).toBe(2);
      expect(ok.battle.phase).toBe('awaitingMove');
      expect(ok.battle.question).toBeNull();
      const bad = await play(api, ok.battle, false);
      expect(bad.result.correct).toBe(false);
      expect(bad.result.damageTaken).toBeGreaterThan(0);
      expect(bad.result.correctIndex).toBeGreaterThanOrEqual(0);
      expect(bad.battle.hero.hp).toBeLessThan(b.hero.hp);
      expect(bad.battle.combo).toBe(0);
    });

    it('a duplicate answer is idempotent: same result, nothing applied twice', async () => {
      const { api } = await player();
      const b = await begin(api);
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      const t = await turnRow(b.id, 1);
      const body = { turnNumber: 1, selectedIndex: [0, 1, 2].find((i) => i !== t.correctIndex)! };
      const first = await api.post(`/battles/${b.id}/answer`, body);
      const replay = await api.post(`/battles/${b.id}/answer`, body);
      const other = await api.post(`/battles/${b.id}/answer`, { ...body, selectedIndex: t.correctIndex });
      expect(replay.status).toBe(200);
      expect(replay.body.result).toEqual(first.body.result);
      expect(other.body.result).toEqual(first.body.result);
      expect(replay.body.battle.hero.hp).toBe(first.body.battle.hero.hp);
      expect(await prisma.battleTurn.count({ where: { battleId: b.id } })).toBe(2);
    });

    it('parallel answers to one turn apply once', async () => {
      const { api } = await player();
      const b = await begin(api);
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      const t = await turnRow(b.id, 1);
      const body = { turnNumber: 1, selectedIndex: t.correctIndex! };
      const res = await Promise.all([1, 2, 3].map(() => api.post(`/battles/${b.id}/answer`, body)));
      expect(res.every((r) => r.status === 200)).toBe(true);
      // (jsonb stores keys in its own order, so compare structurally, not as strings)
      for (const r of res) expect(r.body.result).toEqual(res[0]!.body.result);
      expect(await prisma.battleTurn.count({ where: { battleId: b.id } })).toBe(2);
    });

    it('rejects a choice index that is not one of the choices', async () => {
      const { api } = await player();
      const b = await begin(api);
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      expect((await api.post(`/battles/${b.id}/answer`, { turnNumber: 1, selectedIndex: 7 })).status).toBe(400);
    });

    it('Brace never draws a hard question; Bold draws hard when the pool has one', async () => {
      const { api } = await player(99);
      for (let i = 0; i < 6; i += 1) {
        const b = await begin(api, { mode: 'practice', subject: 'Math', tier: 1 });
        await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'brace' });
        expect((await turnRow(b.id, 1)).questionDifficulty).not.toBe('hard');
        await api.post(`/battles/${b.id}/retreat`);
      }
      const b = await begin(api, { mode: 'practice', subject: 'Math', tier: 1 });
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'bold' });
      expect((await turnRow(b.id, 1)).questionDifficulty).toBe('hard');
    });
  });

  describe('resume', () => {
    it('a refresh at awaitingMove and at awaitingAnswer returns the same state (GET and /active)', async () => {
      const { api } = await player();
      const b = await begin(api);
      const atMove = (await api.get(`/battles/${b.id}`)).body.battle as BattleDto;
      expect(atMove).toEqual(b);
      expect((await api.get('/battles/active')).body.battle.id).toBe(b.id);
      const mv = await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      const atAnswer = (await api.get(`/battles/${b.id}`)).body.battle as BattleDto;
      expect(atAnswer.phase).toBe('awaitingAnswer');
      expect(atAnswer.question).toEqual(mv.body.question);
      expect(atAnswer.move).toBe('steady');
      expect(keysDeep(atAnswer)).not.toContain('correctIndex');
      // after an answer the intent for the next turn is the same on every refresh (no re-roll)
      const next = (await play2(api, atAnswer)).battle;
      const r1 = (await api.get(`/battles/${b.id}`)).body.battle as BattleDto;
      const r2 = (await api.get(`/battles/${b.id}`)).body.battle as BattleDto;
      expect(r1.intent).toEqual(next.intent);
      expect(r2.intent).toEqual(r1.intent);
      expect(r1.lastResult?.turnNumber).toBe(1);
    });

    it('/active is null when nothing is running, and an ended-but-unclaimed battle is still offered', async () => {
      const { api } = await player();
      expect((await api.get('/battles/active')).body.battle).toBeNull();
      const b = await playOut(api, await begin(api), true);
      const active = (await api.get('/battles/active')).body.battle as BattleDto;
      expect(active.id).toBe(b.id);
      expect(active.status).toBe('victory');
      await finish(api, b.id);
      expect((await api.get('/battles/active')).body.battle).toBeNull();
    });
  });

  describe('abilities', () => {
    const withClass = async (cls: 'warrior' | 'scholar' | 'tank' | null, focus = 3) => {
      const p = await player();
      await prisma.playerProfile.update({ where: { id: p.id }, data: { playerClass: cls } });
      const b = await begin(p.api);
      await setFocus(b.id, focus);
      return { ...p, b };
    };
    const setFocus = async (battleId: string, focus: number) => {
      const row = await prisma.battle.findUniqueOrThrow({ where: { id: battleId } });
      const stored = row.engineState as { engine: { focus: number } };
      stored.engine.focus = focus;
      await prisma.battle.update({ where: { id: battleId }, data: { focus, engineState: stored as object } });
    };

    it('a class without Focus cannot use its ability', async () => {
      const { api, b } = await withClass('warrior', 2);
      const res = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'cleave' });
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('NOT_ENOUGH_FOCUS');
    });

    it('Cleave is for Warriors only, can be armed before the move, spends Focus, and only one ability per turn', async () => {
      const { api, b } = await withClass('warrior');
      expect((await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'insight' })).status).toBe(409);
      const ok = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'cleave' });
      expect(ok.status).toBe(200);
      expect(ok.body.battle).toMatchObject({ armed: 'cleave', focus: 0 });
      await setFocus(b.id, 3);
      const twice = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'cleave' });
      expect(twice.status).toBe(409);
    });

    it('Insight works only after the question appears and removes exactly one WRONG choice', async () => {
      const { api, b } = await withClass('scholar');
      const early = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'insight' });
      expect(early.status).toBe(409);
      await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' });
      const res = await api.post(`/battles/${b.id}/ability`, { turnNumber: 1, ability: 'insight' });
      expect(res.status).toBe(200);
      const t = await turnRow(b.id, 1);
      expect(res.body.battle.removedIndex).not.toBeNull();
      expect(res.body.battle.removedIndex).not.toBe(t.correctIndex);
      expect(res.body.battle.question.choices).toHaveLength(3);
      expect(keysDeep(res.body)).not.toContain('correctIndex');
    });
  });

  describe('finishing and rewards', () => {
    it('finish is refused while the battle is still going', async () => {
      const { api } = await player();
      const b = await begin(api);
      const res = await api.post(`/battles/${b.id}/finish`);
      expect(res.status).toBe(409);
      expect(res.body.error.code).toBe('BATTLE_NOT_OVER');
    });

    it('a raid victory pays XP once through the ledger, +1 energy, a raid win and quest progress', async () => {
      const { id, api } = await player(9);
      const done = await playOut(api, await begin(api), true);
      expect(done.status).toBe('victory');
      const s1 = await finish(api, done.id);
      expect(s1).toMatchObject({ outcome: 'victory', mode: 'raid', alreadyFinished: false, energy: 1 });
      expect(s1.xp.awarded).toBe(s1.xp.requested);
      expect(s1.xp.awarded).toBeGreaterThan(0);
      expect(s1.asked).toBe(s1.correct);
      expect(s1.missed).toEqual([]);
      const s2 = await finish(api, done.id);
      expect(s2).toEqual({ ...s1, alreadyFinished: true });
      const ledger = await prisma.xpTransaction.findMany({ where: { userId: id, sourceType: 'battle' } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ sourceId: done.id, amount: s1.xp.awarded, leaderboardEligible: true });
      const prog = await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } });
      expect(prog).toMatchObject({ raidWins: 1, raidLosses: 0, studyEnergy: 9 - 3 + 1, totalXp: s1.xp.awarded });
      const quests = await prisma.playerQuest.findMany({ where: { userId: id, quest: { metric: 'battles_won' } } });
      expect(quests.length).toBeGreaterThan(0);
      expect(quests.every((q) => q.progress === 1)).toBe(true);
      expect(s1.progress.totalXp).toBe(s1.xp.awarded);
      expect(await prisma.battle.findUniqueOrThrow({ where: { id: done.id } })).toMatchObject({ rewardsGrantedAt: expect.any(Date) });
    });

    it('a raid defeat pays 40% of the victory formula, no loot, no energy, one loss', async () => {
      const { id, api } = await player(9);
      const done = await playOut(api, await begin(api), false);
      expect(done.status).toBe('defeat');
      const s = await finish(api, done.id);
      const expected = battleXp({ level: 1, isBoss: false, accuracy: 0, mode: 'raid', victory: false, scholar: false, gearXpMult: 1 });
      expect(s.outcome).toBe('defeat');
      expect(s.xp.awarded).toBe(expected);
      const win = battleXp({ level: 1, isBoss: false, accuracy: 0, mode: 'raid', victory: true, scholar: false, gearXpMult: 1 });
      expect(expected).toBe(Math.round(win * BATTLE.rewards.defeatShare));
      expect(s.loot).toBeNull();
      expect(s.energy).toBe(0);
      expect(s.missed.length).toBeGreaterThan(0);
      expect(s.weakSpot).toMatchObject({ subject: 'Math' });
      expect(await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } })).toMatchObject({ raidWins: 0, raidLosses: 1, studyEnergy: 6 });
      expect(await prisma.xpTransaction.count({ where: { userId: id, sourceType: 'battle' } })).toBe(1);
    });

    it('a victory drops loot; a duplicate converts to bonus XP; auto-equip only fills an EMPTY slot', async () => {
      const { id, api } = await player(9);
      // owns every item, so any drop is a duplicate
      const defs = await prisma.itemDefinition.findMany();
      for (const d of defs) await prisma.playerItem.create({ data: { userId: id, itemDefinitionId: d.id, source: 'test' } });
      const done = await playOut(api, await begin(api), true);
      const s = await finish(api, done.id);
      expect(s.loot).toMatchObject({ duplicate: true, equipped: false });
      expect(s.loot!.duplicateXp).toBe(BATTLE.rewards.duplicateXp[s.loot!.rarity]);
      const plain = battleXp({ level: 1, isBoss: false, accuracy: 1, mode: 'raid', victory: true, scholar: false, gearXpMult: 1 });
      expect(s.xp.requested).toBe(plain + s.loot!.duplicateXp);
      expect(await prisma.playerItem.count({ where: { userId: id } })).toBe(defs.length);

      const p2 = await player(9);
      const b2 = await begin(p2.api);
      await prisma.equipment.update({ where: { userId: p2.id }, data: { weaponItemId: null, armorItemId: null } });
      await prisma.playerItem.deleteMany({ where: { userId: p2.id } }); // owns nothing, so no drop is a duplicate
      const d2 = await playOut(p2.api, b2, true);
      const s2 = await finish(p2.api, d2.id);
      expect(s2.loot).toMatchObject({ duplicate: false, equipped: true });
      const eq = await prisma.equipment.findUniqueOrThrow({ where: { userId: p2.id } });
      expect(s2.loot!.slot === 'weapon' ? eq.weaponItemId : eq.armorItemId).not.toBeNull();

      // third: both slots already hold the starter gear -> a drop is never auto-equipped over it
      const p3 = await player(9);
      const s3 = await finish(p3.api, (await playOut(p3.api, await begin(p3.api), true)).id);
      expect(s3.loot).not.toBeNull();
      expect(s3.loot!.equipped).toBe(false);
    });

    it('pity: after 5 regular raid victories without an uncommon-or-better drop, the next drop is at least uncommon', async () => {
      const { id, api } = await player(9);
      for (let i = 0; i < BATTLE.loot.pityAfter; i += 1) {
        await seedFinished(id, { mode: 'raid', status: 'victory', loot: 'common', endedAt: new Date(NOW.getTime() - (10 - i) * 60_000) });
      }
      const done = await playOut(api, await begin(api), true);
      const s = await finish(api, done.id);
      expect(s.loot).not.toBeNull();
      expect(s.loot!.rarity).not.toBe('common');
    });

    it('retreat pays nothing, refunds nothing, and the summary says so', async () => {
      const { id, api } = await player(9);
      const b = await begin(api);
      const mid = (await play(api, b, true)).battle;
      const res = await api.post(`/battles/${b.id}/retreat`);
      expect(res.status).toBe(200);
      expect(res.body.battle.status).toBe('retreated');
      const s = await finish(api, b.id);
      expect(s).toMatchObject({ outcome: 'retreated', energy: 0, loot: null });
      expect(s.xp).toMatchObject({ awarded: 0, requested: 0 });
      expect(mid.questionsAsked).toBe(1);
      expect(await prisma.xpTransaction.count({ where: { userId: id } })).toBe(0);
      expect(await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } })).toMatchObject({ studyEnergy: 6, raidWins: 0, raidLosses: 0 });
      // retreating twice is harmless; a finished battle cannot be answered
      expect((await api.post(`/battles/${b.id}/retreat`)).status).toBe(200);
      expect((await api.post(`/battles/${b.id}/move`, { turnNumber: 1, move: 'steady' })).status).toBe(409);
    });

    it('starting a new battle first settles an ended-but-unclaimed one, so rewards are never lost', async () => {
      const { id, api } = await player(9);
      const done = await playOut(api, await begin(api), true);
      const next = await start(api);
      expect(next.status).toBe(201);
      expect(await prisma.xpTransaction.count({ where: { userId: id, sourceType: 'battle', sourceId: done.id } })).toBe(1);
      expect((await finish(api, done.id)).alreadyFinished).toBe(true);
    });
  });

  describe('practice', () => {
    it('never grants loot, raid wins, energy or quest wins; pays 25% in its own ledger source, not leaderboard-eligible', async () => {
      const { id, api } = await player(0);
      const done = await playOut(api, await begin(api, PRACTICE), true);
      const s = await finish(api, done.id);
      expect(s).toMatchObject({ mode: 'practice', outcome: 'victory', loot: null, energy: 0, firstClear: null });
      const full = battleXp({ level: 1, isBoss: false, accuracy: 1, mode: 'raid', victory: true, scholar: false, gearXpMult: 1 });
      expect(s.xp.requested).toBe(Math.max(1, Math.round(full * BATTLE.rewards.practiceShare)));
      const ledger = await prisma.xpTransaction.findMany({ where: { userId: id } });
      expect(ledger).toHaveLength(1);
      expect(ledger[0]).toMatchObject({ sourceType: 'battle_practice', sourceId: done.id, leaderboardEligible: false });
      const prog = await prisma.playerProgress.findUniqueOrThrow({ where: { userId: id } });
      expect(prog).toMatchObject({ raidWins: 0, raidLosses: 0, studyEnergy: 0 });
      expect(await prisma.playerItem.count({ where: { userId: id } })).toBe(2); // the two starter items only
      const quests = await prisma.playerQuest.findMany({ where: { userId: id, quest: { metric: 'battles_won' } } });
      expect(quests.every((q) => q.progress === 0)).toBe(true);
    });

    it('respects the daily cap: a capped battle still writes a 0 XP ledger row and says so', async () => {
      const { id, api } = await player(0);
      await prisma.xpTransaction.create({
        data: { userId: id, amount: DAILY_XP_CAPS.battle_practice, reason: 'earlier practice', sourceType: 'battle_practice', sourceId: 'earlier', leaderboardEligible: false, levelAfter: 1, createdAt: new Date(NOW.getTime() - 3_600_000) },
      });
      const done = await playOut(api, await begin(api, PRACTICE), true);
      const s = await finish(api, done.id);
      expect(s.xp).toMatchObject({ awarded: 0, capped: true, dailyCap: DAILY_XP_CAPS.battle_practice });
      expect(s.xp.requested).toBeGreaterThan(0);
      const row = await prisma.xpTransaction.findUniqueOrThrow({ where: { userId_sourceType_sourceId: { userId: id, sourceType: 'battle_practice', sourceId: done.id } } });
      expect(row.amount).toBe(0);
      expect(s.progress.totalXp).toBe(0);
    });

    it('practice still reviews due flashcards (and does nothing else for the player)', async () => {
      const { id, api } = await player(0);
      const deck = await prisma.flashcardDeck.create({ data: { userId: id, name: 'Maths deck', subject: 'Math' } });
      const mk = (n: number, difficulty: 'easy' | 'medium' | 'hard') =>
        Array.from({ length: n }, (_, i) => ({ deckId: deck.id, userId: id, question: `${difficulty} card ${i}?`, answer: `A${i}`, distractors: ['Wrong one', 'Wrong two'], subject: 'Math', difficulty, dueAt: new Date(NOW.getTime() - 60_000) }));
      await prisma.flashcard.createMany({ data: [...mk(3, 'easy'), ...mk(3, 'medium'), ...mk(3, 'hard')] });
      const done = await playOut(api, await begin(api, PRACTICE), true);
      const reviews = await prisma.flashcardReview.findMany({ where: { userId: id } });
      expect(reviews.length).toBeGreaterThan(0);
      expect(reviews.every((r) => r.context === 'battle')).toBe(true);
      const due = await prisma.flashcard.count({ where: { userId: id, dueAt: { lte: NOW } } });
      expect(due).toBe(9 - reviews.length);
      expect((await finish(api, done.id)).loot).toBeNull();
    });
  });

  describe('missed questions', () => {
    it('lists what was missed, with the right answer, and the weak spot', async () => {
      const { api } = await player();
      const b = await begin(api);
      const r1 = await play(api, b, false);
      const r2 = await play(api, r1.battle, true);
      await api.post(`/battles/${b.id}/retreat`);
      const s = await finish(api, b.id);
      expect(r2.result.correct).toBe(true);
      expect(s.missed).toHaveLength(1);
      expect(s.missed[0]).toMatchObject({ turnNumber: 1, subject: 'Math', isCard: false });
      expect(s.missed[0]!.choices).toHaveLength(3);
      expect(s.missed[0]!.selectedIndex).not.toBe(s.missed[0]!.correctIndex);
      expect(s.weakSpot).toEqual({ subject: 'Math', missed: 1 });
    });

    it('"Add missed questions to my flashcards" makes a deck once and never duplicates', async () => {
      const { id, api } = await player();
      const b = await begin(api);
      const r1 = await play(api, b, false);
      await play(api, r1.battle, false);
      await api.post(`/battles/${b.id}/retreat`);
      const s = await finish(api, b.id);
      const first = await api.post(`/battles/${b.id}/missed-to-flashcards`);
      expect(first.status).toBe(200);
      expect(first.body).toMatchObject({ deckName: 'Missed in battle', added: s.missed.length, skipped: 0 });
      const cards = await prisma.flashcard.findMany({ where: { userId: id, deckId: first.body.deckId } });
      expect(cards).toHaveLength(s.missed.length);
      for (const c of cards) {
        expect(c.distractors).not.toContain(c.answer);
        expect(c.distractors.join('|')).not.toMatch(/N\/A/);
      }
      const second = await api.post(`/battles/${b.id}/missed-to-flashcards`);
      expect(second.body).toMatchObject({ added: 0, skipped: s.missed.length, deckId: first.body.deckId });
      expect(await prisma.flashcardDeck.count({ where: { userId: id, name: 'Missed in battle' } })).toBe(1);
    });
  });

  describe('ownership', () => {
    it("another player gets 404 on every battle route, and nothing about the battle leaks", async () => {
      const a = await player();
      const b = await player();
      const battle = await begin(a.api);
      const calls = [
        b.api.get(`/battles/${battle.id}`),
        b.api.post(`/battles/${battle.id}/move`, { turnNumber: 1, move: 'steady' }),
        b.api.post(`/battles/${battle.id}/ability`, { turnNumber: 1, ability: 'cleave' }),
        b.api.post(`/battles/${battle.id}/answer`, { turnNumber: 1, selectedIndex: 0 }),
        b.api.post(`/battles/${battle.id}/retreat`),
        b.api.post(`/battles/${battle.id}/finish`),
        b.api.post(`/battles/${battle.id}/missed-to-flashcards`),
      ];
      for (const res of await Promise.all(calls)) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe('BATTLE_NOT_FOUND');
      }
      expect((await b.api.get('/battles/active')).body.battle).toBeNull();
      expect((await a.api.get(`/battles/${battle.id}`)).status).toBe(200);
    });

    it('an Idempotency-Key is per player: the same key from two players starts two battles', async () => {
      const b = await player();
      const c = await player();
      const key = randomUUID();
      const rb = await start(b.api, PRACTICE, key);
      const rc = await start(c.api, PRACTICE, key);
      expect([rb.status, rc.status]).toEqual([201, 201]);
      expect(rb.body.battle.id).not.toBe(rc.body.battle.id);
    });

    it('unauthenticated calls are 401 and bad ids are 400', async () => {
      const { api } = await player();
      expect((await request(app).get('/api/v1/battles/active')).status).toBe(401);
      expect((await api.get('/battles/not-a-uuid')).status).toBe(400);
    });
  });

  /** Inserts an already-finished battle row (for unlock and pity facts). */
  async function seedFinished(
    userId: string,
    o: { mode: 'raid' | 'practice'; status: 'victory' | 'defeat'; loot?: 'common' | 'uncommon' | 'rare'; endedAt?: Date; enemySlug?: string },
  ) {
    const endedAt = o.endedAt ?? new Date(NOW.getTime() - 3_600_000);
    return prisma.battle.create({
      data: {
        userId, mode: o.mode, status: o.status, subject: 'Math', tier: 1, enemySlug: o.enemySlug ?? 'goblin-chieftain',
        enemyMaxHp: 72, enemyHp: 0, playerMaxHp: 100, playerHp: 50, seed: 1, engineState: {}, startedAt: endedAt, endedAt,
        rewardsGrantedAt: endedAt,
        rewardSummary: { loot: o.loot ? { rarity: o.loot } : null },
        idempotencyKey: randomUUID(),
      },
    });
  }
  async function play2(api: Api, b: BattleDto) {
    const t = await turnRow(b.id, b.turn);
    const res = await api.post(`/battles/${b.id}/answer`, { turnNumber: b.turn, selectedIndex: t.correctIndex });
    return res.body as { result: AnswerResultDto; battle: BattleDto };
  }
});
