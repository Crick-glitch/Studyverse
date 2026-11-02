import { randomBytes } from 'node:crypto';
import {
  displayNameKey,
  levelFromTotalXp,
  type MeDto,
  type ProfileDto,
  type ProfilePatch,
  type ProgressDto,
} from '@studyverse/shared';
import { AppError } from '../lib/errors.js';
import { isUniqueViolation, type Db, type PrismaClient } from '../lib/prisma.js';
import type { PlayerProfile, PlayerProgress } from '../generated/prisma/client.js';

/** Default public name. Derived from the id so it is stable and (practically) unique. */
const defaultName = (userId: string, attempt: number) =>
  `Adventurer-${attempt === 0 ? userId.replace(/-/g, '').slice(0, 8) : randomBytes(4).toString('hex')}`;

/**
 * Idempotent "get or create": the first authenticated request creates the profile and progress rows.
 * Safe under parallel calls: inserts use ON CONFLICT DO NOTHING, so exactly one row is ever created.
 */
export async function ensurePlayer(
  prisma: PrismaClient,
  userId: string,
): Promise<{ profile: PlayerProfile; progress: PlayerProgress }> {
  for (let attempt = 0; attempt < 4; attempt++) {
    const found = await load(prisma, userId);
    if (found) return found;

    const displayName = defaultName(userId, attempt);
    await prisma.$transaction(async (tx) => {
      // skipDuplicates also swallows a display-name collision; the loop below then retries with a
      // random suffix when the profile still does not exist.
      await tx.playerProfile.createMany({
        data: [{ id: userId, displayName, displayNameKey: displayNameKey(displayName) }],
        skipDuplicates: true,
      });
      const exists = await tx.playerProfile.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (exists) await tx.playerProgress.createMany({ data: [{ userId }], skipDuplicates: true });
    });
  }
  const last = await load(prisma, userId);
  if (!last)
    throw new AppError(500, 'PROFILE_CREATE_FAILED', 'Could not create the player profile');
  return last;
}

async function load(db: Db, userId: string) {
  const profile = await db.playerProfile.findUnique({ where: { id: userId } });
  if (!profile) return null;
  const progress = await db.playerProgress.findUnique({ where: { userId } });
  if (!progress) return null;
  return { profile, progress };
}

export const toProfileDto = (p: PlayerProfile): ProfileDto => ({
  id: p.id,
  displayName: p.displayName,
  avatarKey: p.avatarKey,
  avatarUrl: p.avatarUrl,
  playerClass: p.playerClass,
  showOnLeaderboard: p.showOnLeaderboard,
  createdAt: p.createdAt.toISOString(),
});

export function toProgressDto(p: PlayerProgress): ProgressDto {
  // Derived from lifetime XP so the numbers can never drift from the level curve.
  const info = levelFromTotalXp(p.totalXp);
  return {
    level: info.level,
    totalXp: p.totalXp,
    currentLevelXp: info.currentLevelXp,
    xpForNextLevel: info.xpForNextLevel,
    streak: p.streak,
    studyEnergy: p.studyEnergy,
    skillPoints: p.skillPoints,
    raidWins: p.raidWins,
    raidLosses: p.raidLosses,
  };
}

export async function getMe(
  prisma: PrismaClient,
  user: { id: string; email: string | null },
): Promise<MeDto> {
  const { profile, progress } = await ensurePlayer(prisma, user.id);
  return {
    user: { id: user.id, email: user.email },
    profile: toProfileDto(profile),
    progress: toProgressDto(progress),
  };
}

export async function updateProfile(
  prisma: PrismaClient,
  userId: string,
  patch: ProfilePatch,
): Promise<ProfileDto> {
  await ensurePlayer(prisma, userId);
  try {
    const updated = await prisma.playerProfile.update({
      where: { id: userId },
      data: {
        ...(patch.displayName !== undefined && {
          displayName: patch.displayName,
          displayNameKey: displayNameKey(patch.displayName),
        }),
        ...(patch.avatarKey !== undefined && { avatarKey: patch.avatarKey }),
        ...(patch.playerClass !== undefined && { playerClass: patch.playerClass }),
        ...(patch.showOnLeaderboard !== undefined && {
          showOnLeaderboard: patch.showOnLeaderboard,
        }),
      },
    });
    return toProfileDto(updated);
  } catch (err) {
    if (isUniqueViolation(err)) {
      throw new AppError(409, 'DISPLAY_NAME_TAKEN', 'That display name is already taken');
    }
    throw err;
  }
}
