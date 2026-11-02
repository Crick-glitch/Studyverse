import { Router } from 'express';
import { profilePatchSchema, type ProfilePatch } from '@studyverse/shared';
import { asyncHandler } from '../lib/asyncHandler.js';
import type { PrismaClient } from '../lib/prisma.js';
import { currentUser } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  ensurePlayer,
  getMe,
  toProfileDto,
  toProgressDto,
  updateProfile,
} from '../services/player.js';

/**
 * Every route here acts on req.user.id (from the verified token) and takes NO user id from the client,
 * so "someone else's profile" is not addressable at all.
 */
export function playerRouter(prisma: PrismaClient): Router {
  const r = Router();

  r.get(
    '/me',
    asyncHandler(async (req, res) => {
      res.json(await getMe(prisma, currentUser(req)));
    }),
  );

  r.get(
    '/profile',
    asyncHandler(async (req, res) => {
      const { profile } = await ensurePlayer(prisma, currentUser(req).id);
      res.json({ profile: toProfileDto(profile) });
    }),
  );

  r.patch(
    '/profile',
    validate({ body: profilePatchSchema }),
    asyncHandler(async (req, res) => {
      const profile = await updateProfile(
        prisma,
        currentUser(req).id,
        req.valid.body as ProfilePatch,
      );
      res.json({ profile });
    }),
  );

  r.get(
    '/progress',
    asyncHandler(async (req, res) => {
      const { progress } = await ensurePlayer(prisma, currentUser(req).id);
      res.json({ progress: toProgressDto(progress) });
    }),
  );

  return r;
}
