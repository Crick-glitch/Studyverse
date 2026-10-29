/**
 * Single home for game-balance constants (00-master-context, Conventions).
 * Values are added by the phase that implements the rule (see 04-rpg-design-spec.md).
 * Do not put magic numbers in components or services.
 */
export const BALANCE = {
  levels: {
    /**
     * CUMULATIVE total XP at which each level is reached: index 0 -> level 1, index 1 -> level 2 ...
     * (level 2 at 100 total XP, level 3 at 250, ...). See docs/DECISIONS.md #11.
     */
    thresholds: [0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250],
    /** Beyond the table, each further level adds this much to the cumulative threshold. */
    stepAfterTable: 500,
    skillPointsPerLevel: 1,
  },
  /** XP for personal tasks (03-core-modules). */
  taskXp: { easy: 10, medium: 25, hard: 50 },
  /**
   * Personal tasks are self-reported, so only this many completions per UTC day pay XP (anti-farming;
   * the rest still complete, they just pay 0). See docs/DECISIONS.md #28.
   */
  tasks: { dailyRewardedCompletions: 10, titleMaxLength: 200 },
  displayName: { minLength: 3, maxLength: 20 },

  /** Study sessions (03-core-modules section 3). All timing is SERVER time. */
  sessions: {
    /** Sessions that were created but never started pile up; cap them. */
    maxCreatedAtOnce: 20,
    allowedMinutes: [10, 25, 50],
    /** Finishing with less than this share of the planned time pays nothing. */
    minElapsedRatio: 0.8,
    difficultyMultiplier: { easy: 0.8, medium: 1, hard: 1.5 },
    streakBonusPerDay: 0.02,
    streakBonusCap: 0.25,
    minutesPerEnergy: 10,
    minEnergy: 1,
    /** Client-reported focus is advisory and clamped to 0..1. Below `noRewardBelow` pays nothing. */
    focus: { noRewardBelow: 0.5, fullRewardFrom: 0.8, partialMultiplier: 0.75 },
    /** Claim quiz: pass = at least ceil(total * passFraction) correct. A fail pays failMultiplier. */
    claim: { questionCount: 5, passFraction: 0.8, failMultiplier: 0.5 },
    /** Review sessions built from due flashcards (old rule: about 2 cards per minute, min 5). */
    review: { minMinutes: 5, maxMinutes: 50, cardsPerMinute: 2 },
    /** A running/paused session untouched for this long is abandoned when a new one is started. */
    staleOpenHours: 24,
    titleMaxLength: 120,
  },
  /**
   * Raids (04-rpg-design-spec): one raid costs this much study energy. The battle API (session 06) spends it;
   * until then it only drives the Adventure badge on the hotbar ("you have enough energy").
   */
  raid: { energyCost: 3 },
  /** XP modifiers that apply to session rewards (04-rpg-design-spec). */
  xpBonus: { scholarClass: 0.15, scholarInsightSkill: 0.12 },

  /** Flashcards: SM-2-style scheduling (kept from the old app, see 03-core-modules section 4). */
  srs: {
    startEase: 2.5,
    minEase: 1.3,
    easeGain: 0.1,
    easeLossPerQualityPoint: 0.08,
    lapseEasePenalty: 0.2,
    lapseEasePenaltyWithSage: 0.12,
    firstIntervalDays: 1,
    secondIntervalDays: 6,
    lapseIntervalDays: 1,
    maxIntervalDays: 3650,
    /** quality >= this is a pass. */
    passQuality: 3,
    ratingQuality: { again: 1, hard: 3, good: 4, easy: 5 },
    /** Multiple-choice review: right = good, wrong = again. */
    choiceCorrectQuality: 4,
    choiceWrongQuality: 1,
    /** Sage Memory skill slows interval growth by this factor (04-rpg-design-spec). */
    sageMemoryFactor: 0.85,
    minGrowthWithSage: 1.2,
  },
  flashcards: {
    questionMaxLength: 1000,
    answerMaxLength: 500,
    maxDistractors: 5,
    /** Multiple choice always has this many choices (1 correct + 2 wrong). */
    choiceCount: 3,
    batchMax: 50,
    reviewQueueMax: 50,
    maxDecksPerUser: 200,
    maxCardsPerUser: 10_000,
  },
  csv: { maxBytes: 500_000, maxRows: 1000 },

  /** Local-data import (03-core-modules section 5). */
  importLimits: {
    maxTasks: 1000,
    maxSessions: 1000,
    maxFlashcards: 2000,
    maxRaidHistory: 100,
    maxLegacyXp: 500_000,
    maxAvatarDataUrlChars: 150_000,
    importedDeckName: 'Imported flashcards',
  },
} as const;

/**
 * Daily XP caps per source group (UTC day). Self-reported tasks and practice battles are not proof of
 * learning, so they pay at most this much per day; a capped grant still writes a 0 XP ledger row so the
 * source can never pay later (04-rpg-design-spec "Reward sources", docs/DECISIONS.md session 06).
 * The task cap is wired into the task route in session 07.
 */
export const DAILY_XP_CAPS = { task: 100, battle_practice: 60 } as const;

/** One-time XP for the first raid victory over each boss, by dungeon tier (04 "Reward sources"). */
export const FIRST_CLEAR_XP: Readonly<Record<1 | 2 | 3, number>> = { 1: 100, 2: 150, 3: 250 };
