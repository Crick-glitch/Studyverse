import { z } from 'zod';
import type { ProgressDto } from './profile.js';

export const QUEST_METRICS = [
  'sessions_claimed',
  'cards_reviewed',
  'battles_won',
  'study_minutes',
] as const;
export type QuestMetric = (typeof QUEST_METRICS)[number];

export const playerQuestParamSchema = z.object({ id: z.string().uuid() });

export interface QuestDto {
  /** PlayerQuest id (the thing you claim). */
  id: string;
  slug: string;
  period: 'daily' | 'weekly';
  periodKey: string;
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  progress: number;
  rewardXp: number;
  rewardEnergy: number;
  claimable: boolean;
  claimed: boolean;
  /** When this quest instance expires and a fresh one starts (UTC). */
  resetsAt: string;
}
export interface QuestClaimResultDto {
  quest: QuestDto;
  alreadyClaimed: boolean;
  xp: number;
  energy: number;
  levelsGained: number;
  progress: ProgressDto;
}
