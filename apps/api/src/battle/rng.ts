import { hashString, seededRng } from '@studyverse/shared';

/**
 * Every random choice in a battle comes from `(seed, turn, salt)` only. Nothing but the seed is stored, so a
 * refresh, a retry or a replayed request can never re-roll an intent, a question or an Insight removal.
 */
export const rngFor = (seed: number, turn: number, salt: string): (() => number) =>
  seededRng(hashString(`${seed}:${turn}:${salt}`));

export function pick<T>(items: readonly T[], rng: () => number): T {
  return items[Math.min(items.length - 1, Math.floor(rng() * items.length))] as T;
}
