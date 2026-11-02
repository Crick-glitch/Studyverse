import { BALANCE } from './balance.js';

export type Rating = keyof typeof BALANCE.srs.ratingQuality;
export const RATINGS = Object.keys(BALANCE.srs.ratingQuality) as Rating[];

export interface SrsState {
  ease: number;
  intervalDays: number;
  repetitions: number;
}
export interface SrsResult extends SrsState {
  dueAt: Date;
  passed: boolean;
}

const DAY_MS = 86_400_000;

/**
 * SM-2-style scheduling, kept close to the old app (03-core-modules section 4).
 * quality 0-5; >= passQuality is a pass. `sageMemory` (Mind skill) slows interval growth and softens
 * the ease penalty on a miss.
 */
export function nextSrsState(
  card: SrsState,
  quality: number,
  now: Date,
  opts: { sageMemory?: boolean } = {},
): SrsResult {
  const c = BALANCE.srs;
  const q = Math.max(0, Math.min(5, Math.round(quality)));
  const sage = opts.sageMemory === true;
  let { ease, intervalDays, repetitions } = card;
  const passed = q >= c.passQuality;

  if (passed) {
    repetitions += 1;
    if (repetitions === 1) intervalDays = c.firstIntervalDays;
    else if (repetitions === 2) intervalDays = c.secondIntervalDays;
    else {
      let growth = ease;
      if (sage) growth = Math.max(c.minGrowthWithSage, growth * c.sageMemoryFactor);
      intervalDays = Math.max(1, Math.round((intervalDays || c.secondIntervalDays) * growth));
    }
    ease = Math.max(c.minEase, ease + c.easeGain - (5 - q) * c.easeLossPerQualityPoint);
  } else {
    repetitions = 0;
    intervalDays = c.lapseIntervalDays;
    ease = Math.max(c.minEase, ease - (sage ? c.lapseEasePenaltyWithSage : c.lapseEasePenalty));
  }
  intervalDays = Math.min(intervalDays, c.maxIntervalDays);
  ease = Math.round(ease * 1000) / 1000;
  return {
    ease,
    intervalDays,
    repetitions,
    dueAt: new Date(now.getTime() + intervalDays * DAY_MS),
    passed,
  };
}

export const ratingToQuality = (r: Rating): number => BALANCE.srs.ratingQuality[r];
