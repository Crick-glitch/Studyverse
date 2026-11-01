import { describe, expect, it } from 'vitest';
import type { AnswerResultDto, BattleDto, BattleSummaryDto } from '@studyverse/shared';
import { initialView, reduce, type BattleView } from './battleReducer';
import { fakeBattle, fakeResult } from './testFixtures';

const run = (v: BattleView, ...actions: Parameters<typeof reduce>[1][]) => actions.reduce(reduce, v);
const summary = { battleId: 'b1', outcome: 'victory' } as unknown as BattleSummaryDto;

describe('battle view state machine', () => {
  it('starts loading with Steady pre-selected', () => {
    expect(initialView).toMatchObject({ stage: 'loading', step: 'awaitingMove', move: 'steady', busy: false });
  });

  it('a fresh battle shows the intro first; Begin enters play at awaitingMove', () => {
    const v = run(initialView, { type: 'loaded', battle: fakeBattle() });
    expect(v).toMatchObject({ stage: 'intro', step: 'awaitingMove' });
    expect(run(v, { type: 'begin' })).toMatchObject({ stage: 'play', step: 'awaitingMove' });
  });

  it('a resumed battle skips the intro and lands on the right step (awaitingMove and awaitingAnswer)', () => {
    const mid = fakeBattle({ turn: 3, lastResult: fakeResult() });
    expect(run(initialView, { type: 'loaded', battle: mid })).toMatchObject({ stage: 'play', step: 'awaitingMove' });
    const asked = fakeBattle({ turn: 3, lastResult: fakeResult(), phase: 'awaitingAnswer', move: 'bold', question: { text: 'Q?', choices: ['a', 'b', 'c'] } });
    expect(run(initialView, { type: 'loaded', battle: asked })).toMatchObject({ stage: 'play', step: 'awaitingAnswer', move: 'bold' });
  });

  it('a finished battle opens straight on the rewards stage', () => {
    const ended = fakeBattle({ phase: 'ended', status: 'victory' });
    expect(run(initialView, { type: 'loaded', battle: ended })).toMatchObject({ stage: 'rewards', summary: null });
  });

  it('selectMove only changes the highlight while awaiting a move', () => {
    const play = run(initialView, { type: 'loaded', battle: fakeBattle() }, { type: 'begin' });
    expect(run(play, { type: 'selectMove', move: 'bold' }).move).toBe('bold');
    const asked = run(play, { type: 'moveOk', battle: fakeBattle({ phase: 'awaitingAnswer', move: 'bold', question: { text: 'Q?', choices: ['a', 'b', 'c'] } }) });
    expect(run(asked, { type: 'selectMove', move: 'brace' }).move).toBe('bold');
  });

  it('a move request locks the buttons; the reply reveals the question', () => {
    const play = run(initialView, { type: 'loaded', battle: fakeBattle() }, { type: 'begin' });
    const sending = reduce(play, { type: 'requestStarted' });
    expect(sending.busy).toBe(true);
    const asked = reduce(sending, { type: 'moveOk', battle: fakeBattle({ phase: 'awaitingAnswer', move: 'steady', question: { text: 'Q?', choices: ['a', 'b', 'c'] } }) });
    expect(asked).toMatchObject({ step: 'awaitingAnswer', busy: false, move: 'steady' });
    expect(asked.battle?.question?.text).toBe('Q?');
  });

  const asking = () =>
    run(
      initialView,
      { type: 'loaded', battle: fakeBattle() },
      { type: 'begin' },
      { type: 'moveOk', battle: fakeBattle({ phase: 'awaitingAnswer', question: { text: 'Q?', choices: ['a', 'b', 'c'] } }) },
    );

  it('answering moves through resolving to feedback and keeps the answered question for the explanation', () => {
    const resolving = reduce(asking(), { type: 'answerSent', index: 1 });
    expect(resolving).toMatchObject({ step: 'resolving', picked: 1, busy: true });
    const result: AnswerResultDto = fakeResult({ correct: false, selectedIndex: 1, correctIndex: 2, damageTaken: 9 });
    const next = fakeBattle({ turn: 2, phase: 'awaitingMove', lastResult: result });
    const fb = reduce(resolving, { type: 'answerOk', result, battle: next });
    expect(fb).toMatchObject({ step: 'feedback', busy: false, picked: 1 });
    expect(fb.answered).toEqual({ text: 'Q?', choices: ['a', 'b', 'c'] });
    expect(fb.feedback).toBe(result);
    expect(fb.fx.map((f) => f.kind)).toContain('heroHit');
  });

  it('Continue returns to a fresh Steady move step; after the final answer it goes to rewards', () => {
    const result = fakeResult({ damageDealt: 14 });
    const mid = run(asking(), { type: 'answerSent', index: 0 }, { type: 'answerOk', result, battle: fakeBattle({ turn: 2, lastResult: result }) });
    const cont = reduce({ ...mid, move: 'bold' }, { type: 'continue' });
    expect(cont).toMatchObject({ stage: 'play', step: 'awaitingMove', move: 'steady', feedback: null, answered: null, picked: null });
    const last = fakeResult({ damageDealt: 30, ended: true, outcome: 'victory' });
    const over = run(asking(), { type: 'answerSent', index: 0 }, { type: 'answerOk', result: last, battle: fakeBattle({ phase: 'ended', status: 'victory', lastResult: last }) });
    expect(over.fx.map((f) => f.kind)).toContain('enemyDefeat');
    expect(reduce(over, { type: 'continue' })).toMatchObject({ stage: 'rewards', summary: null });
  });

  it('a failed answer goes back to awaitingAnswer with the message, so the player can retry (idempotent on the server)', () => {
    const resolving = reduce(asking(), { type: 'answerSent', index: 2 });
    const failed = reduce(resolving, { type: 'failed', message: 'Could not reach the server.' });
    expect(failed).toMatchObject({ step: 'awaitingAnswer', busy: false, error: 'Could not reach the server.', picked: null });
    expect(reduce(failed, { type: 'dismissError' }).error).toBeNull();
  });

  it('a failed move keeps awaitingMove', () => {
    const play = run(initialView, { type: 'loaded', battle: fakeBattle() }, { type: 'begin' }, { type: 'requestStarted' });
    expect(reduce(play, { type: 'failed', message: 'x' })).toMatchObject({ step: 'awaitingMove', busy: false, error: 'x' });
  });

  it('retreat and the stored summary lead to the rewards stage', () => {
    const play = run(initialView, { type: 'loaded', battle: fakeBattle() }, { type: 'begin' });
    const out = reduce(play, { type: 'retreatOk', battle: fakeBattle({ phase: 'ended', status: 'retreated' }) });
    expect(out).toMatchObject({ stage: 'rewards', summary: null });
    expect(reduce(out, { type: 'summaryOk', summary }).summary).toBe(summary);
  });

  it('an ability reply replaces the battle (armed, Focus spent, removed choice) without changing the step', () => {
    const v = asking();
    const armed = fakeBattle({ phase: 'awaitingAnswer', question: { text: 'Q?', choices: ['a', 'b', 'c'] }, removedIndex: 0, focus: 0 });
    const out = reduce(v, { type: 'abilityOk', battle: armed });
    expect(out.step).toBe('awaitingAnswer');
    expect(out.battle?.removedIndex).toBe(0);
  });

  it('effects are ids that never repeat, and clearFx removes only the ones named', () => {
    const result = fakeResult({ damageDealt: 7, correct: true });
    const v = run(asking(), { type: 'answerSent', index: 0 }, { type: 'answerOk', result, battle: fakeBattle({ turn: 2, lastResult: result }) });
    const ids = v.fx.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(v.fx.some((f) => f.kind === 'enemyHit' && f.amount === 7)).toBe(true);
    expect(reduce(v, { type: 'clearFx', ids: [ids[0]!] }).fx).toHaveLength(ids.length - 1);
  });

  it('boss phase changes raise a banner effect', () => {
    const result = fakeResult({ events: [{ type: 'phase', text: 'The Wyrm enrages!' }] });
    const v = run(asking(), { type: 'answerSent', index: 0 }, { type: 'answerOk', result, battle: fakeBattle({ turn: 2, lastResult: result }) });
    expect(v.fx.find((f) => f.kind === 'phase')?.text).toBe('The Wyrm enrages!');
  });

  it('resync takes the server state as truth: back to the right step, feedback cleared; an ended battle goes to rewards', () => {
    const v = run(asking(), { type: 'answerSent', index: 0 });
    const synced = reduce(v, { type: 'resync', battle: fakeBattle({ turn: 4, phase: 'awaitingMove', lastResult: fakeResult() }) });
    expect(synced).toMatchObject({ stage: 'play', step: 'awaitingMove', busy: false, picked: null, feedback: null });
    expect(reduce(v, { type: 'resync', battle: fakeBattle({ phase: 'ended', status: 'defeat' }) }).stage).toBe('rewards');
  });

  it('BattleDto fixtures stay assignable (type check)', () => {
    const b: BattleDto = fakeBattle();
    expect(b.hero.maxHp).toBeGreaterThan(0);
  });
});
