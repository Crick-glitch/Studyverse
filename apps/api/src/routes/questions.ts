import { Router } from 'express';
import { idParamSchema, questionReportSchema } from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { reportQuestion } from '../services/questions.js';

export function questionsRouter(prisma: PrismaClient): Router {
  const r = Router();
  r.post(
    '/questions/:id/report',
    validate({ params: idParamSchema, body: questionReportSchema }),
    asyncHandler(async (req, res) => {
      const { id } = req.valid.params as { id: string };
      const { reason } = req.valid.body as { reason?: string };
      res.status(201).json(await reportQuestion(prisma, currentUser(req).id, id, reason));
    }),
  );
  return r;
}
