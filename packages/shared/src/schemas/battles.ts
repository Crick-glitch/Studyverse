import { z } from 'zod';
import { ABILITIES, MOVES } from '../battle/types.js';
import type { AbilityKey, BattleModeKey, BattleOutcome, BattlePhase, IntentKey, Move } from '../battle/types.js';
import { SUBJECTS } from '../subjects.js';
import type { ProgressDto } from './profile.js';

/** "Any" mixes every subject; it is a battle option, not a bank subject. */
export const BATTLE_SUBJECTS = ['Any', ...SUBJECTS] as const;

export const battleCreateSchema = z.object({
  mode: z.enum(['raid', 'practice']),
  subject: z.enum(BATTLE_SUBJECTS),
  tier: z.number().int().min(1).max(3),
  /** Fight the tier's boss (raids only; the boss gate rules apply). */
  boss: z.boolean().optional(),
});
export type BattleCreate = z.infer<typeof battleCreateSchema>;

const turnNumber = z.number().int().min(1).max(10_000);
export const battleMoveSchema = z.object({ turnNumber, move: z.enum(MOVES) });
export type BattleMoveInput = z.infer<typeof battleMoveSchema>;
export const battleAbilitySchema = z.object({ turnNumber, ability: z.enum(ABILITIES) });
export type BattleAbilityInput = z.infer<typeof battleAbilitySchema>;
export const battleAnswerSchema = z.object({ turnNumber, selectedIndex: z.number().int().min(0).max(9) });
export type BattleAnswerInput = z.infer<typeof battleAnswerSchema>;
export const idempotencyKeySchema = z.string().trim().min(8).max(80);

export interface BattleCombatantDto {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
}
export interface BattleGearDto {
  slug: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  /** Plain-language effect, or null for a plain stat item. */
  effect: string | null;
}
export interface BattleHeroDto extends BattleCombatantDto {
  level: number;
  playerClass: 'warrior' | 'tank' | 'scholar' | null;
  weapon: BattleGearDto | null;
  armor: BattleGearDto | null;
  /** Names of passive effects from skills and class, for the small tooltip panel. */
  perks: string[];
}
export interface BattleEnemyDto extends BattleCombatantDto {
  slug: string;
  name: string;
  isBoss: boolean;
  /** 1 normally; 2 and 3 for boss phases. */
  bossPhase: 1 | 2 | 3;
  intro: string | null;
}
export interface BattleIntentDto {
  key: IntentKey;
  name: string;
  effect: string;
  /** The Titan's iron guard (only a hard question breaks it). */
  bossGuard: boolean;
}
export interface BattleAbilityDto {
  key: AbilityKey;
  label: string;
  effect: string;
  cost: number;
  /** Usable right now (class, Focus, timing, one per turn). */
  available: boolean;
  /** Why not, when unavailable. */
  reason: string | null;
  armed: boolean;
}
export interface BattleQuestionDto {
  /** Only the text and the choices. The answer and explanation come back after answering. */
  text: string;
  choices: string[];
}
export interface BattleEventDto {
  type:
    | 'hit'
    | 'miss'
    | 'parry'
    | 'guard'
    | 'guardBreak'
    | 'drain'
    | 'bulwark'
    | 'cleave'
    | 'focus'
    | 'phase'
    | 'heal'
    | 'victory'
    | 'defeat';
  text: string;
}
export interface AnswerResultDto {
  turnNumber: number;
  move: Move;
  intent: IntentKey;
  correct: boolean;
  selectedIndex: number;
  correctIndex: number;
  explanation: string | null;
  damageDealt: number;
  damageTaken: number;
  /** HP the enemy regained (Drain). */
  enemyHealed: number;
  /** HP the hero regained (Second Wind). */
  heroHealed: number;
  combo: number;
  focusGained: number;
  events: BattleEventDto[];
  ended: boolean;
  outcome: BattleOutcome | null;
}
export interface BattleDto {
  id: string;
  mode: BattleModeKey;
  status: 'active' | BattleOutcome;
  phase: BattlePhase;
  subject: string;
  tier: number;
  dungeon: { slug: string; name: string; background: string };
  turn: number;
  hero: BattleHeroDto;
  enemy: BattleEnemyDto;
  combo: number;
  focus: number;
  focusMax: number;
  intent: BattleIntentDto;
  /** The move chosen for the open turn (null while awaiting a move). */
  move: Move | null;
  question: BattleQuestionDto | null;
  /** The wrong choice Insight removed this turn. */
  removedIndex: number | null;
  armed: AbilityKey | null;
  abilities: BattleAbilityDto[];
  questionsAsked: number;
  correctAnswers: number;
  /** The most recent resolved turn (for resume); never the open turn. */
  lastResult: AnswerResultDto | null;
  log: string[];
  startedAt: string;
  endedAt: string | null;
}
export interface BattleCreateResultDto {
  battle: BattleDto;
  /** false when the same Idempotency-Key had already started this battle. */
  created: boolean;
}
export interface BattleQuestionResultDto {
  turnNumber: number;
  question: BattleQuestionDto;
  battle: BattleDto;
}
export interface BattleAnswerResponseDto {
  result: AnswerResultDto;
  battle: BattleDto;
}
export interface BattleMissedDto {
  turnNumber: number;
  subject: string;
  text: string;
  choices: string[];
  correctIndex: number;
  selectedIndex: number | null;
  explanation: string | null;
  /** Already one of the player's flashcards. */
  isCard: boolean;
}
export interface BattleLootDto {
  slug: string;
  name: string;
  slot: 'weapon' | 'armor';
  rarity: 'common' | 'uncommon' | 'rare';
  atk: number;
  def: number;
  effect: string | null;
  /** Equipped automatically because the slot was empty. */
  equipped: boolean;
  /** The player already owned it: it paid bonus XP instead. */
  duplicate: boolean;
  duplicateXp: number;
}
export interface BattleSummaryDto {
  battleId: string;
  mode: BattleModeKey;
  outcome: BattleOutcome;
  subject: string;
  tier: number;
  enemy: { slug: string; name: string; isBoss: boolean };
  asked: number;
  correct: number;
  /** XP the battle earned: `requested` is the formula result, `awarded` what the ledger paid after any cap. */
  xp: { requested: number; awarded: number; capped: boolean; dailyCap: number | null };
  energy: number;
  loot: BattleLootDto | null;
  /** The first-clear bonus for a boss (raid victory), paid once ever. */
  firstClear: { bossSlug: string; xp: number; awarded: boolean } | null;
  missed: BattleMissedDto[];
  /** The subject missed most (needs at least one miss). */
  weakSpot: { subject: string; missed: number } | null;
  levelsGained: number;
  progress: ProgressDto;
  /** true when `finish` had already been called and this is the stored summary. */
  alreadyFinished: boolean;
}
export interface MissedToCardsResultDto {
  deckId: string;
  deckName: string;
  added: number;
  skipped: number;
}

/** Dungeon region map (P1): what is open, locked and why. */
export interface DungeonStatusDto {
  tier: 1 | 2 | 3;
  slug: string;
  name: string;
  background: string;
  open: boolean;
  lockedReason: string | null;
  bossSlug: string;
  bossName: string;
  bossOpen: boolean;
  bossLockedReason: string | null;
  bossDefeated: boolean;
  raidWins: number;
  raidWinsNeeded: number;
}
export interface DungeonsDto {
  level: number;
  energy: number;
  energyCost: number;
  dungeons: DungeonStatusDto[];
  /** Resume link for an unfinished battle. */
  activeBattleId: string | null;
}
