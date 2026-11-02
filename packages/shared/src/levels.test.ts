import { describe, expect, it } from 'vitest';
import { levelFromTotalXp, totalXpForLevel } from './levels.js';

describe('totalXpForLevel (cumulative table)', () => {
  it('matches the documented table', () => {
    expect([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map(totalXpForLevel)).toEqual([
      0, 100, 250, 450, 700, 1000, 1350, 1750, 2200, 2700, 3250,
    ]);
  });
  it('adds 500 per level beyond the table', () => {
    expect(totalXpForLevel(12)).toBe(3750);
    expect(totalXpForLevel(13)).toBe(4250);
    expect(totalXpForLevel(21)).toBe(8250);
  });
  it('rejects invalid levels', () => {
    expect(() => totalXpForLevel(0)).toThrow(RangeError);
    expect(() => totalXpForLevel(1.5)).toThrow(RangeError);
  });
});

describe('levelFromTotalXp', () => {
  it('starts at level 1 with 0 XP', () => {
    expect(levelFromTotalXp(0)).toEqual({
      level: 1,
      currentLevelXp: 0,
      xpForNextLevel: 100,
      totalXpAtLevelStart: 0,
      totalXpForNextLevel: 100,
    });
  });
  it('levels up exactly on the threshold and carries nothing over', () => {
    expect(levelFromTotalXp(99).level).toBe(1);
    const l2 = levelFromTotalXp(100);
    expect(l2.level).toBe(2);
    expect(l2.currentLevelXp).toBe(0);
  });
  it('fixes the old bug: level 2 -> 3 costs 150, not 250', () => {
    const at249 = levelFromTotalXp(249);
    expect(at249.level).toBe(2);
    expect(at249.xpForNextLevel).toBe(150);
    expect(levelFromTotalXp(250).level).toBe(3);
  });
  it('can cross several levels from a single large grant', () => {
    const r = levelFromTotalXp(1000);
    expect(r.level).toBe(6);
    expect(r.currentLevelXp).toBe(0);
    const big = levelFromTotalXp(3300);
    expect(big.level).toBe(11);
    expect(big.currentLevelXp).toBe(50);
  });
  it('continues past the table', () => {
    expect(levelFromTotalXp(3749).level).toBe(11);
    expect(levelFromTotalXp(3750).level).toBe(12);
    expect(levelFromTotalXp(8250).level).toBe(21);
    expect(levelFromTotalXp(8249).level).toBe(20);
  });
  it('is consistent with totalXpForLevel for every level', () => {
    for (let level = 1; level <= 40; level++) {
      const start = totalXpForLevel(level);
      expect(levelFromTotalXp(start).level).toBe(level);
      expect(levelFromTotalXp(totalXpForLevel(level + 1) - 1).level).toBe(level);
    }
  });
  it('rejects negative or non-finite XP', () => {
    expect(() => levelFromTotalXp(-1)).toThrow(RangeError);
    expect(() => levelFromTotalXp(Number.NaN)).toThrow(RangeError);
  });
});
