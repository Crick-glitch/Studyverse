import { z } from 'zod';
import { BALANCE } from '../balance.js';

export const PLAYER_CLASSES = ['warrior', 'tank', 'scholar'] as const;
export const playerClassSchema = z.enum(PLAYER_CLASSES);
export type PlayerClass = z.infer<typeof playerClassSchema>;

/**
 * Public display name: 3-20 chars, letters/digits plus space, underscore, hyphen; must start and end
 * with a letter or digit. No "@" or dots/slashes, so emails and URLs cannot be used as names.
 */
export const displayNameSchema = z
  .string()
  .transform((v) => v.normalize('NFC').trim().replace(/\s+/g, ' '))
  .pipe(
    z
      .string()
      .min(BALANCE.displayName.minLength, 'Display name is too short')
      .max(BALANCE.displayName.maxLength, 'Display name is too long')
      .regex(
        /^[\p{L}\p{N}](?:[\p{L}\p{N} _-]*[\p{L}\p{N}])?$/u,
        'Use letters, numbers, spaces, "_" or "-" only',
      ),
  );

/** Preset avatar keys are plain slugs (illustrated presets arrive with the art phase). */
export const avatarKeySchema = z
  .string()
  .regex(/^[a-z0-9][a-z0-9._-]{0,63}$/, 'Invalid avatar key');

/** PATCH /profile body. Strict: unknown keys (e.g. an attempt to send "id") are rejected. */
export const profilePatchSchema = z
  .object({
    displayName: displayNameSchema.optional(),
    avatarKey: avatarKeySchema.nullable().optional(),
    playerClass: playerClassSchema.nullable().optional(),
    showOnLeaderboard: z.boolean().optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
export type ProfilePatch = z.infer<typeof profilePatchSchema>;

/** The key a display name is made unique on (case-insensitive). */
export const displayNameKey = (name: string): string => name.toLowerCase();

export interface ProfileDto {
  id: string;
  displayName: string;
  avatarKey: string | null;
  avatarUrl: string | null;
  playerClass: PlayerClass | null;
  showOnLeaderboard: boolean;
  createdAt: string;
}

export interface ProgressDto {
  level: number;
  totalXp: number;
  currentLevelXp: number;
  xpForNextLevel: number;
  streak: number;
  studyEnergy: number;
  skillPoints: number;
  raidWins: number;
  raidLosses: number;
}

export interface MeDto {
  user: { id: string; email: string | null };
  profile: ProfileDto;
  progress: ProgressDto;
}
