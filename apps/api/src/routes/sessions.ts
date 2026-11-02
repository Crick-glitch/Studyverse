import { Router } from 'express';
import {
  idParamSchema,
  reviewSessionCreateSchema,
  sessionClaimSchema,
  sessionCreateSchema,
  sessionFinishSchema,
  sessionListQuerySchema,
  type ReviewSessionCreate,
  type SessionClaim,
  type SessionCreate,
  type SessionStatus,
} from '@studyverse/shared';
import { z } from 'zod';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as sessions from '../services/sessions.js';

/** Study sessions. Every route acts on req.user.id; session ids are only looked up WITHIN that user. */
export function sessionsRouter(prisma: PrismaClient, clock: () => Date): Router {
  const r = Router();
  const uid = (req: Express.Request) => currentUser(req).id;
  const idParams = validate({ params: idParamSchema });
  const id = (req: Express.Request) => (req.valid.params as { id: string }).id;

  r.get(
    '/sessions',
    validate({ query: sessionListQuerySchema }),
    asyncHandler(async (req, res) => {
      const q = req.valid.query as { status?: SessionStatus; limit: number };
      res.json({ sessions: await sessions.listSessions(prisma, uid(req), q, clock()) });
    }),
  );

  r.get(
    '/sessions/active',
    asyncHandler(async (req, res) => {
      const now = clock();
      res.json({
        session: await sessions.getActiveSession(prisma, uid(req), now),
        serverNow: now.toISOString(),
      });
    }),
  );

  r.post(
    '/sessions',
    validate({ body: sessionCreateSchema }),
    asyncHandler(async (req, res) => {
      const session = await sessions.createSession(
        prisma,
        uid(req),
        req.valid.body as SessionCreate,
        clock(),
      );
      res.status(201).json({ session });
    }),
  );

  r.post(
    '/sessions/review',
    validate({ body: reviewSessionCreateSchema }),
    asyncHandler(async (req, res) => {
      const body = req.valid.body as ReviewSessionCreate;
      const session = await sessions.createReviewSession(prisma, uid(req), body, clock());
      res.status(201).json({ session });
    }),
  );

  r.get(
    '/sessions/:id',
    idParams,
    asyncHandler(async (req, res) => {
      res.json({ session: await sessions.getSession(prisma, uid(req), id(req), clock()) });
    }),
  );

  r.delete(
    '/sessions/:id',
    idParams,
    asyncHandler(async (req, res) => {
      await sessions.deleteCreatedSession(prisma, uid(req), id(req));
      res.status(204).end();
    }),
  );

  const action = (
    path: string,
    fn: (userId: string, sessionId: string, now: Date) => Promise<unknown>,
    wrap: string,
  ) =>
    r.post(
      `/sessions/:id/${path}`,
      validate({ params: idParamSchema, body: z.object({}).strict().optional() }),
      asyncHandler(async (req, res) => {
        res.json({ [wrap]: await fn(uid(req), id(req), clock()) });
      }),
    );
  action('start', (u, s, n) => sessions.startSession(prisma, u, s, n), 'session');
  action('pause', (u, s, n) => sessions.pauseSession(prisma, u, s, n), 'session');
  action('resume', (u, s, n) => sessions.resumeSession(prisma, u, s, n), 'session');
  action('abandon', (u, s, n) => sessions.abandonSession(prisma, u, s, n), 'session');

  r.post(
    '/sessions/:id/finish',
    validate({ params: idParamSchema, body: sessionFinishSchema }),
    asyncHandler(async (req, res) => {
      const body = req.valid.body as { focusRatio?: number };
      res.json(await sessions.finishSession(prisma, uid(req), id(req), body.focusRatio, clock()));
    }),
  );

  r.get(
    '/sessions/:id/claim',
    idParams,
    asyncHandler(async (req, res) => {
      res.json(await sessions.getClaimQuiz(prisma, uid(req), id(req), clock()));
    }),
  );

  r.post(
    '/sessions/:id/claim',
    validate({ params: idParamSchema, body: sessionClaimSchema }),
    asyncHandler(async (req, res) => {
      res.json(
        await sessions.claimSession(
          prisma,
          uid(req),
          id(req),
          req.valid.body as SessionClaim,
          clock(),
        ),
      );
    }),
  );

  return r;
}
