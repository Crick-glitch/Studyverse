import { Router } from 'express';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { getSummary } from '../services/summary.js';

/** GET /summary: counts for the hotbar badges and the HUD session chip. Acts on req.user.id only. */
export function summaryRouter(prisma: PrismaClient, clock: () => Date): Router {
  const r = Router();
  r.get(
    '/summary',
    asyncHandler(async (req, res) => {
      res.json(await getSummary(prisma, currentUser(req).id, clock()));
    }),
  );
  return r;
}
