import type { QuestMetric } from '@studyverse/shared';

export interface QuestSeed {
  slug: string;
  period: 'daily' | 'weekly';
  title: string;
  description: string;
  metric: QuestMetric;
  target: number;
  rewardXp: number;
  rewardEnergy: number;
}

/** Adventure quests (04-rpg-design-spec "Quests"): 3 daily, 2 weekly. Progress comes from real events only. */
export const QUESTS: QuestSeed[] = [
  {
    slug: 'daily-finish-session',
    period: 'daily',
    title: 'Finish a study session',
    description: 'Complete and claim 1 study session today.',
    metric: 'sessions_claimed',
    target: 1,
    rewardXp: 30,
    rewardEnergy: 1,
  },
  {
    slug: 'daily-review-cards',
    period: 'daily',
    title: 'Review 10 flashcards',
    description: 'Review 10 flashcards in the Lab or in a review session today.',
    metric: 'cards_reviewed',
    target: 10,
    rewardXp: 30,
    rewardEnergy: 0,
  },
  {
    slug: 'daily-win-battle',
    period: 'daily',
    title: 'Win a battle',
    description: 'Win 1 dungeon raid in any subject today.',
    metric: 'battles_won',
    target: 1,
    rewardXp: 30,
    rewardEnergy: 0,
  },
  {
    slug: 'weekly-win-battles',
    period: 'weekly',
    title: 'Win 5 battles',
    description: 'Win 5 dungeon raids this week.',
    metric: 'battles_won',
    target: 5,
    rewardXp: 100,
    rewardEnergy: 0,
  },
  {
    slug: 'weekly-study-minutes',
    period: 'weekly',
    title: 'Study for 150 minutes',
    description: 'Earn 150 minutes of claimed study time this week.',
    metric: 'study_minutes',
    target: 150,
    rewardXp: 100,
    rewardEnergy: 0,
  },
];
