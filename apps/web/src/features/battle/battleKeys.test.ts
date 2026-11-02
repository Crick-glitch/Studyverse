import { describe, expect, it } from 'vitest';
import { battleKeyAction, type BattleKeyContext } from './battleKeys';

const key = (k: string, over: Partial<Parameters<typeof battleKeyAction>[0]> = {}) => ({
  key: k, ctrlKey: false, altKey: false, metaKey: false, target: document.body, ...over,
});
const ctx = (over: Partial<BattleKeyContext> = {}): BattleKeyContext => ({ stage: 'play', step: 'awaitingMove', busy: false, choiceCount: 3, ...over });

describe('battle keyboard shortcuts', () => {
  it('Q/W/E pick Steady/Brace/Bold and Enter confirms while awaiting a move', () => {
    expect(battleKeyAction(key('q'), ctx())).toEqual({ kind: 'move', move: 'steady' });
    expect(battleKeyAction(key('W'), ctx())).toEqual({ kind: 'move', move: 'brace' });
    expect(battleKeyAction(key('e'), ctx())).toEqual({ kind: 'move', move: 'bold' });
    expect(battleKeyAction(key('Enter'), ctx())).toEqual({ kind: 'confirmMove' });
  });

  it('1/2/3 answer only while a question is open and only for choices that exist', () => {
    expect(battleKeyAction(key('2'), ctx({ step: 'awaitingAnswer' }))).toEqual({ kind: 'answer', index: 1 });
    expect(battleKeyAction(key('3'), ctx({ step: 'awaitingAnswer', choiceCount: 2 }))).toBeNull();
    expect(battleKeyAction(key('1'), ctx())).toBeNull();
  });

  it('Enter continues from feedback; A arms the class ability in the move and question steps', () => {
    expect(battleKeyAction(key('Enter'), ctx({ step: 'feedback' }))).toEqual({ kind: 'continue' });
    expect(battleKeyAction(key('a'), ctx())).toEqual({ kind: 'ability' });
    expect(battleKeyAction(key('a'), ctx({ step: 'awaitingAnswer' }))).toEqual({ kind: 'ability' });
    expect(battleKeyAction(key('a'), ctx({ step: 'feedback' }))).toBeNull();
  });

  it('is silent while a request is in flight, before play, on the rewards screen, and for held modifiers or repeats', () => {
    expect(battleKeyAction(key('Enter'), ctx({ busy: true }))).toBeNull();
    expect(battleKeyAction(key('q'), ctx({ stage: 'intro' }))).toBeNull();
    expect(battleKeyAction(key('q'), ctx({ stage: 'rewards' }))).toBeNull();
    expect(battleKeyAction(key('q', { ctrlKey: true }), ctx())).toBeNull();
    expect(battleKeyAction(key('q', { metaKey: true }), ctx())).toBeNull();
    expect(battleKeyAction(key('q', { repeat: true }), ctx())).toBeNull();
  });

  it('ignores keys typed into a field, and leaves Enter to a focused button (it activates natively)', () => {
    const input = document.createElement('input');
    expect(battleKeyAction(key('q', { target: input }), ctx())).toBeNull();
    const button = document.createElement('button');
    expect(battleKeyAction(key('Enter', { target: button }), ctx())).toBeNull();
    expect(battleKeyAction(key('q', { target: button }), ctx())).toEqual({ kind: 'move', move: 'steady' });
  });
});
