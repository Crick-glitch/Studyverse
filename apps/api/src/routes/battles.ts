import { Router } from 'express';
import {
  battleAbilitySchema,
  battleAnswerSchema,
  battleCreateSchema,
  battleMoveSchema,
  idParamSchema,
  idempotencyKeySchema,
  type BattleAbilityInput,
  type BattleAnswerInput,
  type BattleCreate,
  type BattleMoveInput,
} from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import { AppError } from '../lib/errors.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import type { RateLimiters } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import * as battles from '../services/battles.js';

/**
 * Battles. Server-authoritative: the browser only ever sends a move, an ability, or a chosen answer index; the
 * server draws the question, judges the answer and pays the rewards. Every route acts on req.user.id and battle
 * ids are only looked up WITHIN that user (another player's battle is a 404).
 */
export function battlesRouter(prisma: PrismaClient, clock: () => Date, limiters: Pick<RateLimiters, 'battleAnswer'>): Router {
  const r = Router();
  const uid = (req: Express.Request) => currentUser(req).id;
  const idParams = validate({ params: idParamSchema });
  const id = (req: Express.Request) => (req.valid.params as { id: string }).id;
  const turnLimit = limiters.battleAnswer;

  r.get('/battles/active', asyncHandler(async (req, res) => {
    res.json({ battle: await battles.getActiveBattle(prisma, uid(req)) });
  }));

  r.post('/battles', validate({ body: battleCreateSchema }), asyncHandler(async (req, res) => {
    const key = idempotencyKeySchema.safeParse(req.header('Idempotency-Key'));
    if (!key.success) {
      throw new AppError(400, 'IDEMPOTENCY_KEY_REQUIRED', 'Send an Idempotency-Key header (8 to 80 characters) so a double click starts one battle.');
    }
    const out = await battles.startBattle(prisma, uid(req), req.valid.body as BattleCreate, key.data, clock());
    res.status(out.created ? 201 : 200).json(out);
  }));

  r.get('/battles/:id', idParams, asyncHandler(async (req, res) => {
    res.json({ battle: await battles.getBattle(prisma, uid(req), id(req)) });
  }));

  r.post('/battles/:id/move', turnLimit, validate({ params: idParamSchema, body: battleMoveSchema }), asyncHandler(async (req, res) => {
    res.json(await battles.chooseBattleMove(prisma, uid(req), id(req), req.valid.body as BattleMoveInput, clock()));
  }));

  r.post('/battles/:id/ability', turnLimit, validate({ params: idParamSchema, body: battleAbilitySchema }), asyncHandler(async (req, res) => {
    res.json({ battle: await battles.useBattleAbility(prisma, uid(req), id(req), req.valid.body as BattleAbilityInput) });
  }));

  r.post('/battles/:id/answer', turnLimit, validate({ params: idParamSchema, body: battleAnswerSchema }), asyncHandler(async (req, res) => {
    res.json(await battles.answerBattle(prisma, uid(req), id(req), req.valid.body as BattleAnswerInput, clock()));
  }));

  r.post('/battles/:id/retreat', idParams, asyncHandler(async (req, res) => {
    res.json({ battle: await battles.retreatBattle(prisma, uid(req), id(req), clock()) });
  }));

  r.post('/battles/:id/finish', idParams, asyncHandler(async (req, res) => {
    res.json({ summary: await battles.finishBattle(prisma, uid(req), id(req), clock()) });
  }));

  r.post('/battles/:id/missed-to-flashcards', idParams, asyncHandler(async (req, res) => {
    res.json(await battles.missedToFlashcards(prisma, uid(req), id(req)));
  }));

  return r;
}
