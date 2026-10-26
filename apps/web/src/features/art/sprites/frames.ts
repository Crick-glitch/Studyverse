/**
 * Animation vocabulary shared by heroes, enemies and the manifest.
 * Frames are an index WITHIN a state (idle 0-1, attack 0-2); states themselves are unchanged.
 */
export const ATTACK_PHASES = ['windup', 'impact', 'recovery'] as const;
export type AttackPhase = (typeof ATTACK_PHASES)[number];

/** The representative frame of a state: what a still image, a thumbnail or reduced motion shows. */
export const STILL_FRAME: Readonly<Record<string, number>> = {
  idle: 0,
  attack: 1, // impact: the most readable single frame of a strike
  hit: 0,
  defeat: 0,
  victory: 0,
  phase2: 0,
};
export const defaultFrame = (state: string): number => STILL_FRAME[state] ?? 0;

/** How long each frame stays up, in milliseconds. */
export interface Timing {
  ms: readonly number[];
  loop: boolean;
}
export const HERO_TIMING: Readonly<Record<string, Timing>> = {
  idle: { ms: [520, 520], loop: true },
  attack: { ms: [150, 90, 200], loop: false },
};
export const ENEMY_TIMING: Readonly<Record<string, Timing>> = {
  idle: { ms: [640, 640], loop: true },
  phase2: { ms: [520, 520], loop: true },
  attack: { ms: [180, 100, 220], loop: false },
};
