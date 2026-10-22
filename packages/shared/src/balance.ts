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
  displayName: { minLength: 3, maxLength: 20 },
} as const;
