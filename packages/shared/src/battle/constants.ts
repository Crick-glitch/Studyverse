/**
 * Battle balance (04-rpg-design-spec v2). All numbers are STARTING values, tuned by the simulation test in
 * `apps/api/src/battle/balance.test.ts`; the final values are logged in docs/DECISIONS.md. Re-exported from
 * `balance.ts` so that file stays the one home for constants.
 */
export const BATTLE = {
  /** Enemy stats scale with the player's level: x (1 + enemyScalePerLevel * (level - 1)). */
  enemyScalePerLevel: 0.1,
  /** Tuned by the simulation: regular enemies have this much more HP than the 04 table (bosses carry their tuned HP in the roster). */
  regularHpMult: 1.2,
  stats: {
    base: { hp: 100, atk: 10, def: 5 },
    perLevel: { hp: 10, atk: 2, def: 1 },
    powerStrikeAtk: 2,
    ironSkinDef: 2,
    /** One attribute-training purchase (built in session 07; the inputs default to 0 until then). */
    training: { atk: 2, def: 1, hp: 5, maxPurchases: 5 },
  },
  damage: { atkMult: 1.5, defMult: 0.5 },
  /** Combo multiplier by the streak AFTER the current correct answer (index capped at 4). */
  combo: [1, 1, 1.1, 1.25, 1.5],
  strike: { base: 0.09, perEnemyAtk: 0.011, min: 0.12, max: 0.3, bossMax: 0.18, minDamage: 3, defScale: 50 },
  moves: {
    steady: { damageMult: 1, takenMult: 1 },
    brace: { damageMult: 0.45, takenMult: 0.8, weights: { easy: 0.4, medium: 0.6, hard: 0 } },
    bold: { damageMult: 1.4, takenMult: 1.25 },
  },
  /** Steady draws by dungeon tier (easy / medium / hard); bosses shift `bossHardShift` toward hard. */
  tierWeights: {
    1: { easy: 0.6, medium: 0.35, hard: 0.05 },
    2: { easy: 0.25, medium: 0.55, hard: 0.2 },
    3: { easy: 0.1, medium: 0.45, hard: 0.45 },
  },
  bossHardShift: 0.1,
  intents: { heavyTakenMult: 1.6, parryBonus: 0.1, guardDamageMult: 0.5, drainHealPct: 0.1 },
  focus: { max: 3, abilityCost: 3 },
  boss: {
    phase2At: 0.66,
    phase3At: 0.33,
    phase2StrikeMult: 1.1,
    phase3StrikeMult: 1.2,
    phase3ExtraFocus: 1,
    /** Titan: Guard every Nth turn (breakable only by a hard question). Lich phase 2+: Drain every Nth turn. */
    titanGuardEvery: 3,
    lichDrainEvery: 3,
  },
  skills: {
    berserkBelow: 0.5,
    berserkMult: 1.3,
    executionerBelow: 0.3,
    executionerMult: 1.25,
    stoneWallBelow: 0.3,
    stoneWallMult: 0.65,
    secondWindBelow: 0.3,
    secondWindHeal: 0.2,
    quickStudyEvery: 3,
  },
  classes: { warriorBonusAtk: 2, tankWrongMult: 0.75, scholarXpMult: 1.15, scholarEnergyBonus: 1 },
  gear: {
    ignoreDefPct: 0.25,
    hardDamageMult: 1.2,
    wrongDamageMult: 0.9,
    firstWrongMult: 0.5,
    battleXpMult: 1.1,
  },
  /** Questions the player saw in their last N battle turns are not drawn again (relaxed if the pool runs short). */
  recentWindow: 30,
  /** Share of turns that use a due flashcard first, when one is due in the subject. */
  dueCardShare: 0.4,
  /** A wrong question comes back once, at least this many turns later. */
  requeueGap: 2,
  /** Share of "Any"-subject turns that favour the player's weakest subjects. */
  weakSubjectShare: 0.5,
  rewards: {
    baseXp: 25,
    perLevel: 0.04,
    bossMult: 2.5,
    defeatShare: 0.4,
    practiceShare: 0.25,
    /** accuracyMult runs from `min` at `from` accuracy (and below) to `max` at 100%. */
    accuracy: { from: 0.5, min: 0.8, max: 1.2 },
    /** Energy a victory returns (a Scholar adds `classes.scholarEnergyBonus`). Fixed, so a raid can never be energy-neutral. */
    energyOnVictory: 1,
    /** Bonus XP when a drop is a duplicate (no second currency). */
    duplicateXp: { common: 5, uncommon: 10, rare: 20 },
  },
  loot: {
    regular: { common: 70, uncommon: 25, rare: 5 },
    boss: { common: 20, uncommon: 55, rare: 25 },
    /** After this many regular raid victories without an uncommon-or-better drop, the next one is guaranteed. */
    pityAfter: 5,
  },
  /** The battle log keeps this many recent lines for a resume. */
  logLines: 10,
} as const;
