import { BATTLE } from './constants.js';

export type RarityKey = 'common' | 'uncommon' | 'rare';

/** accuracyMult: 0.8 at 50% accuracy or less, rising linearly to 1.2 at 100%. */
export function accuracyMult(accuracy: number): number {
  const a = BATTLE.rewards.accuracy;
  const t = Math.min(1, Math.max(0, (accuracy - a.from) / (1 - a.from)));
  return a.min + (a.max - a.min) * t;
}

export interface BattleXpInput {
  /** The player's level when the battle started (the enemy's level). */
  level: number;
  isBoss: boolean;
  /** correct / asked over the whole battle (0..1). */
  accuracy: number;
  mode: 'raid' | 'practice';
  victory: boolean;
  scholar: boolean;
  /** Scholar's Robe etc. */
  gearXpMult: number;
  /** XP for a duplicate drop, added after the multipliers. */
  duplicateXp?: number;
}

/**
 * battleXp = round(40 x (1 + 0.15 x enemyLevel) x accuracyMult); boss x2.5; Scholar x1.15 and gear after;
 * defeat pays 40%; practice pays 25%. Always at least 1 (the ledger takes positive amounts only).
 */
export function battleXp(i: BattleXpInput): number {
  const r = BATTLE.rewards;
  let xp = r.baseXp * (1 + r.perLevel * i.level) * accuracyMult(i.accuracy);
  if (i.isBoss) xp *= r.bossMult;
  if (i.scholar) xp *= BATTLE.classes.scholarXpMult;
  xp *= i.gearXpMult;
  if (!i.victory) xp *= r.defeatShare;
  if (i.mode === 'practice') xp *= r.practiceShare;
  return Math.max(1, Math.round(xp) + (i.victory ? (i.duplicateXp ?? 0) : 0));
}

/**
 * Energy a raid victory returns: `rewards.energyOnVictory` (+1 for a Scholar). The 04 formula
 * `max(1, floor(enemyMaxHP / 80))` could refund the whole 3-energy cost at higher levels (the balance audit
 * found energy-neutral loops), so the refund is fixed. Raids only; defeat and retreat refund nothing.
 */
export function battleEnergy(scholar: boolean): number {
  return BATTLE.rewards.energyOnVictory + (scholar ? BATTLE.classes.scholarEnergyBonus : 0);
}

/** Rarity roll. `pity` forces at least uncommon. `roll` is a float in [0, 1). */
export function rollRarity(roll: number, isBoss: boolean, pity: boolean): RarityKey {
  const w = isBoss ? BATTLE.loot.boss : BATTLE.loot.regular;
  const entries: [RarityKey, number][] = [
    ['common', pity ? 0 : w.common],
    ['uncommon', w.uncommon],
    ['rare', w.rare],
  ];
  const total = entries.reduce((s, [, n]) => s + n, 0);
  let at = roll * total;
  for (const [key, n] of entries) {
    if (at < n) return key;
    at -= n;
  }
  return 'rare';
}
