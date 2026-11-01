import type { Move } from '@studyverse/shared';
import { isTypingTarget, type KeyLike } from '../../layouts/hotkeys';
import type { Stage, Step } from './battleReducer';

export type BattleKeyAction =
  | { kind: 'move'; move: Move }
  | { kind: 'confirmMove' }
  | { kind: 'answer'; index: number }
  | { kind: 'continue' }
  | { kind: 'ability' };

export interface BattleKeyContext {
  stage: Stage;
  step: Step;
  busy: boolean;
  choiceCount: number;
}

const MOVE_KEYS: Readonly<Record<string, Move>> = { q: 'steady', w: 'brace', e: 'bold' };

/**
 * Battle keys (06): Q/W/E highlight Steady/Brace/Bold, Enter confirms (Steady is pre-selected), 1/2/3 answer, Enter
 * continues, A arms the class ability. Never while typing, never with Ctrl/Alt/Meta held (browser and screen-reader
 * shortcuts), never while a request is in flight. Enter is left to a focused button, which activates itself.
 */
export function battleKeyAction(e: KeyLike, c: BattleKeyContext): BattleKeyAction | null {
  if (e.defaultPrevented || e.repeat || e.isComposing || e.ctrlKey || e.altKey || e.metaKey) return null;
  if (c.stage !== 'play' || c.busy || isTypingTarget(e.target)) return null;
  const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  if (k === 'Enter') {
    if (e.target instanceof HTMLElement && e.target.closest('button, a, summary')) return null;
    if (c.step === 'awaitingMove') return { kind: 'confirmMove' };
    if (c.step === 'feedback') return { kind: 'continue' };
    return null;
  }
  if (c.step === 'awaitingMove' && MOVE_KEYS[k]) return { kind: 'move', move: MOVE_KEYS[k] as Move };
  if (c.step === 'awaitingAnswer' && /^[1-9]$/.test(k)) {
    const index = Number(k) - 1;
    return index < c.choiceCount ? { kind: 'answer', index } : null;
  }
  if (k === 'a' && (c.step === 'awaitingMove' || c.step === 'awaitingAnswer')) return { kind: 'ability' };
  return null;
}
