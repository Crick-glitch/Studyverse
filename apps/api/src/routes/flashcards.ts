import { Router } from 'express';
import type { RequestHandler } from 'express';
import {
  cardPatchSchema,
  cardsCreateSchema,
  csvBodySchema,
  csvExportQuerySchema,
  deckCreateSchema,
  deckPatchSchema,
  dueQuerySchema,
  idParamSchema,
  reviewSubmitSchema,
  type CardPatch,
  type CardsCreate,
  type ReviewSubmit,
} from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as decks from '../services/decks.js';
import * as csv from '../services/flashcardCsv.js';
import * as review from '../services/review.js';

/** Decks, cards, the review queue and CSV. Everything is scoped to req.user.id. */
export function flashcardsRouter(
  prisma: PrismaClient,
  clock: () => Date,
  importLimiter: RequestHandler,
): Router {
  const r = Router();
  const uid = (req: Express.Request) => currentUser(req).id;
  const id = (req: Express.Request) => (req.valid.params as { id: string }).id;
  const params = validate({ params: idParamSchema });

  r.get(
    '/decks',
    asyncHandler(async (req, res) => {
      res.json({ decks: await decks.listDecks(prisma, uid(req), clock()) });
    }),
  );
  r.post(
    '/decks',
    validate({ body: deckCreateSchema }),
    asyncHandler(async (req, res) => {
      const b = req.valid.body as { name: string; subject: string };
      res.status(201).json({ deck: await decks.createDeck(prisma, uid(req), b, clock()) });
    }),
  );
  r.patch(
    '/decks/:id',
    validate({ params: idParamSchema, body: deckPatchSchema }),
    asyncHandler(async (req, res) => {
      const b = req.valid.body as { name?: string; subject?: string };
      res.json({ deck: await decks.patchDeck(prisma, uid(req), id(req), b, clock()) });
    }),
  );
  r.delete(
    '/decks/:id',
    params,
    asyncHandler(async (req, res) => {
      await decks.deleteDeck(prisma, uid(req), id(req));
      res.status(204).end();
    }),
  );

  r.get(
    '/decks/:id/cards',
    params,
    asyncHandler(async (req, res) => {
      res.json({ cards: await decks.listCards(prisma, uid(req), id(req)) });
    }),
  );
  r.post(
    '/decks/:id/cards',
    validate({ params: idParamSchema, body: cardsCreateSchema }),
    asyncHandler(async (req, res) => {
      const cards = await decks.createCards(
        prisma,
        uid(req),
        id(req),
        req.valid.body as CardsCreate,
      );
      res.status(201).json({ cards });
    }),
  );
  r.patch(
    '/cards/:id',
    validate({ params: idParamSchema, body: cardPatchSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        card: await decks.patchCard(prisma, uid(req), id(req), req.valid.body as CardPatch),
      });
    }),
  );
  r.delete(
    '/cards/:id',
    params,
    asyncHandler(async (req, res) => {
      await decks.deleteCard(prisma, uid(req), id(req));
      res.status(204).end();
    }),
  );

  r.get(
    '/flashcards/due',
    validate({ query: dueQuerySchema }),
    asyncHandler(async (req, res) => {
      const q = req.valid.query as { deckId?: string; limit: number };
      const now = clock();
      res.json({
        ...(await review.getDueQueue(prisma, uid(req), q, now)),
        serverNow: now.toISOString(),
      });
    }),
  );
  r.post(
    '/cards/:id/review',
    validate({ params: idParamSchema, body: reviewSubmitSchema }),
    asyncHandler(async (req, res) => {
      res.json(
        await review.submitReview(
          prisma,
          uid(req),
          id(req),
          req.valid.body as ReviewSubmit,
          clock(),
        ),
      );
    }),
  );

  // CSV: preview (nothing written), import (rate-limited, bigger body), export.
  r.post(
    '/decks/:id/csv/preview',
    importLimiter,
    validate({ params: idParamSchema, body: csvBodySchema }),
    asyncHandler(async (req, res) => {
      const { csv: text } = req.valid.body as { csv: string };
      res.json(await csv.previewCsv(prisma, uid(req), id(req), text));
    }),
  );
  r.post(
    '/decks/:id/csv/import',
    importLimiter,
    validate({ params: idParamSchema, body: csvBodySchema }),
    asyncHandler(async (req, res) => {
      const { csv: text } = req.valid.body as { csv: string };
      res.json(await csv.importCsv(prisma, uid(req), id(req), text));
    }),
  );
  const sendCsv = (
    deckId: string | undefined,
    includeReview: boolean,
    req: Express.Request,
    res: import('express').Response,
  ) =>
    csv.exportCsv(prisma, uid(req), deckId, includeReview).then(({ csv: body, filename }) => {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(body);
    });
  r.get(
    '/decks/:id/csv',
    validate({ params: idParamSchema, query: csvExportQuerySchema }),
    asyncHandler(async (req, res) => {
      const q = req.valid.query as { includeReview: boolean };
      await sendCsv(id(req), q.includeReview, req, res);
    }),
  );
  r.get(
    '/flashcards/csv',
    validate({ query: csvExportQuerySchema }),
    asyncHandler(async (req, res) => {
      const q = req.valid.query as { includeReview: boolean };
      await sendCsv(undefined, q.includeReview, req, res);
    }),
  );
  return r;
}
