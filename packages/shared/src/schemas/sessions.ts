import { z } from 'zod';
import { BALANCE } from '../balance.js';
import type { IneligibleReason } from '../rewards.js';
import {
  cleanLineSchema,
  difficultySchema,
  subjectSchema,
  uuidSchema,
  type Difficulty,
} from '../subjects.js';
import type { ProgressDto } from './profile.js';

export const SESSION_STATUSES = [
  'created',
  'running',
  'paused',
  'finished',
  'claimed',
  'abandoned',
] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const sessionCreateSchema = z
  .object({
    title: cleanLineSchema(1, BALANCE.sessions.titleMaxLength, 'Title').default('Study session'),
    subject: subjectSchema.default('Other'),
    difficulty: difficultySchema.default('medium'),
    plannedMinutes: z
      .number()
      .int()
      .refine((m) => (BALANCE.sessions.allowedMinutes as readonly number[]).includes(m), {
        message: `Duration must be one of ${BALANCE.sessions.allowedMinutes.join(', ')} minutes`,
      }),
  })
  .strict();
export type SessionCreate = z.infer<typeof sessionCreateSchema>;

export const reviewSessionCreateSchema = z
  .object({ deckId: uuidSchema.optional(), startNow: z.boolean().default(false) })
  .strict();
export type ReviewSessionCreate = z.infer<typeof reviewSessionCreateSchema>;

/** focusRatio is advisory; any finite number is accepted and clamped to 0..1 server-side. */
export const sessionFinishSchema = z
  .object({ focusRatio: z.number().finite().optional() })
  .strict();

export const sessionListQuerySchema = z.object({
  status: z.enum(SESSION_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const sessionClaimSchema = z
  .object({
    answers: z
      .array(
        z
          .object({
            position: z.number().int().min(0).max(20),
            selectedIndex: z.number().int().min(0).max(9),
          })
          .strict(),
      )
      .max(20),
  })
  .strict();
export type SessionClaim = z.infer<typeof sessionClaimSchema>;

export interface SessionDto {
  id: string;
  title: string;
  subject: string;
  difficulty: Difficulty;
  kind: 'study' | 'review';
  plannedMinutes: number;
  status: SessionStatus;
  startedAt: string | null;
  pausedAt: string | null;
  finishedAt: string | null;
  /** Server-measured seconds of focus time so far (excludes pauses, capped at the plan). */
  elapsedSec: number;
  remainingSec: number;
  /** Server clock at response time: the client counts down from this, never from its own clock. */
  serverNow: string;
  focusRatioReported: number | null;
  xpAwarded: number;
  energyAwarded: number;
  outcomeReason: string | null;
  /** XP/energy this session would pay on a PERFECT claim, shown while planning. */
  estimate: { xp: number; energy: number };
  createdAt: string;
}

export interface ClaimQuestionDto {
  position: number;
  text: string;
  choices: string[];
}

export interface SessionFinishResultDto {
  session: SessionDto;
  /** True when a claim quiz is waiting; false when the session paid nothing (see outcomeReason). */
  claimable: boolean;
  ineligibleReason: IneligibleReason | null;
}

export interface ClaimResultDto {
  session: SessionDto;
  alreadyClaimed: boolean;
  passed: boolean;
  correct: number;
  total: number;
  xpAwarded: number;
  energyAwarded: number;
  levelsGained: number;
  questions: {
    position: number;
    /** Bank question id, so the player can report it; null for flashcard-based questions. */
    questionId: string | null;
    text: string;
    correct: boolean;
    correctIndex: number;
    selectedIndex: number | null;
  }[];
  progress: ProgressDto;
}
