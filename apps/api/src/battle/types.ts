import type {
  AbilityKey,
  BattleModeKey,
  BattleOutcome,
  BattlePhase,
  DerivedStats,
  Difficulty,
  IntentKey,
  Move,
} from '@studyverse/shared';

/** A question the engine may draw (the service builds the pool from the bank and the player's due cards). */
export interface PoolQuestion {
  /** Stable key: `bank:<questionId>` or `card:<cardId>`. */
  ref: string;
  source: 'bank' | 'card';
  id: string;
  difficulty: Difficulty;
  subject: string;
  text: string;
  /** Always exactly the choices shown to the player (3). */
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  /** A flashcard that is due for review now. */
  due: boolean;
}

export interface DrawnQuestion {
  ref: string;
  source: 'bank' | 'card';
  id: string;
  difficulty: Difficulty;
  subject: string;
  text: string;
  choices: string[];
  correctIndex: number;
  explanation: string | null;
  /** This is the second time the player sees it (a missed question comes back once). */
  requeued: boolean;
}

/**
 * The whole battle, as plain JSON. The service stores it on `Battle.engineState` (never sent to the browser,
 * it contains the open question's answer) and mirrors hp / turn / combo / focus into the Battle columns.
 */
export interface EngineState {
  mode: BattleModeKey;
  tier: 1 | 2 | 3;
  subject: string;
  enemySlug: string;
  isBoss: boolean;
  seed: number;
  /** The hero's derived stats AT THE START of the battle (gear changes mid-fight cannot change a battle). */
  hero: DerivedStats;
  enemy: { maxHp: number; atk: number; def: number };
  heroHp: number;
  enemyHp: number;
  turn: number;
  phase: BattlePhase;
  outcome: BattleOutcome | null;
  combo: number;
  focus: number;
  /** Cleave / Bulwark stay armed until they are used. */
  armed: 'cleave' | 'bulwark' | null;
  intent: IntentKey;
  /** The Titan's iron guard. */
  bossGuard: boolean;
  bossPhase: 1 | 2 | 3;
  once: { staffFocus: boolean; wardenHalf: boolean; secondWind: boolean };
  cur: {
    move: Move | null;
    question: DrawnQuestion | null;
    removedIndex: number | null;
    abilityUsed: boolean;
    armedThisTurn: AbilityKey | null;
  };
  requeue: { ref: string; notBefore: number }[];
  requeued: string[];
  /** Refs of the last `BATTLE.recentWindow` questions asked. */
  recent: string[];
  tally: {
    asked: number;
    correct: number;
    drawn: number;
    dueDrawn: number;
    bySubject: Record<string, { asked: number; missed: number }>;
  };
}

/** A rule was broken (wrong phase, no Focus...). The service turns it into a 409. */
export class EngineError extends Error {
  constructor(
    public readonly code:
      | 'WRONG_PHASE'
      | 'BATTLE_ENDED'
      | 'NO_QUESTIONS'
      | 'ABILITY_NOT_AVAILABLE'
      | 'NOT_ENOUGH_FOCUS'
      | 'ABILITY_ALREADY_USED'
      | 'ALREADY_ARMED',
    message: string,
  ) {
    super(message);
  }
}
