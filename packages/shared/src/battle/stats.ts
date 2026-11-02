import { BATTLE } from './constants.js';
import type { BattleEffects, DerivedStats, PlayerClassKey } from './types.js';

export interface StatsInput {
  level: number;
  playerClass: PlayerClassKey | null;
  weapon?: { atk: number; effectKey: string | null } | null;
  armor?: { def: number; effectKey: string | null } | null;
  /** effectKey of every unlocked skill (SkillDefinition.effectKey). */
  skillKeys?: readonly string[];
  /** Attribute-training purchases (session 07); each capped at BATTLE.stats.training.maxPurchases. */
  training?: { atk?: number; def?: number; hp?: number };
}

const clampTraining = (n: number | undefined) =>
  Math.min(BATTLE.stats.training.maxPurchases, Math.max(0, Math.floor(n ?? 0)));

/**
 * THE derived-stats function (hard rule 4): nothing about attack, defense or HP is ever stored. Everything
 * comes from level, class, equipped gear, unlocked skills and attribute training. Equip twice, respec, or
 * change gear: the numbers cannot drift because they are recomputed from these inputs.
 */
export function deriveStats(input: StatsInput): DerivedStats {
  const level = Math.max(1, Math.floor(input.level));
  const skills = new Set(input.skillKeys ?? []);
  const wKey = input.weapon?.effectKey ?? null;
  const aKey = input.armor?.effectKey ?? null;
  const t = BATTLE.stats.training;
  const train = { atk: clampTraining(input.training?.atk), def: clampTraining(input.training?.def), hp: clampTraining(input.training?.hp) };
  const b = BATTLE.stats;

  const effects: BattleEffects = {
    bonusAtk: input.playerClass === 'warrior' ? BATTLE.classes.warriorBonusAtk : 0,
    tankWrongMult: input.playerClass === 'tank' ? BATTLE.classes.tankWrongMult : 1,
    scholar: input.playerClass === 'scholar',
    ignoreDefPct: wKey === 'ignore_def_25' ? BATTLE.gear.ignoreDefPct : 0,
    focusFirstCorrect: wKey === 'focus_first_correct',
    hardDamageMult: wKey === 'hard_damage_20' ? BATTLE.gear.hardDamageMult : 1,
    shatterGuardAny: wKey === 'shatter_guard_any',
    battleXpMult: aKey === 'battle_xp_10' ? BATTLE.gear.battleXpMult : 1,
    wrongDamageMult: aKey === 'wrong_damage_minus_10' ? BATTLE.gear.wrongDamageMult : 1,
    firstWrongHalf: aKey === 'first_wrong_half',
    berserk: skills.has('berserk'),
    executioner: skills.has('executioner'),
    stoneWall: skills.has('stone_wall'),
    secondWind: skills.has('second_wind'),
    quickStudy: skills.has('quick_study'),
  };

  return {
    level,
    playerClass: input.playerClass,
    maxHp: b.base.hp + b.perLevel.hp * (level - 1) + train.hp * t.hp,
    atk:
      b.base.atk + b.perLevel.atk * (level - 1) + (input.weapon?.atk ?? 0) +
      (skills.has('power_strike') ? b.powerStrikeAtk : 0) + train.atk * t.atk,
    def:
      b.base.def + b.perLevel.def * (level - 1) + (input.armor?.def ?? 0) +
      (skills.has('iron_skin') ? b.ironSkinDef : 0) + train.def * t.def,
    effects,
  };
}
