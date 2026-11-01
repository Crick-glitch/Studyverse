import type { AnswerResultDto, BattleDto, BattleQuestionDto, BattleSummaryDto, Move } from '@studyverse/shared';

/**
 * The battle screen's client state machine (06-battle-screen.md). One reducer owns the view; the SERVER response
 * is always the truth, so every action that carries a `battle` simply replaces it.
 *
 *   loading -> intro -> awaitingMove -> (move sent) -> awaitingAnswer -> resolving -> feedback
 *           -> awaitingMove ... -> rewards
 *
 * `feedback` is client-only: the server has already opened the next turn, but the player must read the result
 * (and the explanation) and press Continue. The enemy's reaction is part of that result, so there is no separate
 * `enemyTurn` step.
 */
export type Stage = 'loading' | 'intro' | 'play' | 'rewards';
export type Step = 'awaitingMove' | 'awaitingAnswer' | 'resolving' | 'feedback';

export type FxKind = 'enemyHit' | 'heroHit' | 'enemyHeal' | 'heroHeal' | 'enemyDefeat' | 'heroDefeat' | 'victory' | 'phase' | 'guardBreak' | 'shield';
/** A short-lived visual effect (floating number, flash, banner). The field removes it with `clearFx`. */
export interface Fx {
  id: number;
  kind: FxKind;
  amount?: number;
  text?: string;
}

export interface BattleView {
  stage: Stage;
  step: Step;
  battle: BattleDto | null;
  /** The highlighted move (Steady by default). Only meaningful while awaiting a move. */
  move: Move;
  busy: boolean;
  error: string | null;
  feedback: AnswerResultDto | null;
  /** The question that was just answered (the DTO no longer carries it once the turn moved on). */
  answered: BattleQuestionDto | null;
  picked: number | null;
  fx: Fx[];
  summary: BattleSummaryDto | null;
  fxSeq: number;
}

export const initialView: BattleView = {
  stage: 'loading', step: 'awaitingMove', battle: null, move: 'steady', busy: false, error: null,
  feedback: null, answered: null, picked: null, fx: [], summary: null, fxSeq: 0,
};

export type BattleAction =
  | { type: 'loaded'; battle: BattleDto }
  /** The server disagreed with the screen (another tab, a stale turn): take its state as the truth. */
  | { type: 'resync'; battle: BattleDto }
  | { type: 'begin' }
  | { type: 'selectMove'; move: Move }
  | { type: 'requestStarted' }
  | { type: 'moveOk'; battle: BattleDto }
  | { type: 'abilityOk'; battle: BattleDto }
  | { type: 'answerSent'; index: number }
  | { type: 'answerOk'; result: AnswerResultDto; battle: BattleDto }
  | { type: 'continue' }
  | { type: 'retreatOk'; battle: BattleDto }
  | { type: 'summaryOk'; summary: BattleSummaryDto }
  | { type: 'failed'; message: string }
  | { type: 'dismissError' }
  | { type: 'clearFx'; ids: number[] };

const stepFor = (b: BattleDto): Step => (b.phase === 'awaitingAnswer' ? 'awaitingAnswer' : 'awaitingMove');

/** What the result looked like, as effects: numbers over the combatants, flashes, banners. */
function fxFor(result: AnswerResultDto, battle: BattleDto, seq: number): Fx[] {
  const out: Omit<Fx, 'id'>[] = [];
  if (result.damageDealt > 0) out.push({ kind: 'enemyHit', amount: result.damageDealt });
  if (result.damageTaken > 0) out.push({ kind: 'heroHit', amount: result.damageTaken });
  if (result.enemyHealed > 0) out.push({ kind: 'enemyHeal', amount: result.enemyHealed });
  if (result.heroHealed > 0) out.push({ kind: 'heroHeal', amount: result.heroHealed });
  for (const e of result.events) {
    if (e.type === 'phase') out.push({ kind: 'phase', text: e.text });
    else if (e.type === 'guardBreak') out.push({ kind: 'guardBreak', text: e.text });
    else if (e.type === 'bulwark') out.push({ kind: 'shield', text: e.text });
  }
  if (result.ended) out.push(battle.status === 'victory' ? { kind: 'enemyDefeat' } : battle.status === 'defeat' ? { kind: 'heroDefeat' } : { kind: 'victory' });
  return out.map((f, i) => ({ ...f, id: seq + i }));
}

export function reduce(v: BattleView, a: BattleAction): BattleView {
  switch (a.type) {
    case 'loaded': {
      const b = a.battle;
      if (b.phase === 'ended' || b.status !== 'active') return { ...v, battle: b, stage: 'rewards', summary: null, busy: false };
      const resumed = b.turn > 1 || b.lastResult !== null || b.phase === 'awaitingAnswer';
      return { ...v, battle: b, stage: resumed ? 'play' : 'intro', step: stepFor(b), move: b.move ?? 'steady', busy: false };
    }
    case 'resync': {
      const b = a.battle;
      const over = b.phase === 'ended' || b.status !== 'active';
      return {
        ...v, battle: b, stage: over ? 'rewards' : 'play', step: stepFor(b), move: b.move ?? 'steady',
        busy: false, error: null, feedback: null, answered: null, picked: null,
      };
    }
    case 'begin':
      return v.stage === 'intro' ? { ...v, stage: 'play' } : v;
    case 'selectMove':
      return v.stage === 'play' && v.step === 'awaitingMove' && !v.busy ? { ...v, move: a.move } : v;
    case 'requestStarted':
      return { ...v, busy: true, error: null };
    case 'moveOk':
      return { ...v, battle: a.battle, step: 'awaitingAnswer', move: a.battle.move ?? v.move, busy: false, error: null };
    case 'abilityOk':
      return { ...v, battle: a.battle, busy: false, error: null };
    case 'answerSent':
      return { ...v, step: 'resolving', picked: a.index, busy: true, error: null };
    case 'answerOk': {
      const answered = v.battle?.question ?? v.answered;
      const fx = fxFor(a.result, a.battle, v.fxSeq);
      return {
        ...v, battle: a.battle, step: 'feedback', busy: false, error: null, feedback: a.result, answered,
        picked: a.result.selectedIndex, fx: [...v.fx, ...fx], fxSeq: v.fxSeq + fx.length,
      };
    }
    case 'continue': {
      if (v.step !== 'feedback') return v;
      if (v.battle && (v.battle.phase === 'ended' || v.battle.status !== 'active')) return { ...v, stage: 'rewards', summary: null };
      return { ...v, step: 'awaitingMove', move: 'steady', feedback: null, answered: null, picked: null };
    }
    case 'retreatOk':
      return { ...v, battle: a.battle, stage: 'rewards', summary: null, busy: false, error: null };
    case 'summaryOk':
      return { ...v, summary: a.summary, busy: false, error: null };
    case 'failed':
      // A failed answer goes back to the question (the server treats a repeated answer as a replay), never a silent skip.
      return { ...v, busy: false, error: a.message, ...(v.step === 'resolving' ? { step: 'awaitingAnswer' as const, picked: null } : {}) };
    case 'dismissError':
      return { ...v, error: null };
    case 'clearFx':
      return { ...v, fx: v.fx.filter((f) => !a.ids.includes(f.id)) };
    default:
      return v;
  }
}
