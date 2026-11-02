import { Router } from 'express';
import { playerQuestParamSchema } from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { ensurePlayer } from '../services/player.js';
import { claimQuest, listQuests } from '../services/quests.js';

export function questsRouter(prisma: PrismaClient, clock: () => Date): Router {
  const r = Router();
  r.get(
    '/quests',
    asyncHandler(async (req, res) => {
      const userId = currentUser(req).id;
      await ensurePlayer(prisma, userId);
      res.json({ quests: await listQuests(prisma, userId, clock()) });
    }),
  );
  r.post(
    '/quests/:id/claim',
    validate({ params: playerQuestParamSchema }),
    asyncHandler(async (req, res) => {
      const { id } = req.valid.params as { id: string };
      res.json(await claimQuest(prisma, currentUser(req).id, id, clock()));
    }),
  );
  return r;
}
