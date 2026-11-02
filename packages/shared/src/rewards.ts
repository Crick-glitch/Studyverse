import { BALANCE } from './balance.js';
import type { Difficulty } from './subjects.js';

/** Whole minutes of a session that count toward rewards (elapsed is server-measured, never client-claimed). */
export const elapsedMinutes = (elapsedSec: number): number =>
  Math.max(0, Math.floor(elapsedSec / 60));

export function streakMultiplier(streak: number): number {
  const s = BALANCE.sessions;
  return 1 + Math.min(s.streakBonusCap, Math.max(0, streak) * s.streakBonusPerDay);
}

/** Old formula: floor(minutes x difficulty multiplier x streak bonus), at least 1. */
export function sessionBaseXp(minutes: number, difficulty: Difficulty, streak: number): number {
  const raw = Math.floor(
    minutes * BALANCE.sessions.difficultyMultiplier[difficulty] * streakMultiplier(streak),
  );
  return Math.max(1, raw);
}

/** Old formula: floor(minutes / 10), at least 1. */
export function sessionBaseEnergy(minutes: number): number {
  return Math.max(
    BALANCE.sessions.minEnergy,
    Math.floor(minutes / BALANCE.sessions.minutesPerEnergy),
  );
}

export const clampFocus = (ratio: number | null | undefined): number =>
  ratio == null || !Number.isFinite(ratio) ? 1 : Math.max(0, Math.min(1, ratio));

export type IneligibleReason = 'not_enough_time' | 'not_enough_focus';

/** Decides, at finish time, whether the session can be claimed at all. */
export function sessionEligibility(input: {
  elapsedSec: number;
  plannedMinutes: number;
  focusRatio: number | null | undefined;
}): { eligible: true } | { eligible: false; reason: IneligibleReason } {
  const planned = input.plannedMinutes * 60;
  if (input.elapsedSec < planned * BALANCE.sessions.minElapsedRatio)
    return { eligible: false, reason: 'not_enough_time' };
  if (clampFocus(input.focusRatio) < BALANCE.sessions.focus.noRewardBelow)
    return { eligible: false, reason: 'not_enough_focus' };
  return { eligible: true };
}

export const passThreshold = (total: number): number =>
  Math.ceil(total * BALANCE.sessions.claim.passFraction);

export interface SessionRewardInput {
  elapsedSec: number;
  difficulty: Difficulty;
  streak: number;
  focusRatio: number | null | undefined;
  correct: number;
  total: number;
  /** XP modifiers from class/skills (04-rpg-design-spec). */
  scholarClass?: boolean;
  scholarInsight?: boolean;
}
export interface SessionReward {
  passed: boolean;
  xp: number;
  energy: number;
  baseXp: number;
  baseEnergy: number;
}

/**
 * Pure reward calculation for a claimed session:
 *  pass (>= 80% right): full base XP (x0.75 when focus was between 0.5 and 0.8); fail: 50%.
 *  Class/skill XP bonuses are applied last (multiplicatively, one rounding).
 */
export function computeSessionReward(input: SessionRewardInput): SessionReward {
  const minutes = elapsedMinutes(input.elapsedSec);
  const baseXp = sessionBaseXp(minutes, input.difficulty, input.streak);
  const baseEnergy = sessionBaseEnergy(minutes);
  const passed = input.total > 0 && input.correct >= passThreshold(input.total);

  let xp: number;
  let energy: number;
  if (passed) {
    const full = clampFocus(input.focusRatio) >= BALANCE.sessions.focus.fullRewardFrom;
    xp = full ? baseXp : Math.ceil(baseXp * BALANCE.sessions.focus.partialMultiplier);
    energy = baseEnergy;
  } else {
    xp = Math.max(1, Math.floor(baseXp * BALANCE.sessions.claim.failMultiplier));
    energy = Math.max(1, Math.floor(baseEnergy * BALANCE.sessions.claim.failMultiplier));
  }
  const mult =
    (input.scholarClass ? 1 + BALANCE.xpBonus.scholarClass : 1) *
    (input.scholarInsight ? 1 + BALANCE.xpBonus.scholarInsightSkill : 1);
  xp = Math.max(1, Math.round(xp * mult));
  return { passed, xp, energy, baseXp, baseEnergy };
}

/** Review sessions: about 2 cards per minute, clamped to the allowed range (old rule, with a cap). */
export function reviewSessionMinutes(dueCards: number): number {
  const r = BALANCE.sessions.review;
  return Math.max(r.minMinutes, Math.min(r.maxMinutes, Math.ceil(dueCards / r.cardsPerMinute)));
}
