import { BATTLE } from './constants.js';
import type { AbilityKey, IntentKey, Move, PlayerClassKey } from './types.js';

const pct = (n: number) => `${Math.round(n * 100)}%`;
const x = (n: number) => `\u00d7${n}`;

/** Plain-text effects shown on the move buttons (06: exact effect, never a hint about answers). */
export const MOVE_TEXT: Readonly<Record<Move, { label: string; effect: string }>> = {
  steady: {
    label: 'Steady',
    effect: `Normal question. Correct: ${x(BATTLE.moves.steady.damageMult)} damage. Wrong: normal hit.`,
  },
  brace: {
    label: 'Brace',
    effect: `Easier question. Correct: ${x(BATTLE.moves.brace.damageMult)} damage. Wrong: ${pct(1 - BATTLE.moves.brace.takenMult)} less damage taken, and it cancels Heavy Strike and Drain.`,
  },
  bold: {
    label: 'Bold',
    effect: `Harder question. Correct: ${x(BATTLE.moves.bold.damageMult)} damage and it breaks Guard. Wrong: +${pct(BATTLE.moves.bold.takenMult - 1)} damage taken.`,
  },
};

export const INTENT_TEXT: Readonly<Record<IntentKey, { name: string; effect: string }>> = {
  strike: { name: 'Strike', effect: 'A plain attack.' },
  heavy: { name: 'Heavy Strike', effect: `A wrong answer hurts ${pct(BATTLE.intents.heavyTakenMult - 1)} more.` },
  guard: { name: 'Guard', effect: 'Your damage is halved unless you break the guard with a hard question.' },
  drain: { name: 'Drain', effect: `A wrong answer heals the enemy by ${pct(BATTLE.intents.drainHealPct)} of its HP.` },
};
export const BOSS_GUARD_EFFECT = 'Iron guard: only a correct answer to a HARD question breaks it.';

export const ABILITY_TEXT: Readonly<Record<AbilityKey, { label: string; effect: string; playerClass: PlayerClassKey }>> = {
  cleave: { label: 'Cleave', effect: 'Your next correct answer deals double damage.', playerClass: 'warrior' },
  bulwark: { label: 'Bulwark', effect: 'Negates the next enemy hit.', playerClass: 'tank' },
  insight: { label: 'Insight', effect: 'Removes one wrong choice from this question.', playerClass: 'scholar' },
};

/** Effect text per ItemDefinition.effectKey / SkillDefinition.effectKey (also used by Camp tooltips later). */
export const EFFECT_TEXT: Readonly<Record<string, string>> = {
  ignore_def_25: 'Ignores 25% of enemy DEF.',
  focus_first_correct: '+1 Focus on your first correct answer each battle.',
  hard_damage_20: '+20% damage on hard questions.',
  shatter_guard_any: 'Any correct answer shatters Guard (not the Titan\u2019s boss Guard).',
  battle_xp_10: '+10% battle XP.',
  wrong_damage_minus_10: '-10% damage from wrong answers.',
  first_wrong_half: 'The first wrong answer each battle deals half damage.',
  power_strike: '+2 ATK.',
  berserk: '+30% damage while HP is under 50%.',
  executioner: '+25% damage against enemies under 30% HP.',
  iron_skin: '+2 DEF.',
  stone_wall: '-35% damage taken while HP is under 30%.',
  second_wind: 'Once per battle, heal 20% max HP when HP first falls below 30%.',
  scholar_insight: '+12% session XP.',
  sage_memory: 'Flashcard intervals grow more slowly.',
  quick_study: 'Every 3rd correct answer in a row grants +1 Focus.',
};
