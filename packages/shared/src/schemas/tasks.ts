import { z } from 'zod';
import { BALANCE } from '../balance.js';
import {
  cleanLineSchema,
  difficultySchema,
  subjectTextSchema,
  type Difficulty,
} from '../subjects.js';
import type { ProgressDto } from './profile.js';

export const taskTitleSchema = cleanLineSchema(1, BALANCE.tasks.titleMaxLength, 'Title');

export const taskCreateSchema = z
  .object({
    title: taskTitleSchema,
    difficulty: difficultySchema.default('medium'),
    subject: subjectTextSchema.default('Other'),
  })
  .strict();
export type TaskCreate = z.infer<typeof taskCreateSchema>;

export const taskPatchSchema = z
  .object({
    title: taskTitleSchema.optional(),
    difficulty: difficultySchema.optional(),
    subject: subjectTextSchema.optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });
export type TaskPatch = z.infer<typeof taskPatchSchema>;

export const taskListQuerySchema = z.object({
  status: z.enum(['open', 'completed']).optional(),
  difficulty: difficultySchema.optional(),
  subject: subjectTextSchema.optional(),
});

export interface TaskDto {
  id: string;
  title: string;
  difficulty: Difficulty;
  subject: string;
  status: 'open' | 'completed';
  /** What completing it pays (shown BEFORE completion). */
  rewardXp: number;
  /** True once this task has paid out (it can never pay again). */
  rewarded: boolean;
  completedAt: string | null;
  createdAt: string;
}

export type TaskRewardNote = 'paid' | 'already_paid' | 'daily_cap_reached';
export interface TaskCompleteResultDto {
  task: TaskDto;
  reward: {
    xp: number;
    note: TaskRewardNote;
    levelsGained: number;
    skillPointsAwarded: number;
  };
  progress: ProgressDto;
}
