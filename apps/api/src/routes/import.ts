import { Router } from 'express';
import type { RequestHandler } from 'express';
import { importRequestSchema, type ImportRequest } from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { importLocal, preflight } from '../services/importLocal.js';

/** Local-data import (03-core-modules section 5). Never automatic: the web app asks the player first. */
export function importRouter(
  prisma: PrismaClient,
  clock: () => Date,
  limiter: RequestHandler,
): Router {
  const r = Router();
  r.get(
    '/import/local/preflight',
    asyncHandler(async (req, res) => {
      res.json(await preflight(prisma, currentUser(req).id));
    }),
  );
  r.post(
    '/import/local',
    limiter,
    validate({ body: importRequestSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        report: await importLocal(
          prisma,
          currentUser(req).id,
          req.valid.body as ImportRequest,
          clock(),
        ),
      });
    }),
  );
  return r;
}
