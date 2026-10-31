import { randomInt } from 'node:crypto';
import {
  BALANCE,
  bankSubject,
  cleanDistractors,
  normalizeText,
  bossGate,
  dungeonGate,
  enemiesForSubject,
  getBoss,
  getDungeon,
  type AnswerResultDto,
  type BattleAbilityInput,
  type BattleAnswerInput,
  type BattleAnswerResponseDto,
  type BattleCreate,
  type BattleCreateResultDto,
  type BattleDto,
  type BattleMoveInput,
  type BattleQuestionResultDto,
  type BattleSummaryDto,
  type MissedToCardsResultDto,
} from '@studyverse/shared';
import { answer, armAbility, chooseMove, createBattle, publicQuestion, retreat } from '../battle/engine.js';
import { pick, rngFor } from '../battle/rng.js';
import { EngineError, type EngineState } from '../battle/types.js';
import type { Battle } from '../generated/prisma/client.js';
import { AppError } from '../lib/errors.js';
import { withPlayerLock } from '../lib/playerLock.js';
import { Prisma, type PrismaClient } from '../lib/prisma.js';
import { applyCardReview } from './cardReview.js';
import { ensureStarterGear, loadHero } from './battleHero.js';
import { buildPool, weakSubjects } from './battlePool.js';
import { battleNotFound, finishBattleInTx } from './battleFinish.js';
import { parseStored, type BattleExtras, type StoredBattle } from './battleTypes.js';
import { loadUnlockFacts } from './battleUnlocks.js';
import { toBattleDto } from './battleView.js';
import { ensurePlayer } from './player.js';
import { recordQuestEvent } from './quests.js';
import { getModifiers } from './streak.js';

type Tx = Prisma.TransactionClient;

const notFound = battleNotFound;
const json = (v: unknown) => v as Prisma.InputJsonValue;

async function loadOwned(tx: Tx, userId: string, id: string) {
  const row = await tx.battle.findFirst({ where: { id, userId } });
  if (!row) throw notFound();
  return { row, stored: parseStored(row) };
}

async function loadExtras(tx: Tx, battleId: string): Promise<BattleExtras> {
  const turns = await tx.battleTurn.findMany({
    where: { battleId, answeredAt: { not: null } },
    orderBy: { turnNumber: 'desc' },
    take: 4,
    select: { result: true },
  });
  const results = turns.map((t) => t.result as unknown as AnswerResultDto | null).filter((r): r is AnswerResultDto => !!r);
  const log = [...results].reverse().flatMap((r) => r.events.map((e) => e.text)).slice(-10);
  return { lastResult: results[0] ?? null, log };
}

async function view(tx: Tx, row: Battle, stored: StoredBattle): Promise<BattleDto> {
  return toBattleDto(row, stored, await loadExtras(tx, row.id));
}

async function save(tx: Tx, row: Battle, stored: StoredBattle, extra: Prisma.BattleUpdateInput = {}): Promise<Battle> {
  const s = stored.engine;
  return tx.battle.update({
    where: { id: row.id },
    data: { engineState: json(stored), enemyHp: s.enemyHp, playerHp: s.heroHp, turn: s.turn, comboStreak: s.combo, focus: s.focus, ...extra },
  });
}

function engineFail(e: unknown): never {
  if (e instanceof EngineError) {
    const msg = e.code === 'NO_QUESTIONS' ? `${e.message} Add flashcards in the Library or pick another subject.` : e.message;
    throw new AppError(409, e.code, msg);
  }
  throw e;
}

function assertTurn(s: EngineState, turnNumber: number): void {
  if (s.phase === 'ended') throw new AppError(409, 'BATTLE_ENDED', 'This battle is over.');
  if (turnNumber !== s.turn) {
    throw new AppError(409, 'STALE_TURN', turnNumber > s.turn ? 'That turn has not opened yet.' : 'That turn is already over.', { currentTurn: s.turn });
  }
}

export async function getActiveBattle(prisma: PrismaClient, userId: string): Promise<BattleDto | null> {
  await ensurePlayer(prisma, userId);
  // A battle that ended but whose rewards were never claimed is offered too, so the player can collect them.
  const row = await prisma.battle.findFirst({
    where: { userId, OR: [{ status: 'active' }, { status: { in: ['victory', 'defeat'] }, rewardsGrantedAt: null }] },
    orderBy: { startedAt: 'desc' },
  });
  return row ? view(prisma, row, parseStored(row)) : null;
}

export async function getBattle(prisma: PrismaClient, userId: string, id: string): Promise<BattleDto> {
  const { row, stored } = await loadOwned(prisma, userId, id);
  return view(prisma, row, stored);
}

/** POST /battles. Needs an Idempotency-Key; the same key returns the same battle and never charges energy twice. */
export async function startBattle(
  prisma: PrismaClient,
  userId: string,
  input: BattleCreate,
  key: string,
  now: Date,
): Promise<BattleCreateResultDto> {
  await ensurePlayer(prisma, userId);
  return withPlayerLock(prisma, userId, async (tx) => {
    const existing = await tx.battle.findUnique({ where: { userId_idempotencyKey: { userId, idempotencyKey: key } } });
    if (existing) return { battle: await view(tx, existing, parseStored(existing)), created: false };

    // Rewards of a battle that ended but was never claimed are paid now (once), so closing the tab never loses them.
    const unclaimed = await tx.battle.findMany({
      where: { userId, status: { in: ['victory', 'defeat'] }, rewardsGrantedAt: null },
      orderBy: { startedAt: 'asc' },
      select: { id: true },
    });
    for (const u of unclaimed) await finishBattleInTx(tx, userId, u.id, now);

    const active = await tx.battle.findFirst({ where: { userId, status: 'active' }, select: { id: true } });
    if (active) throw new AppError(409, 'BATTLE_IN_PROGRESS', 'Finish or retreat from your current battle first.', { battleId: active.id });

    const dungeon = getDungeon(input.tier);
    if (!dungeon) throw new AppError(400, 'UNKNOWN_DUNGEON', 'Unknown dungeon');
    const facts = await loadUnlockFacts(tx, userId);
    const gate = dungeonGate(dungeon, facts);
    if (!gate.open) throw new AppError(403, 'DUNGEON_LOCKED', gate.reason ?? 'This dungeon is locked.');
    if (input.boss) {
      if (input.mode !== 'raid') throw new AppError(400, 'BOSS_RAID_ONLY', 'Bosses can only be fought in raids.');
      const bg = bossGate(dungeon, facts);
      if (!bg.open) throw new AppError(403, 'BOSS_LOCKED', bg.reason ?? 'The boss gate is closed.');
    }

    const seed = randomInt(1, 2_147_483_647);
    const boss = getBoss(dungeon.bossSlug);
    const enemySlug = input.boss && boss ? boss.slug : pick(enemiesForSubject(input.subject), rngFor(seed, 0, 'enemy')).slug;

    const pool = await buildPool(tx, userId, input.subject, now, seed);
    if (pool.length === 0) {
      throw new AppError(409, 'NO_QUESTIONS', 'There are no questions for this subject yet. Add flashcards in the Library or pick another subject.');
    }

    if (input.mode === 'raid') {
      const cost = BALANCE.raid.energyCost;
      const paid = await tx.playerProgress.updateMany({ where: { userId, studyEnergy: { gte: cost } }, data: { studyEnergy: { decrement: cost } } });
      if (paid.count === 0) throw new AppError(409, 'NOT_ENOUGH_ENERGY', `A raid costs ${cost} energy. Finish a study session to earn more.`);
    }

    await ensureStarterGear(tx, userId);
    const hero = await loadHero(tx, userId);
    const engine = createBattle({ mode: input.mode, tier: dungeon.tier, subject: input.subject, enemySlug, hero: hero.stats, seed });
    const stored: StoredBattle = { v: 1, engine, meta: hero.meta };
    const row = await tx.battle.create({
      data: {
        userId, mode: input.mode, subject: input.subject, tier: dungeon.tier, enemySlug,
        enemyMaxHp: engine.enemy.maxHp, enemyHp: engine.enemyHp, playerMaxHp: engine.hero.maxHp, playerHp: engine.heroHp,
        seed, engineState: json(stored), idempotencyKey: key, startedAt: now,
      },
    });
    await tx.battleTurn.create({ data: { battleId: row.id, turnNumber: 1, intent: engine.intent } });
    return { battle: await view(tx, row, stored), created: true };
  });
}

/** POST /battles/:id/move: draws the question the move calls for. Repeating the same move returns the SAME question. */
export async function chooseBattleMove(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: BattleMoveInput,
  now: Date,
): Promise<BattleQuestionResultDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const { row, stored } = await loadOwned(tx, userId, id);
    const s = stored.engine;
    assertTurn(s, input.turnNumber);
    if (s.cur.move) {
      if (s.cur.move !== input.move) {
        throw new AppError(409, 'MOVE_ALREADY_CHOSEN', `You already chose ${s.cur.move} for this turn.`, { move: s.cur.move });
      }
      return { turnNumber: s.turn, question: publicQuestion(s)!, battle: await view(tx, row, stored) };
    }
    const pool = await buildPool(tx, userId, s.subject, now, s.seed + s.turn);
    const weak = s.subject === 'Any' ? await weakSubjects(tx, userId) : [];
    let next: EngineState;
    try {
      next = chooseMove(s, input.move, pool, weak);
    } catch (e) {
      engineFail(e);
    }
    const q = next.cur.question!;
    const nextStored = { ...stored, engine: next };
    await tx.battleTurn.update({
      where: { battleId_turnNumber: { battleId: id, turnNumber: s.turn } },
      data: {
        move: input.move,
        questionId: q.source === 'bank' ? q.id : null,
        cardId: q.source === 'card' ? q.id : null,
        questionDifficulty: q.difficulty,
        questionSubject: q.subject,
        questionText: q.text,
        choices: q.choices,
        correctIndex: q.correctIndex,
        explanation: q.explanation,
      },
    });
    const saved = await save(tx, row, nextStored);
    return { turnNumber: next.turn, question: publicQuestion(next)!, battle: await view(tx, saved, nextStored) };
  });
}

/** POST /battles/:id/ability: arms Cleave / Bulwark, or removes one wrong choice (Insight). */
export async function useBattleAbility(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: BattleAbilityInput,
): Promise<BattleDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const { row, stored } = await loadOwned(tx, userId, id);
    assertTurn(stored.engine, input.turnNumber);
    let next: EngineState;
    try {
      next = armAbility(stored.engine, input.ability);
    } catch (e) {
      engineFail(e);
    }
    const nextStored = { ...stored, engine: next };
    await tx.battleTurn.update({
      where: { battleId_turnNumber: { battleId: id, turnNumber: next.turn } },
      data: { armedAbility: input.ability === 'insight' ? null : input.ability, removedIndex: next.cur.removedIndex },
    });
    const saved = await save(tx, row, nextStored);
    return view(tx, saved, nextStored);
  });
}

/** POST /battles/:id/answer. The server decides everything; replaying a turn returns the stored result. */
export async function answerBattle(
  prisma: PrismaClient,
  userId: string,
  id: string,
  input: BattleAnswerInput,
  now: Date,
): Promise<BattleAnswerResponseDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const { row, stored } = await loadOwned(tx, userId, id);
    const s = stored.engine;
    const done = await tx.battleTurn.findUnique({ where: { battleId_turnNumber: { battleId: id, turnNumber: input.turnNumber } } });
    if (done?.answeredAt && done.result) {
      return { result: done.result as unknown as AnswerResultDto, battle: await view(tx, row, stored) };
    }
    assertTurn(s, input.turnNumber);
    if (s.phase !== 'awaitingAnswer' || !s.cur.question) {
      throw new AppError(409, 'MOVE_REQUIRED', 'Choose a move before answering.');
    }
    const q = s.cur.question;
    if (input.selectedIndex >= q.choices.length) throw new AppError(400, 'BAD_CHOICE', 'That is not one of the choices.');

    let out: { state: EngineState; result: AnswerResultDto };
    try {
      out = answer(s, input.selectedIndex);
    } catch (e) {
      engineFail(e);
    }
    const { state: next, result } = out;
    await tx.battleTurn.update({
      where: { battleId_turnNumber: { battleId: id, turnNumber: s.turn } },
      data: {
        selectedIndex: input.selectedIndex,
        correct: result.correct,
        damageDealt: result.damageDealt,
        damageTaken: result.damageTaken,
        result: json(result),
        answeredAt: now,
      },
    });
    if (!result.ended) {
      await tx.battleTurn.create({ data: { battleId: id, turnNumber: next.turn, intent: next.intent } });
    }

    // The player's own flashcards are reviewed by battles too (practice included); due cards only, once.
    if (q.source === 'card') {
      const card = await tx.flashcard.findFirst({ where: { id: q.id, userId } });
      if (card && card.dueAt.getTime() <= now.getTime()) {
        const mods = await getModifiers(tx, userId);
        const r = await applyCardReview(tx, {
          userId, card, now, context: 'battle', sageMemory: mods.sageMemory,
          quality: result.correct ? BALANCE.srs.choiceCorrectQuality : BALANCE.srs.choiceWrongQuality,
        });
        if (r.applied) await recordQuestEvent(tx, userId, 'cards_reviewed', 1, now);
      }
    }

    const nextStored = { ...stored, engine: next };
    const saved = await save(tx, row, nextStored, result.outcome ? { status: result.outcome, endedAt: now } : {});
    return { result, battle: await view(tx, saved, nextStored) };
  });
}

/** POST /battles/:id/retreat. Always allowed; no rewards, no penalty beyond the energy already spent. */
export async function retreatBattle(prisma: PrismaClient, userId: string, id: string, now: Date): Promise<BattleDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const { row, stored } = await loadOwned(tx, userId, id);
    if (stored.engine.phase === 'ended') {
      if (row.status === 'retreated') return view(tx, row, stored);
      throw new AppError(409, 'BATTLE_ENDED', 'This battle is already over.');
    }
    let next: EngineState;
    try {
      next = retreat(stored.engine);
    } catch (e) {
      engineFail(e);
    }
    const nextStored = { ...stored, engine: next };
    const saved = await save(tx, row, nextStored, { status: 'retreated', endedAt: now });
    await finishBattleInTx(tx, userId, id, now);
    return view(tx, saved, nextStored);
  });
}

/** POST /battles/:id/finish. Pays once; a repeat returns the stored summary. */
export async function finishBattle(prisma: PrismaClient, userId: string, id: string, now: Date): Promise<BattleSummaryDto> {
  return withPlayerLock(prisma, userId, (tx) => finishBattleInTx(tx, userId, id, now));
}

const MISSED_DECK = 'Missed in battle';

/**
 * "Add missed questions to my flashcards": one deck, one card per missed question, deduplicated against every
 * card the player already has (normalized question text). Safe to press twice.
 */
export async function missedToFlashcards(
  prisma: PrismaClient,
  userId: string,
  id: string,
): Promise<MissedToCardsResultDto> {
  return withPlayerLock(prisma, userId, async (tx) => {
    const { row } = await loadOwned(tx, userId, id);
    if (row.status === 'active') throw new AppError(409, 'BATTLE_NOT_OVER', 'Finish the battle first.');
    const turns = await tx.battleTurn.findMany({
      where: { battleId: id, correct: false, answeredAt: { not: null } },
      orderBy: { turnNumber: 'asc' },
    });
    const unique = new Map<string, (typeof turns)[number]>();
    for (const t of turns) {
      if (t.questionText === null || t.correctIndex === null) continue;
      const key = t.questionId ?? t.cardId ?? t.questionText;
      if (!unique.has(key)) unique.set(key, t);
    }
    if (unique.size === 0) throw new AppError(409, 'NOTHING_MISSED', 'You did not miss any questions in this battle.');
    const have = new Set((await tx.flashcard.findMany({ where: { userId }, select: { question: true } })).map((c) => normalizeText(c.question)));
    const fresh = [...unique.values()].filter((t) => {
      if (t.cardId !== null) return false; // already one of the player's own cards
      const norm = normalizeText(t.questionText!);
      if (have.has(norm)) return false;
      have.add(norm);
      return true;
    });

    let deck = await tx.flashcardDeck.findFirst({ where: { userId, name: MISSED_DECK } });
    if (fresh.length > 0) {
      if ((await tx.flashcard.count({ where: { userId } })) + fresh.length > BALANCE.flashcards.maxCardsPerUser) {
        throw new AppError(409, 'TOO_MANY_CARDS', 'This would exceed the card limit.');
      }
      if (!deck) {
        if ((await tx.flashcardDeck.count({ where: { userId } })) >= BALANCE.flashcards.maxDecksPerUser) {
          throw new AppError(409, 'TOO_MANY_DECKS', 'You have reached the deck limit.');
        }
        deck = await tx.flashcardDeck.create({ data: { userId, name: MISSED_DECK, subject: 'Other' } });
      }
      for (const t of fresh) {
        const answer = t.choices[t.correctIndex!]!;
        await tx.flashcard.create({
          data: {
            deckId: deck.id,
            userId,
            question: t.questionText!,
            answer,
            distractors: cleanDistractors(answer, t.choices.filter((_, i) => i !== t.correctIndex)),
            subject: bankSubject(t.questionSubject ?? 'Other'),
            difficulty: t.questionDifficulty ?? 'medium',
          },
        });
      }
    }
    return { deckId: deck?.id ?? null, deckName: MISSED_DECK, added: fresh.length, skipped: unique.size - fresh.length };
  });
}
