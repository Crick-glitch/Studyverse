import { z } from 'zod';
import { BALANCE } from '../balance.js';
import type { ProgressDto } from './profile.js';

const L = BALANCE.importLimits;
const str = (max: number) => z.string().max(max);
const loose = z.number().finite();

/**
 * The shape of the old app's `localStorage['studyverse-data']`. Everything is optional and bounded; list
 * ITEMS are validated one by one by the importer (a bad row is skipped and reported, it does not fail the
 * whole import). Unknown top-level keys are dropped, never stored.
 */
export const legacyPayloadSchema = z.object({
  level: loose.optional(),
  totalXP: loose.optional(),
  currentLevelXP: loose.optional(),
  streak: loose.optional(),
  lastActivityDate: str(60).optional(),
  totalTasksCompleted: loose.optional(),
  studyEnergy: loose.optional(),
  skillPoints: loose.optional(),
  raidWins: loose.optional(),
  raidLosses: loose.optional(),
  playerClass: str(20).nullable().optional(),
  avatarName: str(80).nullable().optional(),
  avatarEmoji: str(40).nullable().optional(),
  avatarImage: str(L.maxAvatarDataUrlChars).nullable().optional(),
  unlockedSkills: z
    .record(str(60), z.unknown())
    .refine((v) => Object.keys(v).length <= 60, 'Too many skills')
    .optional(),
  equipment: z.object({ weapon: z.unknown().optional(), armor: z.unknown().optional() }).optional(),
  tasks: z.array(z.unknown()).max(L.maxTasks).default([]),
  sessions: z.array(z.unknown()).max(L.maxSessions).default([]),
  flashcards: z.array(z.unknown()).max(L.maxFlashcards).default([]),
  raidHistory: z.array(z.unknown()).max(L.maxRaidHistory).default([]),
});
export type LegacyPayload = z.infer<typeof legacyPayloadSchema>;

export const legacyTaskSchema = z.object({
  title: str(500),
  difficulty: z.enum(['easy', 'medium', 'hard']).catch('medium'),
  completed: z.boolean().catch(false),
  createdDate: str(60).optional(),
});
export const legacySessionSchema = z.object({
  title: str(500).optional(),
  subject: str(80).optional(),
  duration: loose,
  difficulty: z.enum(['easy', 'medium', 'hard']).catch('medium'),
  validated: z.boolean().catch(false),
  xpEarned: loose.catch(0),
  energyEarned: loose.catch(0),
  completedDate: str(60).nullable().optional(),
  focusRatio: loose.catch(0),
  createdDate: str(60).optional(),
});
export const legacyFlashcardSchema = z.object({
  question: str(5000),
  correct: str(5000),
  answers: z.array(z.string().max(5000)).max(20).catch([]),
  subject: str(80).optional(),
  ease: loose.catch(BALANCE.srs.startEase),
  interval: loose.catch(0),
  repetitions: loose.catch(0),
  nextReview: str(60).optional(),
});
export const legacyItemSchema = z.object({ name: str(120) });

export const importRequestSchema = z
  .object({
    payload: legacyPayloadSchema,
    /** Required when the account already has progress: the player must explicitly choose to merge. */
    onExistingProgress: z.literal('merge').optional(),
  })
  .strict();
export type ImportRequest = z.infer<typeof importRequestSchema>;

export interface ImportPreflightDto {
  hasProgress: boolean;
  existing: { totalXp: number; tasks: number; sessions: number; flashcards: number };
}
export interface ImportReportDto {
  alreadyImported: boolean;
  imported: {
    xp: number;
    tasks: number;
    sessions: number;
    flashcards: number;
    skills: number;
    items: number;
    profileFields: string[];
  };
  /** Things that were in the file but not imported, with the reason. */
  skipped: { what: string; count: number; reason: string }[];
  /** Fields the new game does not import at all (and why). */
  notImported: string[];
  /** Plain-language notes (e.g. the level was recalculated). */
  notes: string[];
  progress: ProgressDto;
}
