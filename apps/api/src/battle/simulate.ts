import { ENEMIES, deriveStats, seededRng, type DerivedStats, type Difficulty, type StatsInput } from '@studyverse/shared';
import { answer, chooseMove, createBattle } from './engine.js';
import type { EngineState, PoolQuestion } from './types.js';
import type { Move } from '@studyverse/shared';

/**
 * Balance simulation (04 "Balance targets and the simulation test"): a simulated player runs the REAL engine
 * thousands of times. Accuracy per difficulty keeps pure guessing at 1/3: acc(d) = 1/3 + (p - 1/3) x scale[d].
 */
export type Policy = 'steady' | 'smart' | 'bold-only' | 'brace-only';
export const POLICIES: readonly Policy[] = ['steady', 'smart', 'bold-only', 'brace-only'];

const SCALE: Record<Difficulty, number> = { easy: 1.15, medium: 1.0, hard: 0.8 };
export const accuracyFor = (p: number, d: Difficulty): number =>
  Math.min(0.99, Math.max(0, 1 / 3 + (p - 1 / 3) * SCALE[d]));

export function simPool(perDifficulty = 40, subject = 'Math'): PoolQuestion[] {
  const out: PoolQuestion[] = [];
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < perDifficulty; i++) {
      out.push({
        ref: `bank:${d}-${i}`, source: 'bank', id: `${d}-${i}`, difficulty: d, subject,
        text: `${d} ${i}`, choices: ['a', 'b', 'c'], correctIndex: 0, explanation: null, due: false,
      });
    }
  }
  return out;
}

export function chooseSimMove(policy: Policy, s: EngineState): Move {
  switch (policy) {
    case 'steady': return 'steady';
    case 'bold-only': return 'bold';
    case 'brace-only': return 'brace';
    case 'smart':
      if (s.intent === 'heavy') return s.heroHp < s.hero.maxHp * 0.6 ? 'brace' : 'steady';
      if (s.intent === 'guard') return 'bold';
      if (s.intent === 'drain') return s.enemyHp > s.enemy.maxHp * 0.5 ? 'brace' : 'bold';
      return s.combo >= 2 ? 'bold' : 'steady';
  }
}

export interface SimCase {
  policy: Policy;
  /** Base accuracy on a medium question. */
  p: number;
  enemySlug: string;
  tier: 1 | 2 | 3;
  hero: DerivedStats;
  runs?: number;
  seedBase?: number;
  pool?: PoolQuestion[];
}
export interface SimResult {
  winRate: number;
  avgQuestions: number;
  /** Average share of hero HP left in won fights. */
  avgHpLeftOnWin: number;
  avgQuestionsOnWin: number;
  /** Mean battle accuracy (correct / asked) in won and lost fights, for pricing XP in the audit. */
  accOnWin: number;
  accOnLoss: number;
}

export function simulate(c: SimCase): SimResult {
  const runs = c.runs ?? 2000;
  const pool = c.pool ?? simPool();
  let wins = 0;
  let questions = 0;
  let winQuestions = 0;
  let hpLeft = 0;
  let accWin = 0;
  let accLoss = 0;
  for (let i = 0; i < runs; i++) {
    const rnd = seededRng((c.seedBase ?? 1) * 100_003 + i);
    let s = createBattle({
      mode: 'raid', tier: c.tier, subject: 'Math', enemySlug: c.enemySlug, hero: c.hero,
      seed: 1 + Math.floor(rnd() * 2_000_000_000),
    });
    let guard = 0;
    // abilities are not used by the bot; Focus is irrelevant to the headline numbers
    while (s.phase !== 'ended' && guard++ < 200) {
      s = chooseMove(s, chooseSimMove(c.policy, s), pool);
      const d = s.cur.question!.difficulty;
      const right = rnd() < accuracyFor(c.p, d);
      s = answer(s, right ? s.cur.question!.correctIndex : (s.cur.question!.correctIndex + 1) % 3).state;
    }
    questions += s.tally.asked;
    const acc = s.tally.asked ? s.tally.correct / s.tally.asked : 0;
    if (s.outcome !== 'victory') accLoss += acc;
    if (s.outcome === 'victory') {
      accWin += acc;
      wins++;
      winQuestions += s.tally.asked;
      hpLeft += s.heroHp / s.hero.maxHp;
    }
  }
  return {
    winRate: wins / runs,
    avgQuestions: questions / runs,
    avgHpLeftOnWin: wins ? hpLeft / wins : 0,
    avgQuestionsOnWin: wins ? winQuestions / wins : 0,
    accOnWin: wins ? accWin / wins : 0,
    accOnLoss: runs - wins ? accLoss / (runs - wins) : 0,
  };
}

const SKILLS = ['power_strike', 'iron_skin'];
const ironSword = { atk: 3, effectKey: null };
const steelSword = { atk: 5, effectKey: null };
const leather = { def: 2, effectKey: null };
const ironPlate = { def: 4, effectKey: null };
const LOADOUTS = {
  /** Level-appropriate heroes: the level the tier opens at (boss: its gate), the gear a player realistically has by then, and the two 1-point skills. */
  regular1: { level: 3, weapon: ironSword, armor: leather },
  boss1: { level: 3, weapon: ironSword, armor: leather },
  regular2: { level: 5, weapon: ironSword, armor: leather },
  boss2: { level: 7, weapon: steelSword, armor: ironPlate },
  regular3: { level: 9, weapon: steelSword, armor: ironPlate },
  boss3: { level: 12, weapon: { atk: 8, effectKey: null }, armor: { def: 6, effectKey: null } },
} as const;
export type LoadoutKey = keyof typeof LOADOUTS;

export function simHero(key: LoadoutKey, extra: Partial<StatsInput> = {}): DerivedStats {
  const l = LOADOUTS[key];
  return deriveStats({ playerClass: null, skillKeys: SKILLS, ...l, ...extra });
}

/** Win rate averaged over every regular enemy of the roster (so no single enemy decides the target). */
export function rosterAverage(policy: Policy, p: number, tier: 1 | 2 | 3, hero: DerivedStats, runs = 400) {
  const acc = { winRate: 0, avgQuestions: 0, avgQuestionsOnWin: 0, avgHpLeftOnWin: 0, accOnWin: 0, accOnLoss: 0 };
  for (const e of ENEMIES) {
    const r = simulate({ policy, p, enemySlug: e.slug, tier, hero, runs, seedBase: 7 });
    for (const k of Object.keys(acc) as (keyof typeof acc)[]) acc[k] += r[k] / ENEMIES.length;
  }
  return acc;
}
