import { deriveStats, type DerivedStats, type StatsInput } from '@studyverse/shared';
import { answer, chooseMove, createBattle, type NewBattleInput } from './engine.js';
import type { EngineState, PoolQuestion } from './types.js';

/** Shared helpers for the engine tests and the balance simulation (kept out of the production build's tests). */
export const hero = (over: Partial<StatsInput> = {}): DerivedStats =>
  deriveStats({ level: 1, playerClass: null, ...over });

export function pq(
  id: string,
  difficulty: PoolQuestion['difficulty'],
  over: Partial<PoolQuestion> = {},
): PoolQuestion {
  return {
    ref: `bank:${id}`,
    source: 'bank',
    id,
    difficulty,
    subject: 'Math',
    text: `Question ${id}?`,
    choices: ['right', 'wrong a', 'wrong b'],
    correctIndex: 0,
    explanation: `Because ${id}.`,
    due: false,
    ...over,
  };
}

/** A pool with several questions of every difficulty. */
export function bigPool(perDifficulty = 12, subject = 'Math'): PoolQuestion[] {
  const out: PoolQuestion[] = [];
  for (const d of ['easy', 'medium', 'hard'] as const) {
    for (let i = 0; i < perDifficulty; i++) out.push(pq(`${d}-${i}`, d, { subject }));
  }
  return out;
}

export function start(over: Partial<NewBattleInput> = {}): EngineState {
  return createBattle({
    mode: 'raid',
    tier: 1,
    subject: 'Math',
    enemySlug: 'goblin-chieftain',
    hero: hero(),
    seed: 12345,
    ...over,
  });
}

/** Chooses a move and answers it right or wrong. Returns the new state and the result. */
export function turn(
  s: EngineState,
  move: 'steady' | 'brace' | 'bold',
  right: boolean,
  pool: PoolQuestion[] = bigPool(),
) {
  const picked = chooseMove(s, move, pool);
  const q = picked.cur.question!;
  const sel = right ? q.correctIndex : (q.correctIndex + 1) % q.choices.length;
  return answer(picked, sel);
}
