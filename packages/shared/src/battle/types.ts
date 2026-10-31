import type { Difficulty } from '../subjects.js';

/** The tactical choice made BEFORE the question is revealed (04-rpg-design-spec "Moves"). */
export const MOVES = ['steady', 'brace', 'bold'] as const;
export type Move = (typeof MOVES)[number];

/** What the enemy telegraphs at the start of a turn. */
export const INTENTS = ['strike', 'heavy', 'guard', 'drain'] as const;
export type IntentKey = (typeof INTENTS)[number];

export const ABILITIES = ['cleave', 'bulwark', 'insight'] as const;
export type AbilityKey = (typeof ABILITIES)[number];

export type PlayerClassKey = 'warrior' | 'tank' | 'scholar';
export type BattleModeKey = 'raid' | 'practice';
export type BattleOutcome = 'victory' | 'defeat' | 'retreated';
/** Server-side phases. `feedback` is a client-only phase (the explanation is shown until Continue). */
export type BattlePhase = 'awaitingMove' | 'awaitingAnswer' | 'ended';
export type TierNumber = 1 | 2 | 3;
export type { Difficulty };

/** Everything the engine and the rewards need to know about a hero, derived (never stored). */
export interface BattleEffects {
  /** Flat damage added to ATK before the 1.5x (Warrior passive). */
  bonusAtk: number;
  /** Multiplier on damage taken from wrong answers (Tank passive 0.75). */
  tankWrongMult: number;
  scholar: boolean;
  /** Share of enemy DEF ignored (Dragon Slayer). */
  ignoreDefPct: number;
  /** +1 Focus on the first correct answer each battle (Scribe's Staff). */
  focusFirstCorrect: boolean;
  /** Damage multiplier on hard questions (Quillblade). */
  hardDamageMult: number;
  /** Any correct answer shatters Guard (Tome Hammer; not the Titan's boss Guard). */
  shatterGuardAny: boolean;
  /** Battle XP multiplier (Scholar's Robe). */
  battleXpMult: number;
  /** Damage multiplier on wrong answers (Cartographer's Mail). */
  wrongDamageMult: number;
  /** The first wrong answer each battle deals half damage (Warden's Plate). */
  firstWrongHalf: boolean;
  berserk: boolean;
  executioner: boolean;
  stoneWall: boolean;
  secondWind: boolean;
  quickStudy: boolean;
}

export interface DerivedStats {
  level: number;
  playerClass: PlayerClassKey | null;
  maxHp: number;
  atk: number;
  def: number;
  effects: BattleEffects;
}
