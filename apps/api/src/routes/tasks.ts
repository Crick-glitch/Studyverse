import { Router } from 'express';
import {
  idParamSchema,
  taskCreateSchema,
  taskListQuerySchema,
  taskPatchSchema,
  type TaskCreate,
  type TaskPatch,
} from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import * as tasks from '../services/tasks.js';

export function tasksRouter(prisma: PrismaClient, clock: () => Date): Router {
  const r = Router();
  const uid = (req: Express.Request) => currentUser(req).id;
  const id = (req: Express.Request) => (req.valid.params as { id: string }).id;

  r.get(
    '/tasks',
    validate({ query: taskListQuerySchema }),
    asyncHandler(async (req, res) => {
      res.json({
        tasks: await tasks.listTasks(
          prisma,
          uid(req),
          req.valid.query as Parameters<typeof tasks.listTasks>[2],
        ),
      });
    }),
  );
  r.post(
    '/tasks',
    validate({ body: taskCreateSchema }),
    asyncHandler(async (req, res) => {
      res
        .status(201)
        .json({ task: await tasks.createTask(prisma, uid(req), req.valid.body as TaskCreate) });
    }),
  );
  r.patch(
    '/tasks/:id',
    validate({ params: idParamSchema, body: taskPatchSchema }),
    asyncHandler(async (req, res) => {
      res.json({
        task: await tasks.updateTask(prisma, uid(req), id(req), req.valid.body as TaskPatch),
      });
    }),
  );
  r.delete(
    '/tasks/:id',
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      await tasks.deleteTask(prisma, uid(req), id(req));
      res.status(204).end();
    }),
  );
  r.post(
    '/tasks/:id/complete',
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      res.json(await tasks.completeTask(prisma, uid(req), id(req), clock()));
    }),
  );
  r.post(
    '/tasks/:id/reopen',
    validate({ params: idParamSchema }),
    asyncHandler(async (req, res) => {
      res.json({ task: await tasks.reopenTask(prisma, uid(req), id(req)) });
    }),
  );
  return r;
}
