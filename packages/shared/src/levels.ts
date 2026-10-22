import { BALANCE } from './balance.js';

export interface LevelInfo {
  level: number;
  /** XP earned inside the current level (0 at the moment a level is reached). */
  currentLevelXp: number;
  /** XP needed to go from this level to the next one. */
  xpForNextLevel: number;
  /** Cumulative total XP at which the current level started. */
  totalXpAtLevelStart: number;
  /** Cumulative total XP at which the next level is reached. */
  totalXpForNextLevel: number;
}

/**
 * Cumulative total XP required to REACH `level` (level 1 needs 0).
 *
 * The old app mixed two meanings of the same table: it compared XP-within-level (reset to 0 on
 * level-up) against cumulative thresholds. Here the table is cumulative, everywhere:
 * level 2 at 100 total XP, level 3 at 250, level 4 at 450 ... so the XP COST of each level is the
 * difference (100, 150, 200 ...). Past the table every level adds `stepAfterTable` to the total.
 */
export function totalXpForLevel(level: number): number {
  const { thresholds, stepAfterTable } = BALANCE.levels;
  if (!Number.isInteger(level) || level < 1) throw new RangeError(`Invalid level: ${level}`);
  const table = thresholds;
  if (level <= table.length) return table[level - 1] as number;
  return (table[table.length - 1] as number) + (level - table.length) * stepAfterTable;
}

/** Derives level and in-level XP from lifetime XP. Pure; the single source of truth for levelling. */
export function levelFromTotalXp(totalXp: number): LevelInfo {
  if (!Number.isFinite(totalXp) || totalXp < 0)
    throw new RangeError(`Invalid total XP: ${totalXp}`);
  const xp = Math.floor(totalXp);
  let level = 1;
  // The table is short and the tail is linear; a loop over the table then a division is plenty fast.
  const { thresholds, stepAfterTable } = BALANCE.levels;
  const last = thresholds[thresholds.length - 1] as number;
  if (xp >= last) {
    level = thresholds.length + Math.floor((xp - last) / stepAfterTable);
  } else {
    while (xp >= totalXpForLevel(level + 1)) level += 1;
  }
  const start = totalXpForLevel(level);
  const next = totalXpForLevel(level + 1);
  return {
    level,
    currentLevelXp: xp - start,
    xpForNextLevel: next - start,
    totalXpAtLevelStart: start,
    totalXpForNextLevel: next,
  };
}
